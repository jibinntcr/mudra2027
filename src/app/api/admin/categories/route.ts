import { NextRequest, NextResponse } from 'next/server';
import { getCollections } from '@/lib/db/client';
import { CategoryInputSchema } from '@/lib/validation/schemas';
import { requireApiUser } from '@/features/auth/session';

export async function GET(req: NextRequest) {
  const auth = await requireApiUser(req, { requiredRole: 'admin' });
  if ('errorResponse' in auth) return auth.errorResponse;

  const { categories } = await getCollections();
  const list = await categories.find().sort({ parentSlug: 1, order: 1, nameEn: 1 }).toArray();

  return NextResponse.json(
    { categories: list },
    {
      status: 200,
      headers: { 'Cache-Control': 'private, no-store' },
    }
  );
}

export async function POST(req: NextRequest) {
  const auth = await requireApiUser(req, { requiredRole: 'admin' });
  if ('errorResponse' in auth) return auth.errorResponse;

  try {
    const body = await req.json();
    const parsed = CategoryInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid category input' },
        { status: 400 }
      );
    }

    const { categories } = await getCollections();
    const existing = await categories.findOne({ slug: parsed.data.slug });
    if (existing) {
      return NextResponse.json(
        { error: `Category slug "${parsed.data.slug}" already exists.` },
        { status: 409 }
      );
    }

    let ancestors: string[] = [];
    let pathLabel = parsed.data.nameEn;

    if (parsed.data.parentSlug) {
      const parent = await categories.findOne({ slug: parsed.data.parentSlug });
      if (!parent) {
        return NextResponse.json({ error: 'Parent category not found' }, { status: 404 });
      }
      ancestors = [...parent.ancestors, parent.slug];
      pathLabel = `${parent.pathLabel} → ${parsed.data.nameEn}`;
    }

    const now = new Date();
    await categories.insertOne({
      slug: parsed.data.slug,
      nameEn: parsed.data.nameEn,
      nameMl: parsed.data.nameMl,
      description: parsed.data.description,
      parentSlug: parsed.data.parentSlug || null,
      ancestors,
      pathLabel,
      order: parsed.data.order,
      isPublished: parsed.data.isPublished,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json(
      { ok: true, slug: parsed.data.slug, pathLabel },
      { status: 201, headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to create category' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireApiUser(req, { requiredRole: 'admin' });
  if ('errorResponse' in auth) return auth.errorResponse;

  try {
    const body = await req.json();
    const { slug, isPublished, nameEn, nameMl } = body;
    if (!slug) {
      return NextResponse.json({ error: 'Category slug is required' }, { status: 400 });
    }

    const { categories } = await getCollections();
    const updateFields: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof isPublished === 'boolean') updateFields.isPublished = isPublished;
    if (typeof nameEn === 'string' && nameEn.trim()) updateFields.nameEn = nameEn.trim();
    if (typeof nameMl === 'string') updateFields.nameMl = nameMl.trim();

    await categories.updateOne({ slug }, { $set: updateFields });
    return NextResponse.json(
      { ok: true },
      { status: 200, headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to update category' },
      { status: 500 }
    );
  }
}
