import Link from 'next/link';
import { BookOpen, Shield, FileText, Lock } from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:py-14 sm:px-6 lg:px-8">
      <div className="rounded-3xl border border-mudra-200 bg-white p-6 sm:p-12 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5 pb-6 border-b border-mudra-100">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full bg-[#0b192c] ring-4 ring-amber-400/70 shadow-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/mudrapublications_logo.jpeg"
              alt="Mudra Publications Official Logo"
              width={80}
              height={80}
              className="h-full w-full object-cover scale-105"
            />
          </div>
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-mudra-100 px-3 py-1 text-xs font-semibold text-mudra-800">
              About Mudra Publications
            </span>
            <h1 className="mt-2 font-serif text-2xl sm:text-3xl font-bold text-mudra-950">
              Preserving &amp; Indexing Kerala&apos;s Registration &amp; Revenue Rulings
            </h1>
            <p className="mt-1 text-sm sm:text-base font-medium text-mudra-700">
              മുദ്ര പബ്ലിക്കേഷൻസ് — ആധാരമെഴുത്തുകാർക്കും രജിസ്ട്രേഷൻ ഉദ്യോഗസ്ഥർക്കും നിയമവിദഗ്ദ്ധർക്കുമുള്ള ഡിജിറ്റൽ റഫറൻസ് ലൈബ്രറി
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-4 text-sm text-mudra-800 leading-relaxed">
          <p>
            Mudra Publications curates, indexes, and maintains an authoritative digital archive of
            orders, circulars, and statutory notifications governing document registration, stamp duty
            determination, fair value revisions, and department service matters in Kerala.
          </p>
          <p>
            Inspired by the Eaadharam reference tradition, our platform organizes rulings across
            hierarchical categories and subcategories while providing fast bilingual search in both
            Malayalam and English, normalized order-number matching, and a private progressive PDF.js
            reader optimized for both desktop and mobile devices.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-3">
          <div className="rounded-2xl bg-parchment-50 p-5 border border-mudra-200">
            <BookOpen className="h-5 w-5 text-mudra-700 mb-2" />
            <h3 className="font-semibold text-sm text-mudra-950">Structured Hierarchy</h3>
            <p className="mt-1 text-xs text-mudra-700 leading-relaxed">
              Cross-referenced categories allow a single ruling to appear under multiple relevant
              topics while retaining one canonical record and reader URL.
            </p>
          </div>
          <div className="rounded-2xl bg-parchment-50 p-5 border border-mudra-200">
            <FileText className="h-5 w-5 text-mudra-700 mb-2" />
            <h3 className="font-semibold text-sm text-mudra-950">Text &amp; Scanned Archives</h3>
            <p className="mt-1 text-xs text-mudra-700 leading-relaxed">
              Both modern text-layer PDFs and historical scanned gazette orders remain searchable
              through our bilingual Malayalam and English catalogue metadata.
            </p>
          </div>
          <div className="rounded-2xl bg-parchment-50 p-5 border border-mudra-200">
            <Shield className="h-5 w-5 text-mudra-700 mb-2" />
            <h3 className="font-semibold text-sm text-mudra-950">Protected Delivery</h3>
            <p className="mt-1 text-xs text-mudra-700 leading-relaxed">
              Every category listing, search query, thumbnail, PDF stream, and download is verified
              on the server against active subscriber sessions.
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-[#0b192c] p-6 text-parchment-100">
          <div>
            <h3 className="font-serif text-base font-bold text-white">
              Already have a Mudra Subscriber Login ID?
            </h3>
            <p className="mt-1 text-xs text-parchment-200">
              Sign in to browse the full category tree and read published documents.
            </p>
          </div>
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-xs font-bold text-mudra-950 hover:bg-amber-400 transition shrink-0"
          >
            <Lock className="h-3.5 w-3.5" />
            <span>Sign In</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
