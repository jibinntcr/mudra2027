import Link from 'next/link';
import { requireServerUser } from '@/features/auth/session';
import LogoutButton from '@/features/auth/LogoutButton';
import { MudraBrandLogo } from '@/components/brand/MudraBrandLogo';
import { MobileBottomNav } from '@/components/navigation/MobileBottomNav';
import { BookOpen, Users, FolderTree, FileSpreadsheet, Trophy } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Enforce Admin role on the server
  const user = await requireServerUser({
    requiredRole: 'admin',
    returnTo: '/admin',
  });

  return (
    <div className="min-h-dvh flex flex-col bg-parchment-50 pb-20 md:pb-0">
      <header className="bg-[#0b192c] text-parchment-100 border-b border-mudra-800 sticky top-0 z-30 shadow-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="focus:outline-none">
              <MudraBrandLogo
                size="sm"
                theme="dark"
                subtitle="Admin Console • Accounts, Quizzes, Imports & Publication"
              />
            </Link>

            <nav className="hidden md:flex items-center gap-2 text-xs font-medium">
              <Link
                href="/admin?tab=users"
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-parchment-200 hover:bg-white/10"
              >
                <Users className="h-3.5 w-3.5 text-amber-400" />
                <span>Reader Accounts</span>
              </Link>
              <Link
                href="/admin?tab=documents"
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-parchment-200 hover:bg-white/10"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-amber-400" />
                <span>Documents &amp; Publication</span>
              </Link>
              <Link
                href="/admin?tab=categories"
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-parchment-200 hover:bg-white/10"
              >
                <FolderTree className="h-3.5 w-3.5 text-amber-400" />
                <span>Categories</span>
              </Link>
              <Link
                href="/admin?tab=quizzes"
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400/15 border border-amber-400/30 px-3 py-1.5 text-amber-300 hover:bg-amber-400/25 font-bold"
              >
                <Trophy className="h-3.5 w-3.5 text-amber-400" />
                <span>Mudra Quiz</span>
              </Link>
              <Link
                href="/library"
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-amber-300 hover:bg-white/10"
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span>Reader Library</span>
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-xs text-parchment-200">
              Admin: <strong>{user.loginId}</strong>
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <MobileBottomNav
        mode="admin"
        userRole={user.role}
        userDisplayName={user.displayName}
        userLoginId={user.loginId}
      />
    </div>
  );
}
