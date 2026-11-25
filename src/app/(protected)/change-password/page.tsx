'use client';

import React, { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { KeyRound, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

function ChangePasswordInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '/library';

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not update password.');
        setSubmitting(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push(returnTo);
        router.refresh();
      }, 600);
    } catch {
      setError('Network error while updating password.');
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-14 sm:px-6">
      <div className="rounded-2xl border border-mudra-200 bg-white p-8 shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500 text-mudra-950">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-serif text-xl font-bold text-mudra-950">
              Update Your Password
            </h1>
            <p className="text-xs text-mudra-600">
              Mandatory password change on first login or temporary reset
            </p>
          </div>
        </div>

        <p className="mb-5 text-xs text-mudra-700 leading-relaxed">
          For security, Mudra Publications requires you to replace your temporary administrator-issued
          password before accessing library categories or PDF documents.
        </p>

        {error && (
          <div
            role="alert"
            className="mb-4 flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-800"
          >
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-800">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>Password updated! Redirecting you to the library…</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-mudra-800 mb-1">
              Current / Temporary Password
            </label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-lg border border-mudra-300 bg-parchment-50 px-3.5 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-mudra-800 mb-1">
              New Password (8+ chars, upper, lower, digit)
            </label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-lg border border-mudra-300 bg-parchment-50 px-3.5 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-mudra-800 mb-1">
              Confirm New Password
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg border border-mudra-300 bg-parchment-50 px-3.5 py-2 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || success}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-mudra-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-mudra-700 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Saving New Password…</span>
              </>
            ) : (
              <span>Save Password &amp; Continue</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ChangePasswordPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-sm">Loading…</div>}>
      <ChangePasswordInner />
    </Suspense>
  );
}
