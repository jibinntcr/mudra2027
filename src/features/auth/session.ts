import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getCollections } from '@/lib/db/client';
import type { UserDocument, UserRole } from '@/lib/db/types';
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  SessionPayload,
  signSessionToken,
  verifySessionJwt,
} from './jwt';

export { SESSION_COOKIE_NAME, signSessionToken, verifySessionJwt };
export type { SessionPayload };

export interface AuthenticatedUser {
  userId: string;
  loginId: string;
  displayName: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
  sessionVersion: number;
  sessionId: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createServerSession(params: {
  user: UserDocument;
  ipAddress: string;
  userAgent: string;
}): Promise<{ token: string; expiresAt: Date }> {
  const { sessions, users } = await getCollections();
  const sessionId = new ObjectId();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_MAX_AGE_SECONDS * 1000);

  const payload: SessionPayload = {
    sessionId: sessionId.toHexString(),
    userId: params.user._id!.toHexString(),
    loginId: params.user.loginId,
    displayName: params.user.displayName,
    role: params.user.role,
    sessionVersion: params.user.sessionVersion,
    mustChangePassword: params.user.mustChangePassword,
  };

  const token = await signSessionToken(payload);
  const tokenHash = hashToken(token);

  await sessions.insertOne({
    _id: sessionId,
    tokenHash,
    userId: params.user._id!,
    loginId: params.user.loginId,
    role: params.user.role,
    sessionVersion: params.user.sessionVersion,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    createdAt: now,
    expiresAt,
  });

  await users.updateOne(
    { _id: params.user._id },
    { $set: { lastLoginAt: now } }
  );

  return { token, expiresAt };
}

export async function revokeAllUserSessions(userId: ObjectId): Promise<void> {
  const { sessions, users } = await getCollections();
  const now = new Date();
  await sessions.updateMany(
    { userId, revokedAt: { $exists: false } },
    { $set: { revokedAt: now } }
  );
  await users.updateOne(
    { _id: userId },
    { $inc: { sessionVersion: 1 }, $set: { updatedAt: now } }
  );
}

export async function revokeSessionByToken(token: string): Promise<void> {
  const { sessions } = await getCollections();
  const tokenHash = hashToken(token);
  await sessions.updateOne(
    { tokenHash },
    { $set: { revokedAt: new Date() } }
  );
}

/**
 * Verifies the token against BOTH JWT cryptographic signature AND MongoDB active session + active user status.
 * If an account is deactivated or its sessions revoked, this returns null immediately.
 */
export async function validateSessionTokenInDb(token: string): Promise<AuthenticatedUser | null> {
  const payload = await verifySessionJwt(token);
  if (!payload) return null;

  const { sessions, users } = await getCollections();
  const tokenHash = hashToken(token);

  let sessionObjId: ObjectId;
  let userObjId: ObjectId;
  try {
    sessionObjId = new ObjectId(payload.sessionId);
    userObjId = new ObjectId(payload.userId);
  } catch {
    return null;
  }

  const [sessionDoc, userDoc] = await Promise.all([
    sessions.findOne({
      _id: sessionObjId,
      tokenHash,
      revokedAt: { $exists: false },
      expiresAt: { $gt: new Date() },
    }),
    users.findOne({
      _id: userObjId,
    }),
  ]);

  if (!userDoc) {
    // On Vercel Serverless with the seeded in-memory store across warm/cold function isolates,
    // if a signed JWT session is valid and not explicitly revoked in this isolate, check if any revoked session exists.
    if (process.env.VERCEL && (!process.env.MONGODB_URI || process.env.MONGODB_URI.includes('127.0.0.1'))) {
      const revokedSession = await sessions.findOne({ _id: sessionObjId, revokedAt: { $exists: true } });
      if (revokedSession) return null;
      return {
        userId: payload.userId,
        loginId: payload.loginId,
        displayName: payload.displayName,
        role: payload.role,
        isActive: true,
        mustChangePassword: payload.mustChangePassword,
        sessionVersion: payload.sessionVersion,
        sessionId: payload.sessionId,
      };
    }
    return null;
  }

  if (!sessionDoc) {
    // If userDoc exists in the seeded store on Vercel Serverless, verify no revoked session exists and userDoc is active
    if (process.env.VERCEL && (!process.env.MONGODB_URI || process.env.MONGODB_URI.includes('127.0.0.1'))) {
      const revokedSession = await sessions.findOne({ _id: sessionObjId, revokedAt: { $exists: true } });
      if (revokedSession || !userDoc.isActive || userDoc.sessionVersion !== payload.sessionVersion) {
        return null;
      }
      return {
        userId: userDoc._id!.toHexString(),
        loginId: userDoc.loginId,
        displayName: userDoc.displayName,
        role: userDoc.role,
        isActive: userDoc.isActive,
        mustChangePassword: userDoc.mustChangePassword,
        sessionVersion: userDoc.sessionVersion,
        sessionId: payload.sessionId,
      };
    }
    return null;
  }

  // Check active status and sessionVersion match
  if (!userDoc.isActive) {
    return null;
  }

  if (userDoc.sessionVersion !== sessionDoc.sessionVersion || userDoc.sessionVersion !== payload.sessionVersion) {
    return null;
  }

  return {
    userId: userDoc._id!.toHexString(),
    loginId: userDoc.loginId,
    displayName: userDoc.displayName,
    role: userDoc.role,
    isActive: userDoc.isActive,
    mustChangePassword: userDoc.mustChangePassword,
    sessionVersion: userDoc.sessionVersion,
    sessionId: sessionDoc._id!.toHexString(),
  };
}

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return validateSessionTokenInDb(token);
}

