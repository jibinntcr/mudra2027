'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.push('/login');
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className="inline-flex items-center gap-1.5 rounded-lg border border-mudra-700 bg-mudra-900/70 px-3 py-1.5 text-xs font-medium text-parchment-200 hover:bg-mudra-800 hover:text-white transition"
    >
      <LogOut className="h-3.5 w-3.5" />
      <span>{loading ? 'Signing Out…' : 'Sign Out'}</span>
    </button>
  );
}
