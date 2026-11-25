import Link from 'next/link';
import { getCurrentUser } from '@/features/auth/session';
import { MudraBrandLogo } from '@/components/brand/MudraBrandLogo';
import { MobileBottomNav } from '@/components/navigation/MobileBottomNav';
import { BookOpen, Lock, Shield, LogIn } from 'lucide-react';

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <div className="min-h-dvh flex flex-col pb-16 md:pb-0">
      {/* App-Like Sticky Top Header with Official Mudra Logo */}
      <header className="border-b border-mudra-200/80 bg-white/95 backdrop-blur-md sticky top-0 z-30 shadow-xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="group focus:outline-none">
            <MudraBrandLogo
              size="md"
              theme="light"
              subtitle="മുദ്ര പബ്ലിക്കേഷൻസ് • Kerala Registration & LRC Library"
            />
          </Link>

          <nav className="flex items-center gap-4 sm:gap-6 text-sm font-medium text-mudra-800">
            <Link href="/" className="hidden md:inline-block hover:text-mudra-600 transition">
              Home
            </Link>
            <Link href="/about" className="hidden md:inline-block hover:text-mudra-600 transition">
              About
            </Link>
            <Link href="/contact" className="hidden md:inline-block hover:text-mudra-600 transition">
              Contact
            </Link>
            {user ? (
              <div className="flex items-center gap-2.5">
                <Link
                  href="/library"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#0b192c] px-4 py-2 text-xs font-bold text-amber-300 hover:bg-mudra-900 transition shadow-sm active:scale-95"
                >
                  <BookOpen className="h-4 w-4" />
                  <span>Open Library</span>
                </Link>
                {user.role === 'admin' && (
                  <Link
                    href="/admin"
                    className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-mudra-300 bg-mudra-50 px-3 py-2 text-xs font-semibold text-mudra-900 hover:bg-mudra-100"
                  >
                    <Shield className="h-3.5 w-3.5 text-mudra-700" />
                    <span>Admin</span>
                  </Link>
                )}
              </div>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-xl bg-[#0b192c] px-4 py-2 text-xs font-bold text-amber-300 hover:bg-mudra-900 transition shadow-sm active:scale-95"
              >
                <LogIn className="h-4 w-4" />
                <span>Sign In</span>
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      {/* Public Footer with Official Mudra Logo */}
      <footer className="border-t border-mudra-800 bg-[#0b192c] text-parchment-200">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="space-y-2">
              <MudraBrandLogo
                size="sm"
                theme="dark"
                subtitle="മുദ്ര പബ്ലിക്കേഷൻസ് • Official Digital Archive"
              />
              <p className="text-xs text-parchment-300 max-w-xl leading-relaxed pt-1">
                Curated Kerala Registration Department Orders, Land Revenue Commissioner (LRC) Rulings,
                Stamp Act Schedules, and Service Rules Archive. Access restricted to authorized subscribers.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-amber-300/90 bg-white/5 border border-white/10 px-3.5 py-2.5 rounded-xl">
              <Lock className="h-3.5 w-3.5 shrink-0" />
              <span>Private Subscriber Library • Invitation &amp; Admin Provisioning Only</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Mobile App Bottom Navigation */}
      <MobileBottomNav
        mode={user ? 'protected' : 'public'}
        userRole={user?.role}
        userDisplayName={user?.displayName}
        userLoginId={user?.loginId}
      />
    </div>
  );
}
