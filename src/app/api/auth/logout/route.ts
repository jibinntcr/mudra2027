import { NextRequest, NextResponse } from 'next/server';
import {
  clearSessionCookie,
  revokeSessionByToken,
  SESSION_COOKIE_NAME,
} from '@/features/auth/session';

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    await revokeSessionByToken(token);
  }

  const response = NextResponse.json(
    { ok: true },
    {
      status: 200,
      headers: { 'Cache-Control': 'private, no-store, no-cache, must-revalidate' },
    }
  );
  clearSessionCookie(response);
  return response;
}
