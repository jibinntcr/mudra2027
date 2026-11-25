import { getCollections } from '@/lib/db/client';
import { normalizeDocNumber, escapeRegex } from '@/lib/validation/normalize';
import type { LibraryDocument } from '@/lib/db/types';

export interface SearchLibraryParams {
  query?: string;
  categorySlug?: string;
  year?: number | null;
  hasTextLayer?: boolean | null;
  includeUnpublished?: boolean;
  page?: number;
  limit?: number;
}

export interface SearchLibraryResultItem {
  docId: string;
  slug: string;
  documentNumber: string;
  normalizedDocNumber: string;
  titleEn: string;
  titleMl: string;
  summaryEn: string;
  summaryMl: string;
  keywords: string[];
  categorySlugs: string[];
  primaryCategorySlug: string;
  documentDateText?: string;
  year: number | null;
  hasTextLayer: boolean;
  isScanned: boolean;
  currentVersion: number;
  pageCount: number;
  fileSize: number;
  isPublished: boolean;
  exactNumberMatch: boolean;
  matchSnippet?: string;
  score: number;
}

export interface SearchLibraryResponse {
  items: SearchLibraryResultItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  availableYears: number[];
  engineUsed: 'atlas_search' | 'mongodb_indexed_hybrid';
}

let atlasSearchAvailable: boolean | null = null;

/**
 * Searches the library with:
 * 1. Mandatory access and publication filters (`isPublished: true` for readers) applied BEFORE returning results, snippets, or counts.
 * 2. Exact normalized document-number lookup so variants like `IGR/5897/2024-RR2` and `IGR 5897 2024 RR2` match the exact same record and rank first.
 * 3. MongoDB Atlas Search (`$search` on `mudra_documents_search` index) for Malayalam (`titleMl`, `summaryMl`) and English (`titleEn`, `summaryEn`, `documentNumber`, `keywords`, `extractedText`), with automatic fallback to MongoDB indexed hybrid search when running on local MongoDB Community.
 * 4. Server-side pagination (`$skip`, `$limit`, `$count`).
 */
