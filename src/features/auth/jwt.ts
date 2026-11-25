import { SignJWT, jwtVerify } from 'jose';
import type { UserRole } from '@/lib/db/types';

export const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'mudra_session';
export const SESSION_MAX_AGE_SECONDS = parseInt(
  process.env.SESSION_MAX_AGE_SECONDS || '28800',
  10
);

function getJwtSecretKey(): Uint8Array {
  const secret =
    process.env.JWT_SECRET ||
    'mudra-publications-super-secret-jwt-key-2026-kerala-registration-library';
  return new TextEncoder().encode(secret);
}

export interface SessionPayload {
  sessionId: string;
  userId: string;
  loginId: string;
  displayName: string;
  role: UserRole;
  sessionVersion: number;
  mustChangePassword: boolean;
}

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getJwtSecretKey());
}

export async function verifySessionJwt(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecretKey());
    if (!payload.userId || !payload.sessionId || !payload.loginId || !payload.role) {
      return null;
    }
    return {
      sessionId: String(payload.sessionId),
      userId: String(payload.userId),
      loginId: String(payload.loginId),
      displayName: String(payload.displayName || payload.loginId),
      role: payload.role as UserRole,
      sessionVersion: Number(payload.sessionVersion || 1),
      mustChangePassword: Boolean(payload.mustChangePassword),
    };
  } catch {
    return null;
  }
}
