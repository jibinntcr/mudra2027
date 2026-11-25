'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Search,
  FolderTree,
  Shield,
  LogIn,
  Info,
  Phone,
  X,
  ChevronRight,
  LogOut,
  BookOpen,
} from 'lucide-react';
import { MudraBrandLogo } from '@/components/brand/MudraBrandLogo';

interface MobileBottomNavProps {
  mode: 'public' | 'protected' | 'admin';
  userRole?: 'reader' | 'admin';
  userDisplayName?: string;
  userLoginId?: string;
}

const QUICK_CATEGORIES = [
  { slug: 'lrc-orders', nameEn: 'LRC Orders (All)', nameMl: 'എൽ.ആർ.സി ഉത്തരവുകൾ' },
  { slug: 'lrc-orders-sale', nameEn: 'LRC Orders → Sale', nameMl: 'തീറാധാരം (Sale)' },
  { slug: 'lrc-orders-settlement', nameEn: 'LRC Orders → Settlement', nameMl: 'ധനനിശ്ചയാധാരം' },
  { slug: 'lrc-orders-release', nameEn: 'LRC Orders → Release', nameMl: 'ഒഴിമുറി' },
  { slug: 'lrc-orders-partition', nameEn: 'LRC Orders → Partition', nameMl: 'ഭാഗപത്രം' },
  { slug: 'lrc-orders-gift', nameEn: 'LRC Orders → Gift', nameMl: 'ഇഷ്ടദാനം' },
  { slug: 'lrc-orders-rectification', nameEn: 'LRC Orders → Rectification', nameMl: 'പിഴതിരുത്തൽ' },
  { slug: 'registration-stamp-duty', nameEn: 'Registration → SD & Reg. Fee', nameMl: 'മുദ്രവില & ഫീസ്' },
  { slug: 'registration-fair-value', nameEn: 'Registration → Fair Value', nameMl: 'ന്യായവില' },
  { slug: 'registration-court-orders', nameEn: 'Registration → Court Orders', nameMl: 'കോടതി ഉത്തരവുകൾ' },
  { slug: 'service-gos-circulars', nameEn: 'Service → GOs & Circulars', nameMl: 'സർക്കാർ ഉത്തരവുകൾ' },
  { slug: 'acts-statutory-rules', nameEn: 'Acts & Statutory Rules', nameMl: 'നിയമങ്ങളും ചട്ടങ്ങളും' },
];

/**
 * Native Mobile App-Style Bottom Navigation Bar & Slide-Up Category Sheet
 * Appears on mobile screens (`md:hidden`) with safe-area padding, active tab pills, and touch feedback.
 */
