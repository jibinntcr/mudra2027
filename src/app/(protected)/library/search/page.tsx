import Link from 'next/link';
import { requireServerUser } from '@/features/auth/session';
import { getCategoryTree } from '@/features/categories/service';
import { searchLibraryDocuments } from '@/features/search/service';
import { DocumentCard } from '@/features/documents/DocumentCard';
import { Search, Filter } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function LibrarySearchPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    category?: string;
    year?: string;
    hasTextLayer?: string;
    page?: string;
  }>;
}) {
  const sp = await searchParams;
  const query = (sp.q || '').trim();
  const category = (sp.category || '').trim();
  const year = sp.year && /^\d{4}$/.test(sp.year) ? parseInt(sp.year, 10) : null;
  const hasTextLayer =
    sp.hasTextLayer === 'true' ? true : sp.hasTextLayer === 'false' ? false : null;
  const page = Math.max(1, parseInt(sp.page || '1', 10) || 1);

  await requireServerUser({
    returnTo: `/library/search${query ? `?q=${encodeURIComponent(query)}` : ''}`,
  });

  const [categoryTree, searchRes] = await Promise.all([
    getCategoryTree(false),
    searchLibraryDocuments({
      query,
      categorySlug: category || undefined,
      year,
      hasTextLayer,
      page,
      limit: 8,
      includeUnpublished: false,
    }),
  ]);

  const flatCategories = categoryTree.flatMap((root) => [root, ...root.children]);

  const buildPageHref = (targetPage: number) => {
    const u = new URLSearchParams();
    if (query) u.set('q', query);
    if (category) u.set('category', category);
    if (year) u.set('year', String(year));
    if (typeof hasTextLayer === 'boolean') u.set('hasTextLayer', String(hasTextLayer));
    u.set('page', String(targetPage));
    return `/library/search?${u.toString()}`;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-mudra-200 bg-white p-6 shadow-sm mb-6">
        <h1 className="font-serif text-2xl font-bold text-mudra-950">
          Bilingual Library Search (മലയാളം &amp; English)
        </h1>
        <p className="mt-1 text-xs text-mudra-700">
          Search across original and normalized order numbers (e.g.,{' '}
          <code className="font-mono font-semibold">IGR/5897/2024-RR2</code> or{' '}
          <code className="font-mono font-semibold">IGR 5897 2024 RR2</code>), Malayalam and English
          titles, summaries, keywords, and extracted PDF text layers.
        </p>

        <form action="/library/search" method="GET" className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-12">
          <div className="sm:col-span-5 relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-mudra-500" />
            <input
              type="text"
              name="q"
              defaultValue={query}
              placeholder="Order number, Malayalam title, or keyword…"
              className="w-full rounded-lg border border-mudra-300 bg-parchment-50 pl-9 pr-3 py-2 text-xs text-mudra-950"
            />
          </div>

          <div className="sm:col-span-3">
            <select
              name="category"
              defaultValue={category}
              className="w-full rounded-lg border border-mudra-300 bg-parchment-50 px-3 py-2 text-xs text-mudra-950"
            >
              <option value="">All Categories</option>
              {flatCategories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.pathLabel}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <select
              name="year"
              defaultValue={year ? String(year) : ''}
              className="w-full rounded-lg border border-mudra-300 bg-parchment-50 px-3 py-2 text-xs text-mudra-950"
            >
              <option value="">All Years</option>
              {searchRes.availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2 flex gap-2">
            <select
              name="hasTextLayer"
              defaultValue={typeof hasTextLayer === 'boolean' ? String(hasTextLayer) : ''}
              className="w-full rounded-lg border border-mudra-300 bg-parchment-50 px-2 py-2 text-xs text-mudra-950"
            >
              <option value="">All PDFs</option>
              <option value="true">Text Layer</option>
              <option value="false">Scanned Only</option>
            </select>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-lg bg-mudra-800 px-4 py-2 text-xs font-bold text-white hover:bg-mudra-700 shrink-0"
            >
              Search
            </button>
          </div>
        </form>

        {/* Quick Search Chips for Verification */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-mudra-600">
          <span className="inline-flex items-center gap-1 font-medium">
            <Filter className="h-3 w-3" /> Quick queries:
          </span>
          <Link
            href="/library/search?q=IGR%2F5897%2F2024-RR2"
            className="rounded bg-parchment-100 px-2 py-0.5 hover:bg-mudra-100 font-mono"
          >
            IGR/5897/2024-RR2
          </Link>
          <Link
            href="/library/search?q=IGR+5897+2024+RR2"
            className="rounded bg-parchment-100 px-2 py-0.5 hover:bg-mudra-100 font-mono"
          >
            IGR 5897 2024 RR2
          </Link>
          <Link
            href="/library/search?q=%E0%B4%AA%E0%B4%A3%E0%B4%AF+%E0%B4%AC%E0%B4%BE%E0%B4%A6%E0%B5%8D%E0%B4%A7%E0%B5%8D%E0%B4%AF%E0%B4%A4"
            className="rounded bg-parchment-100 px-2 py-0.5 hover:bg-mudra-100"
          >
            പണയ ബാദ്ധ്യത
          </Link>
          <Link
            href="/library/search?q=%E0%B4%A8%E0%B5%8D%E0%B4%AF%E0%B4%BE%E0%B4%AF%E0%B4%B5%E0%B4%BF%E0%B4%B2"
            className="rounded bg-parchment-100 px-2 py-0.5 hover:bg-mudra-100"
          >
            ന്യായവില (Scanned PDF)
          </Link>
        </div>
      </div>

      {/* Results Header */}
      <div className="mb-4 flex items-center justify-between text-xs text-mudra-700">
        <span>
          Showing <strong>{searchRes.items.length}</strong> of <strong>{searchRes.total}</strong>{' '}
          matching published documents
          {query ? ` for "${query}"` : ''}
        </span>
        <span>
          Page {searchRes.page} of {searchRes.totalPages}
        </span>
      </div>

      <div className="space-y-4">
        {searchRes.items.map((doc) => (
          <DocumentCard key={doc.docId} doc={doc} />
        ))}
      </div>

      {searchRes.totalPages > 1 && (
        <div className="mt-8 flex items-center justify-between rounded-xl border border-mudra-200 bg-white px-4 py-3">
          <span className="text-xs text-mudra-700">
            Page {searchRes.page} of {searchRes.totalPages}
          </span>
          <div className="flex items-center gap-2">
            {searchRes.page > 1 && (
              <Link
                href={buildPageHref(searchRes.page - 1)}
                className="rounded-lg border border-mudra-300 px-3 py-1.5 text-xs font-semibold text-mudra-800 hover:bg-parchment-100"
              >
                Previous
              </Link>
            )}
            {searchRes.page < searchRes.totalPages && (
              <Link
                href={buildPageHref(searchRes.page + 1)}
                className="rounded-lg bg-mudra-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-mudra-700"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