export async function searchLibraryDocuments(
  params: SearchLibraryParams
): Promise<SearchLibraryResponse> {
  const { documents } = await getCollections();
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(50, Math.max(1, params.limit || 12));
  const skip = (page - 1) * limit;
  const rawQuery = (params.query || '').trim();
  const { normalized, spaced, coreNormalized } = normalizeDocNumber(rawQuery);

  // Base publication and attribute filter applied BEFORE any results or counts are returned
  const baseFilter: Record<string, unknown> = {};
  if (!params.includeUnpublished) {
    baseFilter.isPublished = true;
  }
  if (params.categorySlug) {
    baseFilter.categorySlugs = params.categorySlug;
  }
  if (params.year) {
    baseFilter.year = params.year;
  }
  if (typeof params.hasTextLayer === 'boolean') {
    baseFilter.hasTextLayer = params.hasTextLayer;
  }

  // Distinct available years for filter sidebar
  const yearsAgg = await documents
    .aggregate<{ _id: number }>([
      { $match: params.includeUnpublished ? {} : { isPublished: true } },
      { $match: { year: { $ne: null } } },
      { $group: { _id: '$year' } },
      { $sort: { _id: -1 } },
    ])
    .toArray();
  const availableYears = yearsAgg.map((y) => y._id).filter(Boolean);

  // Case 1: Browsing without a search query (pure indexed category / year listing)
  if (!rawQuery) {
    const [total, rawDocs] = await Promise.all([
      documents.countDocuments(baseFilter),
      documents
        .find(baseFilter, {
          projection: {
            extractedText: 0, // Never send full PDF text layer in list response
          },
        })
        .sort({ year: -1, documentDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
    ]);

    return {
      items: rawDocs.map((d) => mapDocToResultItem(d, '', false, 1)),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      availableYears,
      engineUsed: 'mongodb_indexed_hybrid',
    };
  }

  // Case 2: Search query provided
  // Attempt MongoDB Atlas Search ($search) if running on an Atlas cluster with `mudra_documents_search` index
  if (atlasSearchAvailable !== false) {
    try {
      const atlasPipeline: Record<string, unknown>[] = [
        {
          $search: {
            index: 'mudra_documents_search',
            compound: {
              should: [
                ...(normalized.length >= 2
                  ? [
                      {
                        equals: {
                          path: 'normalizedDocNumber',
                          value: normalized,
                          score: { boost: { value: 50 } },
                        },
                      },
                      {
                        text: {
                          query: spaced,
                          path: ['spacedDocNumber', 'documentNumber'],
                          score: { boost: { value: 25 } },
                        },
                      },
                    ]
                  : []),
                {
                  text: {
                    query: rawQuery,
                    path: ['titleMl', 'summaryMl', 'titleEn', 'summaryEn', 'keywords'],
                    score: { boost: { value: 10 } },
                  },
                },
                {
                  text: {
                    query: rawQuery,
                    path: 'extractedText',
                    score: { boost: { value: 3 } },
                  },
                },
              ],
              minimumShouldMatch: 1,
            },
          },
        },
        { $match: baseFilter },
        {
          $addFields: {
            searchScore: { $meta: 'searchScore' },
            exactNumberMatch: {
              $in: ['$normalizedDocNumber', [normalized, coreNormalized].filter(Boolean)],
            },
          },
        },
        {
          $sort: {
            exactNumberMatch: -1,
            searchScore: -1,
            year: -1,
          },
        },
        {
          $facet: {
            metadata: [{ $count: 'total' }],
            data: [{ $skip: skip }, { $limit: limit }],
          },
        },
      ];

      const aggResult = await documents.aggregate(atlasPipeline).toArray();
      atlasSearchAvailable = true;
      const total = aggResult[0]?.metadata?.[0]?.total || 0;
      const docs = (aggResult[0]?.data || []) as Array<
        LibraryDocument & { searchScore?: number; exactNumberMatch?: boolean }
      >;

      return {
        items: docs.map((d) =>
          mapDocToResultItem(
            d,
            rawQuery,
            Boolean(d.exactNumberMatch),
            Number(d.searchScore || 1)
          )
        ),
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        availableYears,
        engineUsed: 'atlas_search',
      };
    } catch {
      // Running against MongoDB Community / non-Atlas deployment without mongot search service
      atlasSearchAvailable = false;
    }
  }

  // MongoDB Indexed Hybrid Search Pipeline (Malayalam + English Unicode + Normalized Document Number ranking)
  const escapedRaw = escapeRegex(rawQuery);
  const tokens = rawQuery
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);

  const orConditions: Record<string, unknown>[] = [];

  if (normalized.length >= 2) {
    orConditions.push(
      { normalizedDocNumber: normalized },
      { normalizedDocNumber: coreNormalized },
      { normalizedDocNumber: { $regex: escapeRegex(normalized), $options: 'i' } },
      { spacedDocNumber: { $regex: escapeRegex(spaced), $options: 'i' } }
    );
  }

  orConditions.push(
    { documentNumber: { $regex: escapedRaw, $options: 'i' } },
    { titleMl: { $regex: escapedRaw, $options: 'i' } },
    { summaryMl: { $regex: escapedRaw, $options: 'i' } },
    { titleEn: { $regex: escapedRaw, $options: 'i' } },
    { summaryEn: { $regex: escapedRaw, $options: 'i' } },
    { keywords: { $regex: escapedRaw, $options: 'i' } },
    { extractedText: { $regex: escapedRaw, $options: 'i' } }
  );

  // Also match multi-token queries where all tokens appear across Malayalam/English title, number, or text
  if (tokens.length > 1) {
    const tokenAnds = tokens.map((tok) => {
      const escTok = escapeRegex(tok);
      const normTok = normalizeDocNumber(tok).normalized;
      return {
        $or: [
          ...(normTok.length >= 2
            ? [{ normalizedDocNumber: { $regex: escapeRegex(normTok), $options: 'i' } }]
            : []),
          { titleMl: { $regex: escTok, $options: 'i' } },
          { summaryMl: { $regex: escTok, $options: 'i' } },
          { titleEn: { $regex: escTok, $options: 'i' } },
          { summaryEn: { $regex: escTok, $options: 'i' } },
          { keywords: { $regex: escTok, $options: 'i' } },
          { extractedText: { $regex: escTok, $options: 'i' } },
        ],
      };
    });
    orConditions.push({ $and: tokenAnds });
  }

  const combinedMatch = {
    ...baseFilter,
    $or: orConditions,
  };

  const normTargets = [normalized, coreNormalized].filter((v) => v.length >= 2);

  const pipeline: Record<string, unknown>[] = [
    { $match: combinedMatch },
    {
      $addFields: {
        exactNumberMatch:
          normTargets.length > 0
            ? { $in: ['$normalizedDocNumber', normTargets] }
            : false,
        prefixNumberMatch:
          normalized.length >= 3
            ? {
                $regexMatch: {
                  input: '$normalizedDocNumber',
                  regex: `^${escapeRegex(normalized)}`,
                  options: 'i',
                },
              }
            : false,
        partialNumberMatch:
          normalized.length >= 3
            ? {
                $regexMatch: {
                  input: '$normalizedDocNumber',
                  regex: escapeRegex(normalized),
                  options: 'i',
                },
              }
            : false,
        titleMlMatch: {
          $regexMatch: {
            input: { $ifNull: ['$titleMl', ''] },
            regex: escapedRaw,
            options: 'i',
          },
        },
        titleEnMatch: {
          $regexMatch: {
            input: { $ifNull: ['$titleEn', ''] },
            regex: escapedRaw,
            options: 'i',
          },
        },
      },
    },
    {
      $addFields: {
        computedScore: {
          $add: [
            { $cond: ['$exactNumberMatch', 1000, 0] },
            { $cond: ['$prefixNumberMatch', 300, 0] },
            { $cond: ['$partialNumberMatch', 150, 0] },
            { $cond: ['$titleMlMatch', 80, 0] },
            { $cond: ['$titleEnMatch', 70, 0] },
          ],
        },
      },
    },
    {
      $sort: {
        exactNumberMatch: -1,
        computedScore: -1,
        year: -1,
        createdAt: -1,
      },
    },
    {
      $facet: {
        metadata: [{ $count: 'total' }],
        data: [{ $skip: skip }, { $limit: limit }],
      },
    },
  ];

  const aggResult = await documents.aggregate(pipeline).toArray();
  const total = aggResult[0]?.metadata?.[0]?.total || 0;
  const docs = (aggResult[0]?.data || []) as Array<
    LibraryDocument & { computedScore?: number; exactNumberMatch?: boolean }
  >;

  return {
    items: docs.map((d) =>
      mapDocToResultItem(
        d,
        rawQuery,
        Boolean(d.exactNumberMatch),
        Number(d.computedScore || 10)
      )
    ),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    availableYears,
    engineUsed: 'mongodb_indexed_hybrid',
  };
}

function buildSnippet(doc: LibraryDocument, query: string): string | undefined {
  if (!query) return undefined;
  const qLower = query.toLowerCase();
  const pool = [doc.summaryMl, doc.summaryEn, doc.extractedText].filter(Boolean).join(' • ');
  if (!pool) return undefined;

  const idx = pool.toLowerCase().indexOf(qLower);
  if (idx === -1) {
    return (doc.summaryMl || doc.summaryEn || pool).slice(0, 220);
  }
  const start = Math.max(0, idx - 60);
  const end = Math.min(pool.length, idx + query.length + 140);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < pool.length ? '…' : '';
  return `${prefix}${pool.slice(start, end).trim()}${suffix}`;
}

function mapDocToResultItem(
  doc: LibraryDocument,
  query: string,
  exactNumberMatch: boolean,
  score: number
): SearchLibraryResultItem {
  const currentFile =
    doc.versions.find((v) => v.version === doc.currentVersion) ||
    doc.versions[doc.versions.length - 1];

  return {
    docId: doc.docId,
    slug: doc.slug,
    documentNumber: doc.documentNumber,
    normalizedDocNumber: doc.normalizedDocNumber,
    titleEn: doc.titleEn,
    titleMl: doc.titleMl,
    summaryEn: doc.summaryEn,
    summaryMl: doc.summaryMl,
    keywords: doc.keywords,
    categorySlugs: doc.categorySlugs,
    primaryCategorySlug: doc.primaryCategorySlug,
    documentDateText: doc.documentDateText,
    year: doc.year,
    hasTextLayer: doc.hasTextLayer,
    isScanned: doc.isScanned,
    currentVersion: doc.currentVersion,
    pageCount: currentFile?.pageCount || 1,
    fileSize: currentFile?.fileSize || 0,
    isPublished: doc.isPublished,
    exactNumberMatch,
    matchSnippet: buildSnippet(doc, query),
    score,
  };
}
