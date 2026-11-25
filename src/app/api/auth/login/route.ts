import { NextRequest, NextResponse } from 'next/server';
import { getCollections } from '@/lib/db/client';
import { LoginSchema } from '@/lib/validation/schemas';
import {
  attachSessionCookie,
  createServerSession,
  verifyPassword,
} from '@/features/auth/session';
import {
  checkLoginRateLimit,
  clearLoginRateLimit,
  recordFailedLoginAttempt,
} from '@/features/auth/rate-limit';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const isQuickLogin = Boolean(body?.quickLogin);

    const ipAddress =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // Quick One-Click Testing Login Mode (No password required)
    if (isQuickLogin && typeof body?.loginId === 'string' && body.loginId.trim()) {
      const quickLoginId = body.loginId.trim().toLowerCase();
      const { users } = await getCollections();
      const user = await users.findOne({ loginId: quickLoginId });

      if (!user) {
        return NextResponse.json(
          { error: `Account "${quickLoginId}" not found.` },
          { status: 404, headers: { 'Cache-Control': 'private, no-store' } }
        );
      }

      if (!user.isActive) {
        return NextResponse.json(
          { error: 'This account has been deactivated by an administrator.' },
          { status: 403, headers: { 'Cache-Control': 'private, no-store' } }
        );
      }

      // For quick testing login, bypass password & first-login password change gate unless explicitly requested
      const effectiveUser =
        body.bypassPasswordChange !== false
          ? { ...user, mustChangePassword: false }
          : user;

      await clearLoginRateLimit(quickLoginId, ipAddress);
      const { token, expiresAt } = await createServerSession({
        user: effectiveUser,
        ipAddress,
        userAgent,
      });

      const returnTo = typeof body.returnTo === 'string' ? body.returnTo : '';
      const defaultTarget =
        body.targetPath || (user.role === 'admin' ? '/library' : '/library');
      const safeReturnTo =
        returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')
          ? returnTo
          : defaultTarget;

      const redirectUrl = effectiveUser.mustChangePassword
        ? `/change-password?returnTo=${encodeURIComponent(safeReturnTo)}`
        : safeReturnTo;

      const response = NextResponse.json(
        {
          ok: true,
          user: {
            loginId: effectiveUser.loginId,
            displayName: effectiveUser.displayName,
            role: effectiveUser.role,
            mustChangePassword: effectiveUser.mustChangePassword,
          },
          redirectUrl,
        },
        {
          status: 200,
          headers: { 'Cache-Control': 'private, no-store, no-cache, must-revalidate' },
        }
      );

      attachSessionCookie(response, token, expiresAt);
      return response;
    }

    // Standard ID + Password Login Flow
    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid login credentials format' },
        { status: 400 }
      );
    }

    const { loginId, password, returnTo } = parsed.data;

    // 1. Check rate limit
    const rateStatus = await checkLoginRateLimit(loginId, ipAddress);
    if (!rateStatus.allowed) {
      return NextResponse.json(
        {
          error: `Too many failed sign-in attempts. Please wait ${Math.ceil(
            rateStatus.retryAfterSeconds / 60
          )} minutes before trying again.`,
          retryAfterSeconds: rateStatus.retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateStatus.retryAfterSeconds),
            'Cache-Control': 'private, no-store',
          },
        }
      );
    }

    // 2. Find account
    const { users } = await getCollections();
    const user = await users.findOne({ loginId });

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      const failStatus = await recordFailedLoginAttempt(loginId, ipAddress);
      return NextResponse.json(
        {
          error: 'Invalid login ID or password.',
          remainingAttempts: failStatus.remainingAttempts,
        },
        { status: 401, headers: { 'Cache-Control': 'private, no-store' } }
      );
    }

    // 3. Check if deactivated
    if (!user.isActive) {
      return NextResponse.json(
        {
          error:
            'This account has been deactivated by an administrator. Please contact Mudra Publications.',
        },
        { status: 403, headers: { 'Cache-Control': 'private, no-store' } }
      );
    }

    // 4. Clear failed login attempts & create session
    await clearLoginRateLimit(loginId, ipAddress);
    const { token, expiresAt } = await createServerSession({
      user,
      ipAddress,
      userAgent,
    });

    const safeReturnTo =
      returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')
        ? returnTo
        : '/library';

    const redirectUrl = user.mustChangePassword
      ? `/change-password?returnTo=${encodeURIComponent(safeReturnTo)}`
      : safeReturnTo;

    const response = NextResponse.json(
      {
        ok: true,
        user: {
          loginId: user.loginId,
          displayName: user.displayName,
          role: user.role,
          mustChangePassword: user.mustChangePassword,
        },
        redirectUrl,
      },
      {
        status: 200,
        headers: { 'Cache-Control': 'private, no-store, no-cache, must-revalidate' },
      }
    );

    attachSessionCookie(response, token, expiresAt);
    return response;
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || 'Internal server error' },
      { status: 500 }
    );
  }
}
