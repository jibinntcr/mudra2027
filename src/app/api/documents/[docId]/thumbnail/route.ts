import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/features/auth/session';
import { getCollections } from '@/lib/db/client';
import { generateMudraCoverSvg } from '@/lib/storage/private-storage';

/**
 * Authenticated Document Thumbnail Endpoint
 * Applies identical session, active status, and publication checks as the PDF and download routes.
 * Renders the Mudra-branded SVG cover thumbnail embedding the official Mudra Publications emblem.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ docId: string }> }
) {
  const auth = await requireApiUser(req);
  if ('errorResponse' in auth) return auth.errorResponse;

  const { docId } = await context.params;
  const { documents } = await getCollections();

  const filter: Record<string, unknown> = {
    $or: [{ docId }, { slug: docId }],
  };
  if (auth.user.role !== 'admin') {
    filter.isPublished = true;
  }

  const doc = await documents.findOne(filter, { projection: { extractedText: 0 } });
  if (!doc) {
    return NextResponse.json(
      { error: 'Document thumbnail not found or unauthorized' },
      {
        status: 404,
        headers: { 'Cache-Control': 'private, no-store, no-cache, must-revalidate' },
      }
    );
  }

  const fileVersion =
    doc.versions.find((v) => v.version === doc.currentVersion) ||
    doc.versions[doc.versions.length - 1];

  const svgBuffer = generateMudraCoverSvg({
    documentNumber: doc.documentNumber,
    titleMl: doc.titleMl,
    titleEn: doc.titleEn,
    categoryLabel: doc.primaryCategorySlug,
    year: doc.year,
    pageCount: fileVersion?.pageCount || 1,
    hasTextLayer: doc.hasTextLayer,
  });

  return new NextResponse(new Uint8Array(svgBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'private, no-store, no-cache, must-revalidate, max-age=0',
      Pragma: 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
