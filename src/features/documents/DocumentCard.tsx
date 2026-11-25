import Link from 'next/link';
import { FileText, ScanLine, Calendar, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import type { SearchLibraryResultItem } from '@/features/search/service';

export function DocumentCard({ doc }: { doc: SearchLibraryResultItem }) {
  return (
    <div
      className="group flex flex-col sm:flex-row gap-4 rounded-2xl border border-mudra-200/90 bg-white p-4 shadow-2xs hover:border-mudra-400 hover:shadow-md transition"
      data-testid="document-card"
    >
      {/* Authenticated Thumbnail Preview */}
      <Link
        href={`/library/documents/${doc.slug}`}
        className="shrink-0 self-start overflow-hidden rounded-xl border border-mudra-200 bg-parchment-100 w-24 h-32 hidden sm:block shadow-2xs"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/documents/${encodeURIComponent(doc.docId)}/thumbnail`}
          alt={doc.documentNumber}
          className="h-full w-full object-cover group-hover:scale-105 transition duration-200"
          loading="lazy"
          decoding="async"
        />
      </Link>

      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-2">
            {/* Mobile Brand Seal + Document Number Pill */}
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#0b192c] px-2.5 py-1 font-mono text-xs font-bold text-amber-300 shadow-2xs">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/mudrapublications_logo.jpeg"
                alt=""
                width={16}
                height={16}
                className="h-4 w-4 rounded-full object-cover ring-1 ring-amber-400/70 sm:hidden"
              />
              {doc.documentNumber}
            </span>

            {doc.exactNumberMatch && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 border border-emerald-300 px-2 py-0.5 text-[11px] font-bold text-emerald-900">
                <CheckCircle2 className="h-3 w-3 text-emerald-700" />
                Exact Match
              </span>
            )}

            {doc.documentDateText && (
              <span className="inline-flex items-center gap-1 text-xs text-mudra-600">
                <Calendar className="h-3 w-3" />
                {doc.documentDateText}
              </span>
            )}

            {doc.hasTextLayer ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                <FileText className="h-3 w-3" />
                Text PDF ({doc.pageCount}p)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                <ScanLine className="h-3 w-3" />
                Scanned PDF ({doc.pageCount}p)
              </span>
            )}
          </div>

          <Link
            href={`/library/documents/${doc.slug}`}
            className="block font-semibold text-base text-mudra-950 group-hover:text-mudra-700 leading-snug"
          >
            {doc.titleMl || doc.titleEn}
          </Link>

          {doc.titleMl && doc.titleEn && doc.titleMl !== doc.titleEn && (
            <p className="mt-1 text-xs font-medium text-mudra-700">{doc.titleEn}</p>
          )}

          <p className="mt-2 text-xs text-mudra-700 line-clamp-2 leading-relaxed">
            {doc.matchSnippet || doc.summaryMl || doc.summaryEn}
          </p>
        </div>

        <div className="mt-3.5 pt-2.5 border-t border-mudra-100 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {doc.categorySlugs.map((catSlug) => (
              <Link
                key={catSlug}
                href={`/library/categories/${catSlug}`}
                className="rounded-lg bg-parchment-100 border border-mudra-200 px-2.5 py-1 text-[11px] font-medium text-mudra-800 hover:bg-mudra-100 active:scale-95"
              >
                {catSlug}
              </Link>
            ))}
          </div>

          <Link
            href={`/library/documents/${doc.slug}`}
            className="inline-flex items-center gap-1 rounded-xl bg-mudra-50 border border-mudra-200 px-3 py-1.5 text-xs font-bold text-mudra-900 hover:bg-mudra-100 active:scale-95"
          >
            <span>Open Reader</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
