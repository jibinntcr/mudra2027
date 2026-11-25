import Link from 'next/link';
import { requireServerUser } from '@/features/auth/session';
import LogoutButton from '@/features/auth/LogoutButton';
import { MudraBrandLogo } from '@/components/brand/MudraBrandLogo';
import { MobileBottomNav } from '@/components/navigation/MobileBottomNav';
import { BookOpen, Search, Shield, UserCheck, FolderTree } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side authentication & active account verification on every protected route
  const user = await requireServerUser({ allowPendingPasswordChange: true });

  return (
    <div className="min-h-dvh flex flex-col bg-parchment-50 pb-20 md:pb-0">
      {/* Authenticated Mudra Top Navigation with Official Emblem */}
      <header className="bg-[#0b192c] text-parchment-100 border-b border-mudra-800 sticky top-0 z-30 shadow-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6 min-w-0">
            <Link href="/library" className="focus:outline-none">
              <MudraBrandLogo
                size="sm"
                theme="dark"
                subtitle="Protected Subscriber Library"
              />
            </Link>

            {!user.mustChangePassword && (
              <nav className="hidden md:flex items-center gap-1 text-xs font-medium">
                <Link
                  href="/library"
                  className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-parchment-200 hover:bg-white/10 hover:text-white transition"
                >
                  <BookOpen className="h-3.5 w-3.5 text-amber-400" />
                  <span>Library Home</span>
                </Link>
                <Link
                  href="/library/categories/lrc-orders-sale"
                  className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-parchment-200 hover:bg-white/10 hover:text-white transition"
                >
                  <FolderTree className="h-3.5 w-3.5 text-amber-400" />
                  <span>LRC Orders → Sale</span>
                </Link>
                <Link
                  href="/library/search"
                  className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-parchment-200 hover:bg-white/10 hover:text-white transition"
                >
                  <Search className="h-3.5 w-3.5 text-amber-400" />
                  <span>Bilingual Search</span>
                </Link>
                {user.role === 'admin' && (
                  <Link
                    href="/admin"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500/15 border border-amber-400/30 px-3 py-2 text-amber-300 hover:bg-amber-500/25 transition"
                  >
                    <Shield className="h-3.5 w-3.5" />
                    <span>Admin Console</span>
                  </Link>
                )}
              </nav>
            )}
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <div className="hidden sm:flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-3 py-1.5 text-xs">
              <UserCheck className="h-3.5 w-3.5 text-emerald-400" />
              <span className="font-medium text-parchment-100">{user.displayName}</span>
              <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] uppercase font-bold text-amber-300">
                {user.role}
              </span>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="hidden md:block border-t border-mudra-200 bg-white py-6 text-xs text-mudra-700">
        <div className="mx-auto flex max-w-7xl flex-col sm:flex-row items-center justify-between gap-2 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <MudraBrandLogo size="xs" showText={false} />
            <span>
              Mudra Publications Digital Reference Archive • Authenticated Session ({user.loginId})
            </span>
          </div>
          <span>Private Document Storage • Byte-Range Streaming Enabled</span>
        </div>
      </footer>

      {!user.mustChangePassword && (
        <MobileBottomNav
          mode="protected"
          userRole={user.role}
          userDisplayName={user.displayName}
          userLoginId={user.loginId}
        />
      )}
    </div>
  );
}
