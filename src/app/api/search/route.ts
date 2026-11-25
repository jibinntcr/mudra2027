import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/features/auth/session';
import { SearchQuerySchema } from '@/lib/validation/schemas';
import { searchLibraryDocuments } from '@/features/search/service';

export async function GET(req: NextRequest) {
  // Server-side authentication check on every search request
  const auth = await requireApiUser(req);
  if ('errorResponse' in auth) return auth.errorResponse;

  const url = new URL(req.url);
  const parsed = SearchQuerySchema.safeParse({
    q: url.searchParams.get('q') || '',
    category: url.searchParams.get('category') || '',
    year: url.searchParams.get('year') || undefined,
    hasTextLayer: url.searchParams.get('hasTextLayer') || undefined,
    page: url.searchParams.get('page') || '1',
    limit: url.searchParams.get('limit') || '12',
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid search query parameters' }, { status: 400 });
  }

  const includeUnpublished =
    auth.user.role === 'admin' && url.searchParams.get('includeUnpublished') === 'true';

  const result = await searchLibraryDocuments({
    query: parsed.data.q,
    categorySlug: parsed.data.category || undefined,
    year: parsed.data.year,
    hasTextLayer: parsed.data.hasTextLayer,
    includeUnpublished,
    page: parsed.data.page,
    limit: parsed.data.limit,
  });

  return NextResponse.json(result, {
    status: 200,
    headers: {
      'Cache-Control': 'private, no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
    },
  });
}