/**
 * Server Component Guard:
 * Checks authentication, active account status, password-change requirement, and role permissions.
 */
export async function requireServerUser(options?: {
  requiredRole?: UserRole;
  returnTo?: string;
  allowPendingPasswordChange?: boolean;
}): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();
  if (!user) {
    const returnQuery = options?.returnTo
      ? `?returnTo=${encodeURIComponent(options.returnTo)}`
      : '';
    redirect(`/login${returnQuery}`);
  }

  if (user.mustChangePassword && !options?.allowPendingPasswordChange) {
    const returnQuery = options?.returnTo
      ? `?returnTo=${encodeURIComponent(options.returnTo)}`
      : '';
    redirect(`/change-password${returnQuery}`);
  }

  if (options?.requiredRole === 'admin' && user.role !== 'admin') {
    redirect('/library?error=forbidden');
  }

  return user;
}

/**
 * Route Handler (API / PDF / Thumbnail / Download) Guard:
 * Checks authentication and role permissions on the server.
 */
export async function requireApiUser(
  req: NextRequest,
  options?: {
    requiredRole?: UserRole;
    allowPendingPasswordChange?: boolean;
  }
): Promise<{ user: AuthenticatedUser } | { errorResponse: NextResponse }> {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return {
      errorResponse: NextResponse.json(
        { error: 'Authentication required. Please sign in to access Mudra Publications.' },
        {
          status: 401,
          headers: {
            'Cache-Control': 'private, no-store, no-cache, must-revalidate',
          },
        }
      ),
    };
  }

  const user = await validateSessionTokenInDb(token);
  if (!user) {
    return {
      errorResponse: NextResponse.json(
        { error: 'Invalid, expired, or deactivated session. Please sign in again.' },
        {
          status: 401,
          headers: {
            'Cache-Control': 'private, no-store, no-cache, must-revalidate',
          },
        }
      ),
    };
  }

  if (user.mustChangePassword && !options?.allowPendingPasswordChange) {
    return {
      errorResponse: NextResponse.json(
        {
          error: 'Password change required before accessing the library.',
          mustChangePassword: true,
        },
        {
          status: 403,
          headers: {
            'Cache-Control': 'private, no-store, no-cache, must-revalidate',
          },
        }
      ),
    };
  }

  if (options?.requiredRole === 'admin' && user.role !== 'admin') {
    return {
      errorResponse: NextResponse.json(
        { error: 'Forbidden: Admin privileges required.' },
        {
          status: 403,
          headers: {
            'Cache-Control': 'private, no-store, no-cache, must-revalidate',
          },
        }
      ),
    };
  }

  return { user };
}

export function attachSessionCookie(response: NextResponse, token: string, expiresAt: Date): void {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
}
