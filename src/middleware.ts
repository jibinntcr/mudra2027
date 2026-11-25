import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, verifySessionJwt } from '@/features/auth/jwt';

const PUBLIC_PATHS = new Set(['/', '/about', '/contact', '/login']);

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Skip Next.js static assets, brand logo, PDF.js worker, and PWA files
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname === '/robots.txt' ||
    pathname === '/manifest.json' ||
    pathname === '/sw.js' ||
    pathname === '/mudrapublications_logo.jpeg' ||
    pathname === '/pdf.worker.min.mjs'
  ) {
    return NextResponse.next();
  }

  // Public auth endpoints
  if (pathname === '/api/auth/login' || pathname === '/api/auth/logout') {
    return NextResponse.next();
  }

  // Check if path is public
  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const payload = token ? await verifySessionJwt(token) : null;

  // Protected API routes
  if (pathname.startsWith('/api/')) {
    if (!payload) {
      return NextResponse.json(
        { error: 'Authentication required. Please sign in.' },
        {
          status: 401,
          headers: { 'Cache-Control': 'private, no-store, no-cache, must-revalidate' },
        }
      );
    }

    if (pathname.startsWith('/api/admin') && payload.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Admin role required.' },
        {
          status: 403,
          headers: { 'Cache-Control': 'private, no-store, no-cache, must-revalidate' },
        }
      );
    }

    const res = NextResponse.next();
    res.headers.set('Cache-Control', 'private, no-store, no-cache, must-revalidate');
    return res;
  }

  // Protected Page routes (/library, /categories, /search, /admin, /change-password)
  if (!payload) {
    const returnTo = `${pathname}${search}`;
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('returnTo', returnTo);
    return NextResponse.redirect(loginUrl);
  }

  // Enforce mandatory password change before accessing library or admin pages
  if (payload.mustChangePassword && pathname !== '/change-password') {
    const returnTo = `${pathname}${search}`;
    const changeUrl = new URL('/change-password', req.url);
    changeUrl.searchParams.set('returnTo', returnTo);
    return NextResponse.redirect(changeUrl);
  }

  // Enforce Admin role on /admin routes
  if (pathname.startsWith('/admin') && payload.role !== 'admin') {
    const libUrl = new URL('/library?error=forbidden', req.url);
    return NextResponse.redirect(libUrl);
  }

  const response = NextResponse.next();
  response.headers.set('Cache-Control', 'private, no-store, no-cache, must-revalidate');
  response.headers.set('Pragma', 'no-cache');
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|mudrapublications_logo.jpeg|manifest.json|sw.js|pdf.worker.min.mjs).*)',
  ],
};