export function MobileBottomNav({
  mode,
  userRole,
  userDisplayName,
  userLoginId,
}: MobileBottomNavProps) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (mode === 'public') {
    return (
      <nav
        aria-label="Mobile App Navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-mudra-200/80 bg-white/95 backdrop-blur-lg shadow-[0_-4px_20px_rgba(0,0,0,0.08)] pb-[env(safe-area-inset-bottom)]"
      >
        <div className="grid grid-cols-4 h-16">
          <Link
            href="/"
            className={`flex flex-col items-center justify-center gap-1 text-[11px] font-semibold transition active:scale-95 ${
              pathname === '/' ? 'text-mudra-800' : 'text-mudra-500'
            }`}
          >
            <Home className="h-5 w-5" />
            <span>Home</span>
          </Link>
          <Link
            href="/about"
            className={`flex flex-col items-center justify-center gap-1 text-[11px] font-semibold transition active:scale-95 ${
              pathname === '/about' ? 'text-mudra-800' : 'text-mudra-500'
            }`}
          >
            <Info className="h-5 w-5" />
            <span>About</span>
          </Link>
          <Link
            href="/contact"
            className={`flex flex-col items-center justify-center gap-1 text-[11px] font-semibold transition active:scale-95 ${
              pathname === '/contact' ? 'text-mudra-800' : 'text-mudra-500'
            }`}
          >
            <Phone className="h-5 w-5" />
            <span>Contact</span>
          </Link>
          <Link
            href="/login"
            className={`flex flex-col items-center justify-center gap-1 text-[11px] font-bold transition active:scale-95 ${
              pathname === '/login'
                ? 'text-amber-600'
                : 'text-mudra-900'
            }`}
          >
            <div className="flex h-7 w-12 items-center justify-center rounded-full bg-mudra-900 text-amber-300">
              <LogIn className="h-4 w-4" />
            </div>
            <span>Sign In</span>
          </Link>
        </div>
      </nav>
    );
  }

  const isLibraryHome = pathname === '/library';
  const isSearch = pathname.startsWith('/library/search');
  const isCategories = pathname.startsWith('/library/categories');
  const isAdmin = pathname.startsWith('/admin');

  return (
    <>
      {/* Slide-Up Mobile App Category & Account Sheet */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-xs">
          <div className="max-h-[82vh] w-full rounded-t-3xl bg-white shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200">
            {/* Sheet Drag Handle & Header */}
            <div className="bg-[#0b192c] text-white px-5 pt-3 pb-4">
              <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-white/25" />
              <div className="flex items-center justify-between">
                <MudraBrandLogo
                  size="sm"
                  theme="dark"
                  subtitle={userDisplayName ? `${userDisplayName} (${userLoginId})` : 'Quick Categories'}
                />
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
                  aria-label="Close Menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Category List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
              <p className="px-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-mudra-600">
                Browse Eaadharam Categories
              </p>
              {QUICK_CATEGORIES.map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/library/categories/${cat.slug}`}
                  onClick={() => setDrawerOpen(false)}
                  className="flex items-center justify-between rounded-xl border border-mudra-100 bg-parchment-50/80 px-3.5 py-3 text-xs font-semibold text-mudra-950 active:bg-mudra-100"
                >
                  <div>
                    <div className="text-sm font-bold text-mudra-950">{cat.nameEn}</div>
                    <div className="text-xs text-mudra-700">{cat.nameMl}</div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-mudra-500" />
                </Link>
              ))}
            </div>

            {/* Sheet Footer */}
            <div className="border-t border-mudra-100 bg-parchment-50 px-5 py-3.5 flex items-center justify-between">
              <span className="text-xs font-medium text-mudra-700">
                Role: <strong className="uppercase">{userRole || 'reader'}</strong>
              </span>
              <button
                type="button"
                onClick={async () => {
                  await fetch('/api/auth/logout', { method: 'POST' });
                  window.location.href = '/login';
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-xs active:scale-95"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fixed Bottom App Tab Bar */}
      <nav
        aria-label="Mobile Library Bottom Tab Bar"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-mudra-800/80 bg-[#0b192c]/95 text-parchment-200 backdrop-blur-lg shadow-[0_-6px_24px_rgba(0,0,0,0.25)] pb-[env(safe-area-inset-bottom)]"
      >
        <div className={`grid ${userRole === 'admin' ? 'grid-cols-4' : 'grid-cols-3'} h-16`}>
          <Link
            href="/library"
            className={`flex flex-col items-center justify-center gap-1 text-[11px] font-semibold transition active:scale-95 ${
              isLibraryHome ? 'text-amber-400' : 'text-parchment-300'
            }`}
          >
            <BookOpen className="h-5 w-5" />
            <span>Library</span>
          </Link>

          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className={`flex flex-col items-center justify-center gap-1 text-[11px] font-semibold transition active:scale-95 ${
              isCategories || drawerOpen ? 'text-amber-400' : 'text-parchment-300'
            }`}
          >
            <FolderTree className="h-5 w-5" />
            <span>Categories</span>
          </button>

          <Link
            href="/library/search"
            className={`flex flex-col items-center justify-center gap-1 text-[11px] font-semibold transition active:scale-95 ${
              isSearch ? 'text-amber-400' : 'text-parchment-300'
            }`}
          >
            <Search className="h-5 w-5" />
            <span>Search</span>
          </Link>

          {userRole === 'admin' && (
            <Link
              href="/admin"
              className={`flex flex-col items-center justify-center gap-1 text-[11px] font-semibold transition active:scale-95 ${
                isAdmin ? 'text-amber-400' : 'text-parchment-300'
              }`}
            >
              <Shield className="h-5 w-5" />
              <span>Admin</span>
            </Link>
          )}
        </div>
      </nav>
    </>
  );
}
