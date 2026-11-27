import Link from 'next/link';
import { requireServerUser } from '@/features/auth/session';
import { getCategoryTree } from '@/features/categories/service';
import { searchLibraryDocuments } from '@/features/search/service';
import { ensureDefaultPublishedQuiz } from '@/features/quiz/service';
import { DocumentCard } from '@/features/documents/DocumentCard';
import { Search, FolderTree, ChevronRight, BookOpen, AlertTriangle } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function LibraryHomePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; error?: string }>;
}) {
  await requireServerUser({ returnTo: '/library' });
  await ensureDefaultPublishedQuiz();
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page || '1', 10) || 1);

  const [categoryTree, recentDocs] = await Promise.all([
    getCategoryTree(false),
    searchLibraryDocuments({
      page,
      limit: 10,
      includeUnpublished: false,
    }),
  ]);

  const allSubcategories = categoryTree.flatMap((root) => root.children);

  return (
    <div className="mx-auto max-w-7xl px-3.5 sm:px-6 lg:px-8 py-5 sm:py-8">
      {sp.error === 'forbidden' && (
        <div className="mb-5 flex items-center gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs font-medium text-amber-900">
          <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0" />
          <span>Access denied: Administrator privileges are required for that section.</span>
        </div>
      )}

      {/* Branded Search Banner with Official Mudra Publications Emblem */}
      <div className="rounded-3xl bg-gradient-to-r from-[#0b192c] via-[#132743] to-[#0b192c] p-5 sm:p-8 text-parchment-50 shadow-xl mb-6 border border-white/10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3 mb-2.5">
              <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-[#0b192c] ring-2 ring-amber-400 shadow-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/mudrapublications_logo.jpeg"
                  alt="Mudra Publications Logo"
                  width={44}
                  height={44}
                  className="h-full w-full object-cover scale-105"
                />
              </div>
              <div>
                <span className="block text-[11px] font-bold uppercase tracking-wider text-amber-300">
                  Eaadharam-Inspired Kerala Registration Archive
                </span>
                <h1 className="font-serif text-xl sm:text-3xl font-bold text-white leading-tight">
                  Mudra Digital Library (മുദ്ര ഡിജിറ്റൽ ലൈബ്രറി)
                </h1>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-parchment-200 leading-relaxed">
              Search in Malayalam or English by order number (e.g.,{' '}
              <code className="text-amber-300 font-mono">IGR/5897/2024-RR2</code> or{' '}
              <code className="text-amber-300 font-mono">IGR 5897 2024 RR2</code>), Malayalam subject
              (<code className="text-amber-300">പണയ ബാദ്ധ്യത</code>,{' '}
              <code className="text-amber-300">ന്യായവില</code>), or keywords.
            </p>
          </div>
        </div>

        <form action="/library/search" method="GET" className="mt-4 flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-mudra-500" />
            <input
              type="text"
              name="q"
              placeholder="Search order no. (IGR/5897/2024-RR2), Malayalam title, or keyword…"
              className="w-full rounded-2xl border-0 bg-white pl-10 pr-4 py-3 text-base sm:text-sm text-mudra-950 placeholder:text-mudra-400 focus:ring-2 focus:ring-amber-400 focus:outline-none shadow-inner"
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-500 px-6 py-3 text-sm font-bold text-mudra-950 hover:bg-amber-400 transition shadow-md active:scale-95"
          >
            <Search className="h-4 w-4" />
            <span>Search Library</span>
          </button>
        </form>
      </div>

      {/* Mobile App Horizontal Swipeable Category Pill Strip */}
      <div className="lg:hidden mb-6">
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-xs font-bold uppercase tracking-wider text-mudra-700">
            Quick Categories
          </span>
          <span className="text-[11px] text-mudra-500">Swipe →</span>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1.5">
          {allSubcategories.map((sub) => (
            <Link
              key={sub.slug}
              href={`/library/categories/${sub.slug}`}
              className="shrink-0 inline-flex items-center gap-2 rounded-2xl border border-mudra-200 bg-white px-3.5 py-2 text-xs font-semibold text-mudra-900 shadow-2xs active:scale-95"
            >
              <span>{sub.nameEn}</span>
              <span className="rounded-full bg-mudra-100 px-2 py-0.5 font-mono text-[10px] font-bold text-mudra-800">
                {sub.documentCount}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* Main Two-Column Layout: Eaadharam Category Hierarchy + Paginated Document Feed */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left Column: Hierarchical Categories & Subcategories */}
        <aside className="hidden lg:block lg:col-span-4 space-y-5">
          <div className="rounded-2xl border border-mudra-200 bg-white p-5 shadow-xs">
            <div className="flex items-center gap-2 border-b border-mudra-100 pb-3 mb-4">
              <FolderTree className="h-5 w-5 text-mudra-700" />
              <h2 className="font-serif text-base font-bold text-mudra-950">
                Library Categories
              </h2>
            </div>

            <div className="space-y-4">
              {categoryTree.map((rootCat) => (
                <div key={rootCat.slug} className="rounded-xl border border-mudra-100 bg-parchment-50/60 p-3.5">
                  <Link
                    href={`/library/categories/${rootCat.slug}`}
                    className="flex items-center justify-between font-serif text-sm font-bold text-mudra-950 hover:text-mudra-700"
                  >
                    <div>
                      <span>{rootCat.nameEn}</span>
                      {rootCat.nameMl && (
                        <span className="block text-xs font-sans font-normal text-mudra-700">
                          {rootCat.nameMl}
                        </span>
                      )}
                    </div>
                    <span className="rounded-full bg-mudra-200/70 px-2 py-0.5 text-xs font-mono text-mudra-900">
                      {rootCat.documentCount}
                    </span>
                  </Link>

                  {rootCat.children.length > 0 && (
                    <ul className="mt-2.5 space-y-1 border-l-2 border-mudra-200 pl-3">
                      {rootCat.children.map((sub) => (
                        <li key={sub.slug}>
                          <Link
                            href={`/library/categories/${sub.slug}`}
                            className="flex items-center justify-between rounded-lg px-2 py-1.5 text-xs text-mudra-800 hover:bg-mudra-100/80 transition"
                          >
                            <span className="flex items-center gap-1.5 font-medium">
                              <ChevronRight className="h-3 w-3 text-mudra-500" />
                              <span>{sub.nameEn}</span>
                              {sub.nameMl && (
                                <span className="text-[11px] text-mudra-600">
                                  ({sub.nameMl.split('(')[0].trim()})
                                </span>
                              )}
                            </span>
                            <span className="font-mono text-[11px] font-semibold text-mudra-700">
                              {sub.documentCount}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Right Column: Server-Side Paginated Published Documents */}
        <section className="lg:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-mudra-700" />
              <h2 className="font-serif text-lg font-bold text-mudra-950">
                Published Rulings &amp; Orders
              </h2>
            </div>
            <span className="text-xs text-mudra-700">
              Page <strong>{recentDocs.page}</strong> of{' '}
              <strong>{recentDocs.totalPages}</strong> ({recentDocs.total} documents)
            </span>
          </div>

          <div className="space-y-3.5">
            {recentDocs.items.map((doc) => (
              <DocumentCard key={doc.docId} doc={doc} />
            ))}
          </div>

          {/* Server-Side Pagination Controls */}
          {recentDocs.totalPages > 1 && (
            <div className="mt-7 flex items-center justify-between rounded-2xl border border-mudra-200 bg-white px-4 py-3 shadow-2xs">
              <span className="text-xs text-mudra-700">
                Page {recentDocs.page} of {recentDocs.totalPages}
              </span>
              <div className="flex items-center gap-2">
                {recentDocs.page > 1 && (
                  <Link
                    href={`/library?page=${recentDocs.page - 1}`}
                    className="rounded-xl border border-mudra-300 px-3.5 py-2 text-xs font-semibold text-mudra-800 hover:bg-parchment-100 active:scale-95"
                  >
                    Previous
                  </Link>
                )}
                {recentDocs.page < recentDocs.totalPages && (
                  <Link
                    href={`/library?page=${recentDocs.page + 1}`}
                    className="rounded-xl bg-[#0b192c] px-4 py-2 text-xs font-bold text-amber-300 hover:bg-mudra-900 active:scale-95"
                  >
                    Next Page
                  </Link>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
