import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import pdfParse from 'pdf-parse';
import { getCollections } from '@/lib/db/client';
import { requireApiUser } from '@/features/auth/session';
import { normalizeDocNumber, slugify } from '@/lib/validation/normalize';
import {
  buildDocumentStorageKey,
  buildThumbnailStorageKey,
  generateMudraCoverSvg,
  putPrivateObject,
} from '@/lib/storage/private-storage';
import { buildValidPdfBuffer } from '../../../../../scripts/import/migrate-eaadharam';

export async function GET(req: NextRequest) {
  const auth = await requireApiUser(req, { requiredRole: 'admin' });
  if ('errorResponse' in auth) return auth.errorResponse;

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '12', 10) || 12));
  const skip = (page - 1) * limit;
  const q = (url.searchParams.get('q') || '').trim();

  const { documents } = await getCollections();
  const filter: Record<string, unknown> = {};
  if (q) {
    const norm = normalizeDocNumber(q).normalized;
    filter.$or = [
      { documentNumber: { $regex: q, $options: 'i' } },
      ...(norm ? [{ normalizedDocNumber: { $regex: norm, $options: 'i' } }] : []),
      { titleMl: { $regex: q, $options: 'i' } },
      { titleEn: { $regex: q, $options: 'i' } },
    ];
  }

  const [total, items] = await Promise.all([
    documents.countDocuments(filter),
    documents
      .find(filter, { projection: { extractedText: 0 } })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
  ]);

  return NextResponse.json(
    {
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
    { status: 200, headers: { 'Cache-Control': 'private, no-store' } }
  );
}

/**
 * Create / Import a new document or upload a new file version from Admin
 */
