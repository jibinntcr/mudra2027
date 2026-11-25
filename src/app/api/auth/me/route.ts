import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/features/auth/session';

export async function GET(req: NextRequest) {
  const auth = await requireApiUser(req, { allowPendingPasswordChange: true });
  if ('errorResponse' in auth) return auth.errorResponse;

  return NextResponse.json(
    { user: auth.user },
    {
      status: 200,
      headers: { 'Cache-Control': 'private, no-store, no-cache, must-revalidate' },
    }
  );
}
