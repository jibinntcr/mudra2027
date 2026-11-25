'use client';

import React, { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, AlertCircle, ShieldCheck, Loader2 } from 'lucide-react';

function LoginFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '/library';

  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginId, password, returnTo }),
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
    <div className="mx-auto max-w-md px-4 py-10 sm:py-14 sm:px-6">
      <div className="rounded-3xl border border-mudra-200 bg-white p-7 sm:p-8 shadow-xl">
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
          <h1 className="font-serif text-xl font-bold text-mudra-950">
            Subscriber Sign In
          </h1>
          <p className="text-xs text-mudra-600 mt-0.5">
            Mudra Publications Protected Reference Library
          </p>
        </div>

        {returnTo && returnTo !== '/library' && (
          <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs text-mudra-900">
            Please sign in to continue to <code className="font-mono font-semibold">{returnTo}</code>.
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="loginId"
              className="block text-xs font-semibold uppercase tracking-wider text-mudra-800 mb-1.5"
            >
              Login ID
            </label>
            <input
              id="loginId"
              name="loginId"
              type="text"
              required
              autoComplete="username"
              autoCapitalize="none"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              placeholder="e.g. reader.kerala"
              className="w-full rounded-xl border border-mudra-300 bg-parchment-50 px-4 py-3 text-base sm:text-sm text-mudra-950 focus:border-mudra-700 focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-semibold uppercase tracking-wider text-mudra-800 mb-1.5"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full rounded-xl border border-mudra-300 bg-parchment-50 px-4 py-3 text-base sm:text-sm text-mudra-950 focus:border-mudra-700 focus:bg-white focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#0b192c] px-4 py-3.5 text-sm font-bold text-amber-300 hover:bg-mudra-900 disabled:opacity-50 transition shadow-md active:scale-[0.99]"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Verifying Session…</span>
              </>
            ) : (
              <>
                <Lock className="h-4 w-4" />
                <span>Sign In to Library</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-6 border-t border-mudra-100 pt-4 text-xs text-mudra-600 flex items-start gap-2">
          <ShieldCheck className="h-4 w-4 text-mudra-700 shrink-0 mt-0.5" />
          <span>
            Public registration is disabled. Reader and Admin accounts are managed exclusively by
            Mudra Publications administrators.
          </span>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="py-16 text-center text-sm">Loading sign-in form…</div>}>
      <LoginFormInner />
    </Suspense>
  );
}
