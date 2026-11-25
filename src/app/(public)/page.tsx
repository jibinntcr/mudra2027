import Link from 'next/link';
import { Lock, ShieldCheck, BookOpen, Search, FileCheck2, ArrowRight, Smartphone } from 'lucide-react';
import { getCurrentUser } from '@/features/auth/session';

/**
 * Public Homepage
 * NOTE: Per Requirement 1 ("Require a valid session before a visitor can see categories, search results,
 * document titles and details, PDF pages, thumbnails, or downloads"), this public homepage intentionally
 * does NOT expose any live category listings, document titles, document numbers, thumbnails, or search results.
 */
export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <div>
      {/* Hero Section with Official Mudra Publications Emblem */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#0b192c] via-[#132743] to-mudra-950 text-parchment-50 py-14 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/10 px-3.5 py-1.5 text-xs font-medium text-amber-300 mb-5">
                <Lock className="h-3.5 w-3.5" />
                <span>Members-Only Kerala Registration &amp; Revenue Reference Archive</span>
              </div>
              <h1 className="font-serif text-3xl sm:text-5xl font-bold tracking-tight text-white leading-tight">
                Mudra Publications Digital Reference Library
              </h1>
              <p className="mt-3 text-base sm:text-xl font-medium text-amber-300">
                മുദ്ര പബ്ലിക്കേഷൻസ് — രജിസ്ട്രേഷൻ &amp; റവന്യൂ ഉത്തരവുകളുടെ ആധികാരിക ശേഖരം
              </p>
              <p className="mt-4 text-sm sm:text-base text-parchment-200 leading-relaxed max-w-2xl">
                An authenticated digital publication portal built for document writers, sub-registrars,
                legal practitioners, and revenue officers across Kerala. Sign in with your Mudra
                subscriber credentials to browse structured collections, search Malayalam and English
                catalogues, and read verified archival PDFs on desktop or mobile.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3.5">
                {user ? (
                  <Link
                    href="/library"
                    className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-6 py-3.5 text-sm font-bold text-mudra-950 shadow-lg hover:bg-amber-400 transition active:scale-95"
                  >
                    <BookOpen className="h-4 w-4" />
                    <span>Enter Protected Library</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-6 py-3.5 text-sm font-bold text-mudra-950 shadow-lg hover:bg-amber-400 transition active:scale-95"
                  >
                    <Lock className="h-4 w-4" />
                    <span>Sign In to Access Library</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
                <Link
                  href="/about"
                  className="inline-flex items-center gap-2 rounded-2xl border border-parchment-300/30 bg-white/10 px-5 py-3.5 text-sm font-semibold text-parchment-100 hover:bg-white/15 transition active:scale-95"
                >
                  <span>About Mudra</span>
                </Link>
              </div>
            </div>

            {/* Official Mudra Brand Crest Showcase Card */}
            <div className="lg:col-span-4 flex justify-center">
              <div className="relative flex flex-col items-center rounded-3xl border border-amber-400/30 bg-white/5 p-7 backdrop-blur-md shadow-2xl text-center max-w-xs w-full">
                <div className="h-28 w-28 sm:h-32 sm:w-32 overflow-hidden rounded-full ring-4 ring-amber-400/70 shadow-2xl bg-[#0b192c]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/mudrapublications_logo.jpeg"
                    alt="Mudra Publications Emblem"
                    width={128}
                    height={128}
                    className="h-full w-full object-cover scale-105"
                  />
                </div>
                <p className="mt-4 font-serif text-lg font-bold text-white">
                  MUDRA PUBLICATIONS
                </p>
                <p className="text-xs text-amber-300 font-medium">
                  മുദ്ര പബ്ലിക്കേഷൻസ് • കേരളം
                </p>
                <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-400/30 px-3 py-1 text-[11px] font-semibold text-emerald-300">
                  <Smartphone className="h-3.5 w-3.5" />
                  <span>Mobile-Ready Progressive Reader</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Capability Highlights (No protected categories or document titles exposed to signed-out visitors) */}
      <section className="py-12 sm:py-20 bg-parchment-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-mudra-950">
              Built for Precision Legal &amp; Registration Research
            </h2>
            <p className="mt-2.5 text-sm text-mudra-700">
              All categories, document titles, search results, and PDF streams are strictly protected
              behind subscriber authentication.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="rounded-2xl border border-mudra-200 bg-white p-6 shadow-xs">
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-mudra-100 text-mudra-800">
                <Search className="h-5 w-5" />
              </div>
              <h3 className="font-serif text-lg font-bold text-mudra-950">
                Malayalam, English &amp; Order Number Lookup
              </h3>
              <p className="mt-2 text-sm text-mudra-700 leading-relaxed">
                Normalized document-number indexing resolves punctuation and spacing variants
                automatically while ranking exact matches first alongside bilingual Malayalam and
                English search.
              </p>
            </div>

            <div className="rounded-2xl border border-mudra-200 bg-white p-6 shadow-xs">
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-mudra-100 text-mudra-800">
                <FileCheck2 className="h-5 w-5" />
              </div>
              <h3 className="font-serif text-lg font-bold text-mudra-950">
                Mudra-Branded Mobile &amp; Desktop PDF Reader
              </h3>
              <p className="mt-2 text-sm text-mudra-700 leading-relaxed">
                Read both text-based and scanned archival PDFs directly in the browser with HTTP
                byte-range streaming, swipe and touch navigation on mobile, and authenticated downloads.
              </p>
            </div>

            <div className="rounded-2xl border border-mudra-200 bg-white p-6 shadow-xs">
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-mudra-100 text-mudra-800">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="font-serif text-lg font-bold text-mudra-950">
                Managed Subscriber Access
              </h3>
              <p className="mt-2 text-sm text-mudra-700 leading-relaxed">
                Public registration is disabled. Accounts are provisioned by Mudra administrators
                with mandatory first-login password updates and instant session revocation.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