export async function POST(req: NextRequest) {
  const auth = await requireApiUser(req, { requiredRole: 'admin' });
  if ('errorResponse' in auth) return auth.errorResponse;

  try {
    const body = await req.json();
    const documentNumber = String(body.documentNumber || '').trim();
    const titleMl = String(body.titleMl || '').trim();
    const titleEn = String(body.titleEn || '').trim();
    const summaryMl = String(body.summaryMl || titleMl).trim();
    const summaryEn = String(body.summaryEn || titleEn).trim();
    const categorySlugs: string[] = Array.isArray(body.categorySlugs)
      ? body.categorySlugs.filter(Boolean)
      : [String(body.primaryCategorySlug || 'lrc-orders-sale')];
    const year = body.year ? parseInt(String(body.year), 10) : new Date().getFullYear();
    const isPublished = body.isPublished !== false;
    const includeTextLayer = body.includeTextLayer !== false;

    if (!documentNumber || !titleEn) {
      return NextResponse.json(
        { error: 'Document Number and Title are required.' },
        { status: 400 }
      );
    }

    const { normalized, spaced } = normalizeDocNumber(documentNumber);
    const { documents } = await getCollections();

    // Check deduplication by normalizedDocNumber or sourceId
    const sourceId = body.sourceId || `admin:${normalized}`;
    const existing = await documents.findOne({
      $or: [{ sourceId }, { normalizedDocNumber: normalized }],
    });

    if (existing) {
      const mergedCategories = Array.from(new Set([...existing.categorySlugs, ...categorySlugs]));
      await documents.updateOne(
        { _id: existing._id },
        { $set: { categorySlugs: mergedCategories, updatedAt: new Date() } }
      );
      return NextResponse.json(
        {
          ok: true,
          deduplicated: true,
          message: `Duplicate document detected (${documentNumber}). Merged categories into existing record ${existing.docId}.`,
          document: existing,
        },
        { status: 200, headers: { 'Cache-Control': 'private, no-store' } }
      );
    }

    let pdfBuffer: Buffer;
    if (body.pdfBase64) {
      pdfBuffer = Buffer.from(body.pdfBase64, 'base64');
    } else {
      pdfBuffer = buildValidPdfBuffer({
        documentNumber,
        titleEn,
        summaryEn,
        categoryLabel: categorySlugs[0] || 'Mudra Library',
        includeTextLayer,
        pageCount: 2,
      });
    }

    const fileHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');
    const existingByHash = await documents.findOne({ latestFileHash: fileHash });
    if (existingByHash) {
      return NextResponse.json(
        {
          ok: true,
          deduplicated: true,
          message: `Duplicate file SHA-256 hash detected. Existing document: ${existingByHash.docId}`,
          document: existingByHash,
        },
        { status: 200, headers: { 'Cache-Control': 'private, no-store' } }
      );
    }

    let extractedText = '';
    let pageCount = 1;
    let hasTextLayer = false;
    try {
      const parsed = await pdfParse(pdfBuffer);
      extractedText = (parsed.text || '').replace(/\s+/g, ' ').trim();
      pageCount = Math.max(1, parsed.numpages || 1);
      hasTextLayer = extractedText.length >= 25;
    } catch {
      hasTextLayer = false;
    }

    const count = await documents.countDocuments();
    const docId = `DOC-${year}-${String(count + 1).padStart(4, '0')}`;
    const baseSlug = slugify(`${documentNumber}-${year}`) || slugify(docId);
    const slugCollision = await documents.findOne({ slug: baseSlug });
    const slug = slugCollision ? `${baseSlug}-${count + 1}` : baseSlug;

    const version = 1;
    const storageKey = buildDocumentStorageKey(docId, version);
    const thumbnailKey = buildThumbnailStorageKey(docId, version);

    await putPrivateObject(storageKey, pdfBuffer);
    const coverSvg = generateMudraCoverSvg({
      documentNumber,
      titleMl: titleMl || titleEn,
      titleEn,
      categoryLabel: categorySlugs[0] || 'Mudra Archive',
      year,
      pageCount,
      hasTextLayer,
    });
    await putPrivateObject(thumbnailKey, coverSvg);

    const now = new Date();
    const newDoc = {
      docId,
      slug,
      documentNumber,
      normalizedDocNumber: normalized,
      spacedDocNumber: spaced,
      titleEn,
      titleMl: titleMl || titleEn,
      summaryEn,
      summaryMl: summaryMl || summaryEn,
      keywords: Array.isArray(body.keywords) ? body.keywords : [documentNumber, String(year)],
      categorySlugs,
      primaryCategorySlug: categorySlugs[0] || 'lrc-orders-sale',
      documentDate: now,
      documentDateText: body.documentDateText || now.toISOString().slice(0, 10),
      year,
      extractedText,
      hasTextLayer,
      isScanned: !hasTextLayer,
      currentVersion: version,
      versions: [
        {
          version,
          storageKey,
          thumbnailKey,
          fileHash,
          fileSize: pdfBuffer.byteLength,
          mimeType: 'application/pdf',
          pageCount,
          hasTextLayer,
          uploadedAt: now,
          uploadedBy: auth.user.loginId,
        },
      ],
      sourceId,
      latestFileHash: fileHash,
      isPublished,
      createdAt: now,
      updatedAt: now,
    };

    await documents.insertOne(newDoc);

    return NextResponse.json(
      { ok: true, deduplicated: false, document: newDoc },
      { status: 201, headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to create document' },
      { status: 500 }
    );
  }
}

/**
 * Update document publication status, title, or categories without moving or breaking the storage file key
 */
export async function PATCH(req: NextRequest) {
  const auth = await requireApiUser(req, { requiredRole: 'admin' });
  if ('errorResponse' in auth) return auth.errorResponse;

  try {
    const body = await req.json();
    const { docId, isPublished, titleEn, titleMl, categorySlugs } = body;
    if (!docId) {
      return NextResponse.json({ error: 'docId is required' }, { status: 400 });
    }

    const { documents } = await getCollections();
    const existing = await documents.findOne({ docId });
    if (!existing) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const updateFields: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof isPublished === 'boolean') updateFields.isPublished = isPublished;
    if (typeof titleEn === 'string' && titleEn.trim()) updateFields.titleEn = titleEn.trim();
    if (typeof titleMl === 'string' && titleMl.trim()) updateFields.titleMl = titleMl.trim();
    if (Array.isArray(categorySlugs) && categorySlugs.length > 0) {
      updateFields.categorySlugs = categorySlugs;
      updateFields.primaryCategorySlug = categorySlugs[0];
    }

    await documents.updateOne({ docId }, { $set: updateFields });
    const updated = await documents.findOne({ docId }, { projection: { extractedText: 0 } });

    return NextResponse.json(
      {
        ok: true,
        message: `Document ${docId} updated (storage key preserved at ${
          existing.versions[existing.versions.length - 1]?.storageKey
        }).`,
        document: updated,
      },
      { status: 200, headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to update document' },
      { status: 500 }
    );
  }
}
