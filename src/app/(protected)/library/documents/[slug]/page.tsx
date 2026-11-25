import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireServerUser } from '@/features/auth/session';
import { getDocumentBySlugOrId } from '@/features/documents/service';
import MudraPdfReader from '@/features/reader/MudraPdfReader';
import {
  ChevronRight,
  Calendar,
  Download,
  FileText,
  ScanLine,
  Hash,
  Layers,
  Tag,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Requirement 1: If a signed-out visitor opens a shared document link, send them to Login
  // and return them to that document after successful sign-in.
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
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
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

      {/* Metadata Header Card */}
      <div className="rounded-2xl border border-mudra-200 bg-white p-6 shadow-sm mb-6">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="space-y-2.5 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-md bg-mudra-900 px-3 py-1 font-mono text-xs font-bold text-amber-300">
                <Hash className="h-3.5 w-3.5" />
                {document.documentNumber}
              </span>
              <span className="inline-flex items-center rounded-md bg-parchment-100 border border-mudra-200 px-2.5 py-1 font-mono text-[11px] text-mudra-700">
                Normalized: {document.normalizedDocNumber}
              </span>
              {document.documentDateText && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-mudra-700">
                  <Calendar className="h-3.5 w-3.5" />
                  Dated {document.documentDateText}
                </span>
              )}
              {document.hasTextLayer ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                  <FileText className="h-3.5 w-3.5" />
                  Text-Layer Indexed PDF
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs font-semibold text-amber-900">
                  <ScanLine className="h-3.5 w-3.5" />
                  Scanned Archive PDF (Catalogue Indexed)
                </span>
              )}
            </div>

            <h1 className="font-serif text-xl sm:text-2xl font-bold text-mudra-950 leading-snug">
              {document.titleMl || document.titleEn}
            </h1>

            {document.titleMl && document.titleEn && document.titleMl !== document.titleEn && (
              <p className="text-sm font-medium text-mudra-700">{document.titleEn}</p>
            )}

            <p className="text-xs sm:text-sm text-mudra-800 leading-relaxed pt-1">
              {document.summaryMl}
            </p>
            {document.summaryEn && document.summaryEn !== document.summaryMl && (
              <p className="text-xs text-mudra-600 leading-relaxed">{document.summaryEn}</p>
            )}

            {/* Assigned Categories (Multiple categories pointing to one canonical record & reader URL) */}
            <div className="pt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-mudra-700">
                <Layers className="h-3.5 w-3.5" /> Categories:
              </span>
              {categories.map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/library/categories/${cat.slug}`}
                  className="rounded-lg bg-mudra-50 border border-mudra-200 px-2.5 py-1 text-xs font-medium text-mudra-900 hover:bg-mudra-100"
                >
                  {cat.pathLabel}
                </Link>
              ))}
            </div>
          </div>

          {/* Right Action Box */}
          <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between gap-3 shrink-0 border-t lg:border-t-0 pt-4 lg:pt-0 border-mudra-100">
            <a
              href={`/api/documents/${encodeURIComponent(document.docId)}/download`}
              className="inline-flex items-center gap-2 rounded-xl bg-mudra-800 px-5 py-3 text-xs font-bold text-white hover:bg-mudra-700 transition shadow"
            >
              <Download className="h-4 w-4" />
              <span>Download Authenticated PDF</span>
            </a>
            <div className="text-right text-[11px] text-mudra-600 font-mono">
              <div>Record ID: {document.docId}</div>
              <div>
                Version: v{document.currentVersion} • {currentFile?.pageCount || 1} Pages •{' '}
                {Math.max(1, Math.round((currentFile?.fileSize || 1024) / 1024))} KB
              </div>
              <div>Storage Key: {currentFile?.storageKey}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Reader + Sidebar */}
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
          {/* Keywords */}
          <div className="rounded-2xl border border-mudra-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-1.5 font-serif text-sm font-bold text-mudra-950 mb-3">
              <Tag className="h-4 w-4 text-mudra-700" />
              Indexed Catalogue Terms
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {document.keywords.map((kw) => (
                <Link
                  key={kw}
                  href={`/library/search?q=${encodeURIComponent(kw)}`}
                  className="rounded-md bg-parchment-100 border border-mudra-200 px-2.5 py-1 text-xs text-mudra-800 hover:bg-mudra-100"
                >
                  {kw}
                </Link>
              ))}
            </div>
          </div>

          {/* Related Orders */}
          <div className="rounded-2xl border border-mudra-200 bg-white p-5 shadow-sm">
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
