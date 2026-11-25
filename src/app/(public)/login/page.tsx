'use client';

import React, { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  BookOpen,
  Shield,
  ArrowRight,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Lock,
  UserCheck,
} from 'lucide-react';

interface QuickUserOption {
  loginId: string;
  displayName: string;
  titleMl: string;
  role: 'reader' | 'admin';
  description: string;
  targetPath: string;
  badgeText: string;
}

const QUICK_USERS: QuickUserOption[] = [
  {
    loginId: 'reader.kerala',
    displayName: 'Kerala Registration Reader',
    titleMl: 'വായനക്കാരൻ (Reader Access)',
    role: 'reader',
    description:
      'Enter directly to browse all 18 Eaadharam categories, search Malayalam & English orders, and read/download PDFs.',
    targetPath: '/library',
    badgeText: '1-Click Reader Entry',
  },
  {
    loginId: 'admin.mudra',
    displayName: 'Mudra Chief Administrator',
    titleMl: 'അഡ്മിനിസ്ട്രേറ്റർ (Admin Console + Library)',
    role: 'admin',
    description:
      'Enter with full Administrator privileges to access both the Reader Library and the Admin Console (/admin).',
    targetPath: '/library',
    badgeText: '1-Click Admin Entry',
  },
  {
    loginId: 'admin.mudra',
    displayName: 'Open Admin Dashboard Directly',
    titleMl: 'അഡ്മിൻ ഡാഷ്ബോർഡ് (/admin)',
    role: 'admin',
    description:
      'Jump straight into the Mudra Admin Console to manage accounts, categories, publications, and imports.',
    targetPath: '/admin',
    badgeText: 'Direct to /admin',
  },
];

function LoginFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '';

  const [activeQuickKey, setActiveQuickKey] = useState<string | null>(null);
  const [showManualForm, setShowManualForm] = useState(false);
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleQuickSelect(option: QuickUserOption, idx: number) {
    setError(null);
    const key = `${option.loginId}-${idx}`;
    setActiveQuickKey(key);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quickLogin: true,
          loginId: option.loginId,
          targetPath: option.targetPath,
          returnTo: returnTo || option.targetPath,
          bypassPasswordChange: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Quick sign-in failed.');
        setActiveQuickKey(null);
        return;
      }

      router.push(data.redirectUrl || option.targetPath);
      router.refresh();
    } catch {
      setError('Network error while signing in. Please try again.');
      setActiveQuickKey(null);
    }
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginId, password, returnTo: returnTo || '/library' }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Sign in failed. Please check your credentials.');
        setSubmitting(false);
        return;
      }

      router.push(data.redirectUrl || '/library');
      router.refresh();
    } catch {
      setError('Network error while signing in. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-8 sm:py-12 sm:px-6">
      <div className="rounded-3xl border border-mudra-200 bg-white p-6 sm:p-8 shadow-xl">
        {/* Centered Mudra Emblem Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="h-20 w-20 overflow-hidden rounded-full bg-[#0b192c] ring-4 ring-amber-400/70 shadow-lg mb-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/mudrapublications_logo.jpeg"
              alt="Mudra Publications Official Logo"
              width={80}
              height={80}
              className="h-full w-full object-cover scale-105"
            />
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 border border-emerald-300 px-3 py-0.5 text-[11px] font-bold text-emerald-900 mb-2">
            <UserCheck className="h-3.5 w-3.5 text-emerald-700" />
            Instant Testing Access — No Password Required
          </span>
          <h1 className="font-serif text-xl sm:text-2xl font-bold text-mudra-950">
            Choose a User to Enter Mudra Library
          </h1>
          <p className="text-xs sm:text-sm text-mudra-600 mt-1">
            Tap any user profile below to sign in immediately with one click
          </p>
        </div>

        {returnTo && returnTo !== '/library' && (
          <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs text-mudra-900">
            Select a user below to continue directly to{' '}
            <code className="font-mono font-semibold">{returnTo}</code>.
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-300 bg-red-50 px-3.5 py-3 text-xs text-red-800"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* One-Click User Selection Cards */}
        <div className="space-y-3.5">
          {QUICK_USERS.map((u, idx) => {
            const key = `${u.loginId}-${idx}`;
            const isLoading = activeQuickKey === key;
            const isAdmin = u.role === 'admin';

            return (
              <button
                key={key}
                type="button"
                disabled={Boolean(activeQuickKey)}
                onClick={() => handleQuickSelect(u, idx)}
                className={`w-full text-left group relative flex items-start justify-between gap-4 rounded-2xl border-2 p-4 sm:p-5 transition shadow-xs active:scale-[0.99] ${
                  isAdmin
                    ? 'border-mudra-300 bg-parchment-50/70 hover:border-[#0b192c] hover:bg-white'
                    : 'border-amber-400/80 bg-gradient-to-r from-[#0b192c] to-[#132743] text-white hover:shadow-lg'
                } disabled:opacity-60`}
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <div
                    className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-bold shadow-xs ${
                      isAdmin
                        ? 'bg-[#0b192c] text-amber-300'
                        : 'bg-amber-400 text-[#0b192c]'
                    }`}
                  >
                    {isAdmin ? <Shield className="h-5 w-5" /> : <BookOpen className="h-5 w-5" />}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`font-serif text-base font-bold ${
                          isAdmin ? 'text-mudra-950' : 'text-white'
                        }`}
                      >
                        {u.displayName}
                      </span>
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          isAdmin
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                        }`}
                      >
                        {u.badgeText}
                      </span>
                    </div>

                    <p
                      className={`text-xs font-medium mt-0.5 ${
                        isAdmin ? 'text-mudra-700' : 'text-amber-300'
                      }`}
                    >
                      {u.titleMl} • <code className="font-mono">{u.loginId}</code>
                    </p>

                    <p
                      className={`text-xs mt-1.5 leading-relaxed ${
                        isAdmin ? 'text-mudra-700' : 'text-parchment-200'
                      }`}
                    >
                      {u.description}
                    </p>
                  </div>
                </div>

                <div
                  className={`shrink-0 self-center flex h-9 w-9 items-center justify-center rounded-full transition ${
                    isAdmin
                      ? 'bg-mudra-100 text-mudra-900 group-hover:bg-[#0b192c] group-hover:text-amber-300'
                      : 'bg-amber-400 text-[#0b192c] group-hover:bg-amber-300'
                  }`}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Collapsible Manual Login Form (kept available for custom/automated tests) */}
        <div className="mt-6 border-t border-mudra-100 pt-4">
          <button
            type="button"
            onClick={() => setShowManualForm((s) => !s)}
            className="w-full flex items-center justify-between text-xs font-semibold text-mudra-600 hover:text-mudra-900 py-1"
          >
            <span className="inline-flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5" />
              <span>Sign in manually with Login ID &amp; Password</span>
            </span>
            {showManualForm ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {showManualForm && (
            <form onSubmit={handleManualSubmit} className="mt-4 space-y-3.5">
              <div>
                <label
                  htmlFor="loginId"
                  className="block text-xs font-semibold uppercase tracking-wider text-mudra-800 mb-1"
                >
                  Login ID
                </label>
                <input
                  id="loginId"
                  name="loginId"
                  type="text"
                  required
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  placeholder="e.g. reader.kerala"
                  className="w-full rounded-xl border border-mudra-300 bg-parchment-50 px-3.5 py-2.5 text-sm text-mudra-950"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-xs font-semibold uppercase tracking-wider text-mudra-800 mb-1"
                >
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full rounded-xl border border-mudra-300 bg-parchment-50 px-3.5 py-2.5 text-sm text-mudra-950"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#0b192c] px-4 py-2.5 text-xs font-bold text-amber-300 hover:bg-mudra-900 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Signing In…</span>
                  </>
                ) : (
                  <span>Sign In with Password</span>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="py-16 text-center text-sm">Loading user profiles…</div>}>
      <LoginFormInner />
    </Suspense>
  );
}
