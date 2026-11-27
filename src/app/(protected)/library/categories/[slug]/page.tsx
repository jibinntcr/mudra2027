import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireServerUser } from '@/features/auth/session';
import { getCategoryBySlug } from '@/features/categories/service';
import { searchLibraryDocuments } from '@/features/search/service';
import { ensureDefaultPublishedQuiz } from '@/features/quiz/service';
import { DocumentCard } from '@/features/documents/DocumentCard';
import { ChevronRight, FolderOpen, Search, Trophy } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function CategoryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string; year?: string; q?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  await requireServerUser({ returnTo: `/library/categories/${slug}` });
  await ensureDefaultPublishedQuiz();

  const page = Math.max(1, parseInt(sp.page || '1', 10) || 1);
  const year = sp.year && /^\d{4}$/.test(sp.year) ? parseInt(sp.year, 10) : null;
  const query = (sp.q || '').trim();

  const { category, subcategories, parent } = await getCategoryBySlug(slug, false);
  if (!category) {
    notFound();
  }

  const searchRes = await searchLibraryDocuments({
    categorySlug: slug,
    query,
    year,
    page,
    limit: 6, // Server-side pagination across category listings
    includeUnpublished: false,
  });

  const buildPageHref = (targetPage: number) => {
    const u = new URLSearchParams();
    u.set('page', String(targetPage));
    if (query) u.set('q', query);
    if (year) u.set('year', String(year));
    return `/library/categories/${slug}?${u.toString()}`;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Breadcrumb Hierarchy e.g. Library -> LRC Orders -> Sale */}
      <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-mudra-700">
        <Link href="/library" className="hover:text-mudra-950 font-medium">
          Library
        </Link>
        {parent && (
          <>
            <ChevronRight className="h-3.5 w-3.5 text-mudra-400" />
            <Link href={`/library/categories/${parent.slug}`} className="hover:text-mudra-950 font-medium">
              {parent.nameEn}
            </Link>
          </>
        )}
        <ChevronRight className="h-3.5 w-3.5 text-mudra-400" />
        <span className="font-bold text-mudra-950">{category.nameEn}</span>
      </nav>

      {/* Category Header */}
      <div className="rounded-2xl border border-mudra-200 bg-white p-6 shadow-sm mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-mudra-100 px-2.5 py-1 text-xs font-semibold text-mudra-800">
              <FolderOpen className="h-3.5 w-3.5" />
              {category.pathLabel}
            </span>
            <h1 className="mt-2 font-serif text-2xl sm:text-3xl font-bold text-mudra-950">
              {category.nameEn}
            </h1>
            {category.nameMl && (
              <p className="mt-1 text-base font-medium text-mudra-700">{category.nameMl}</p>
            )}
            {category.description && (
              <p className="mt-2 text-xs sm:text-sm text-mudra-600 max-w-3xl">
                {category.description}
              </p>
            )}
          </div>

          <form
            action={`/library/categories/${slug}`}
            method="GET"
            className="flex flex-wrap items-center gap-2"
          >
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-mudra-500" />
              <input
                type="text"
                name="q"
                defaultValue={query}
                placeholder="Filter inside category…"
                className="rounded-lg border border-mudra-300 bg-parchment-50 pl-8 pr-3 py-1.5 text-xs text-mudra-950"
              />
            </div>
            <select
              name="year"
              defaultValue={year ? String(year) : ''}
              className="rounded-lg border border-mudra-300 bg-parchment-50 px-2.5 py-1.5 text-xs text-mudra-950"
            >
              <option value="">All Years</option>
              {searchRes.availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-lg bg-mudra-800 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-mudra-700"
            >
              Apply
            </button>
          </form>
        </div>

        {/* Subcategories Pill Bar if Top-Level Category */}
        {subcategories.length > 0 && (
          <div className="mt-5 pt-4 border-t border-mudra-100">
            <p className="text-xs font-semibold uppercase tracking-wider text-mudra-600 mb-2.5">
              Subcategories under {category.nameEn}
            </p>
            <div className="flex flex-wrap gap-2">
              {subcategories.map((sub) => (
                <Link
                  key={sub.slug}
                  href={`/library/categories/${sub.slug}`}
                  className="inline-flex items-center gap-2 rounded-lg border border-mudra-200 bg-parchment-50 px-3 py-1.5 text-xs font-medium text-mudra-900 hover:bg-mudra-100 transition"
                >
                  <span>{sub.nameEn}</span>
                  {sub.nameMl && (
                    <span className="text-mudra-600">({sub.nameMl.split('(')[0].trim()})</span>
                  )}
                  <span className="rounded bg-mudra-200/80 px-1.5 py-0.5 font-mono text-[10px] font-bold">
                    {sub.documentCount}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Results Count */}
      <div className="mb-4 flex items-center justify-between text-xs text-mudra-700">
        <span>
          Found <strong>{searchRes.total}</strong> published documents in{' '}
          <strong>{category.pathLabel}</strong>
        </span>
        <span>
          Page {searchRes.page} of {searchRes.totalPages}
        </span>
      </div>

      {/* Document Cards */}
      {searchRes.items.length === 0 ? (
        <div className="rounded-2xl border border-mudra-200 bg-white p-12 text-center space-y-3">
          {slug === 'aadharam-ezhuthu-exam' ? (
            <>
              <p className="font-serif text-lg font-bold text-mudra-950">
                Aadharam Ezhuthu Exam (ആധാരമെഴുത്ത് പരീക്ഷ) — 100 Bilingual MCQs Ready in Quiz Arena
              </p>
              <p className="text-xs text-mudra-700 max-w-xl mx-auto">
                Practice the complete 100-question Deed Writing Licensing Exam (Registration Act 1908, Kerala Stamp Act 1959, Document Writers’ Licence Rules 1960, Property Transfers &amp; PEARL Online Services) in Live Room <strong className="font-mono">AAD100</strong> or Self-Paced mode.
              </p>
              <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/quiz?code=AAD100"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#0b192c] px-5 py-2.5 text-xs font-black text-amber-300 hover:bg-mudra-900 shadow"
                >
                  <Trophy className="h-4 w-4" />
                  <span>Open Aadharam Ezhuthu 100-MCQ Quiz Arena</span>
                </Link>
              </div>
            </>
          ) : (
            <>
              <p className="font-serif text-base font-bold text-mudra-900">
                No matching documents found in this category
              </p>
              <p className="mt-1 text-xs text-mudra-600">
                Try clearing the year or search filter, or browse another subcategory.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {searchRes.items.map((doc) => (
            <DocumentCard key={doc.docId} doc={doc} />
          ))}
        </div>
      )}

      {/* Server-Side Pagination */}
      {searchRes.totalPages > 1 && (
        <div
          className="mt-8 flex items-center justify-between rounded-xl border border-mudra-200 bg-white px-4 py-3"
          data-testid="category-pagination"
        >
          <span className="text-xs text-mudra-700">
            Page <strong>{searchRes.page}</strong> of <strong>{searchRes.totalPages}</strong> (
            {searchRes.total} total)
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
