import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireServerUser } from '@/features/auth/session';
import { getDocumentBySlugOrId } from '@/features/documents/service';
import MudraPdfReader from '@/features/reader/MudraPdfReader';
import {
  ChevronRight,
  Calendar,
  Download,
  Hash,
  Layers,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const user = await requireServerUser({
    returnTo: `/library/documents/${slug}`,
  });

  const { document, categories, relatedDocuments } = await getDocumentBySlugOrId(
    slug,
    user.role === 'admin'
  );

  if (!document) {
    notFound();
  }

  const currentFile =
    document.versions.find((v) => v.version === document.currentVersion) ||
    document.versions[document.versions.length - 1];

  return (
    <div className="mx-auto max-w-7xl px-3.5 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Breadcrumb */}
      <nav className="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-mudra-700">
        <Link href="/library" className="hover:text-mudra-950 font-medium">
          Library
        </Link>
        {categories[0] && (
          <>
            <ChevronRight className="h-3.5 w-3.5 text-mudra-400" />
            <Link
              href={`/library/categories/${categories[0].slug}`}
              className="hover:text-mudra-950 font-medium"
            >
              {categories[0].pathLabel}
            </Link>
          </>
        )}
        <ChevronRight className="h-3.5 w-3.5 text-mudra-400" />
        <span className="font-mono font-bold text-mudra-950">{document.documentNumber}</span>
      </nav>

      {/* Clean Document Header Card */}
      <div className="rounded-2xl border border-mudra-200 bg-white p-5 sm:p-6 shadow-xs mb-6">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
          <div className="space-y-2.5 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-lg bg-[#0b192c] px-3 py-1 font-mono text-xs font-bold text-amber-300">
                <Hash className="h-3.5 w-3.5" />
                {document.documentNumber}
              </span>
              {document.documentDateText && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-mudra-700">
                  <Calendar className="h-3.5 w-3.5" />
                  Dated {document.documentDateText}
                </span>
              )}
            </div>

            <h1 className="font-serif text-lg sm:text-2xl font-bold text-mudra-950 leading-snug">
              {document.titleMl || document.titleEn}
            </h1>

            {document.summaryMl && document.summaryMl !== document.titleMl && (
              <p className="text-xs sm:text-sm text-mudra-800 leading-relaxed pt-1">
                {document.summaryMl}
              </p>
            )}

            {/* Assigned Categories */}
            <div className="pt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-mudra-700">
                <Layers className="h-3.5 w-3.5" /> Categories:
              </span>
              {categories.map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/library/categories/${cat.slug}`}
                  className="rounded-lg bg-parchment-100 border border-mudra-200 px-2.5 py-1 text-xs font-medium text-mudra-900 hover:bg-mudra-100"
                >
                  {cat.pathLabel}
                </Link>
              ))}
            </div>
          </div>

          {/* Right Download Action */}
          <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between gap-2 shrink-0 border-t lg:border-t-0 pt-3 lg:pt-0 border-mudra-100">
            <a
              href={`/api/documents/${encodeURIComponent(document.docId)}/download`}
              className="inline-flex items-center gap-2 rounded-xl bg-[#0b192c] px-5 py-3 text-xs font-bold text-amber-300 hover:bg-mudra-900 transition shadow"
            >
              <Download className="h-4 w-4" />
              <span>Download Original PDF</span>
            </a>
          </div>
        </div>
      </div>

      {/* Main Reader + Related Sidebar */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="lg:col-span-9">
          <MudraPdfReader
            docId={document.docId}
            slug={document.slug}
            documentNumber={document.documentNumber}
            titleMl={document.titleMl}
            titleEn={document.titleEn}
            hasTextLayer={document.hasTextLayer}
            initialPageCount={currentFile?.pageCount || 1}
            currentVersion={document.currentVersion}
          />
        </div>

        <aside className="lg:col-span-3 space-y-6">
          {/* Related Orders */}
          <div className="rounded-2xl border border-mudra-200 bg-white p-5 shadow-xs">
            <h2 className="font-serif text-sm font-bold text-mudra-950 mb-3">
              Related Orders in Category
            </h2>
            <ul className="space-y-3">
              {relatedDocuments.map((rel) => (
                <li key={rel.docId} className="border-b border-mudra-100 pb-2.5 last:border-b-0">
                  <Link
                    href={`/library/documents/${rel.slug}`}
                    className="block text-xs font-bold font-mono text-mudra-800 hover:text-mudra-600"
                  >
                    {rel.documentNumber}
                  </Link>
                  <p className="mt-0.5 text-xs text-mudra-700 line-clamp-2">
                    {rel.titleMl || rel.titleEn}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
