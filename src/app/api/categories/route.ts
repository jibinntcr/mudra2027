import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/features/auth/session';
import { getCategoryTree } from '@/features/categories/service';

export async function GET(req: NextRequest) {
  const auth = await requireApiUser(req);
  if ('errorResponse' in auth) return auth.errorResponse;

  const includeUnpublished = auth.user.role === 'admin';
  const tree = await getCategoryTree(includeUnpublished);

  return NextResponse.json(
    { categories: tree },
    {
      status: 200,
      headers: {
        'Cache-Control': 'private, no-store, no-cache, must-revalidate',
      },
    }
  );
}
