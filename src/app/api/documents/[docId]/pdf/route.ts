import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/features/auth/session';
import { getCollections } from '@/lib/db/client';
import {
  readPrivateObjectFull,
  readPrivateObjectSlice,
} from '@/lib/storage/private-storage';
import { ensureAuthenticPdfInPrivateStorage } from '@/lib/storage/pdf-hydration';

/**
 * Authenticated Private PDF Delivery Route with HTTP Byte-Range (206 Partial Content) Support
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

  const doc = await documents.findOne(filter);
  if (!doc) {
    return NextResponse.json(
      { error: 'Document not found or not published' },
      {
        status: 404,
        headers: { 'Cache-Control': 'private, no-store, no-cache, must-revalidate' },
      }
    );
  }

  const url = new URL(req.url);
  const requestedVersion = parseInt(url.searchParams.get('v') || String(doc.currentVersion), 10);
  const fileVersion =
    doc.versions.find((v) => v.version === requestedVersion) ||
    doc.versions.find((v) => v.version === doc.currentVersion) ||
    doc.versions[doc.versions.length - 1];

  if (!fileVersion) {
    return NextResponse.json(
      { error: 'Document file version not found' },
      { status: 404, headers: { 'Cache-Control': 'private, no-store' } }
    );
  }

  const stat = await ensureAuthenticPdfInPrivateStorage(
    doc,
    fileVersion.storageKey,
    fileVersion.pageCount || 2
  );
  if (!stat) {
    return NextResponse.json(
      { error: 'Private PDF object missing from storage' },
      { status: 404, headers: { 'Cache-Control': 'private, no-store' } }
    );
  }

  const totalSize = stat.size;
  const rangeHeader = req.headers.get('range');

  const securityHeaders: Record<string, string> = {
    'Content-Type': 'application/pdf',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, no-store, no-cache, must-revalidate, max-age=0',
    Pragma: 'no-cache',
    Expires: '0',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Content-Disposition': `inline; filename="${doc.slug}-v${fileVersion.version}.pdf"`,
  };

  if (rangeHeader && rangeHeader.startsWith('bytes=')) {
    const parts = rangeHeader.replace(/bytes=/, '').split('-');
    const startStr = parts[0];
    const endStr = parts[1];

    let start = startStr ? parseInt(startStr, 10) : 0;
    let end = endStr ? parseInt(endStr, 10) : totalSize - 1;

    if (isNaN(start) || start < 0) start = 0;
    if (isNaN(end) || end >= totalSize) end = totalSize - 1;

    if (start > end || start >= totalSize) {
      return new NextResponse(null, {
        status: 416,
        headers: {
          ...securityHeaders,
          'Content-Range': `bytes */${totalSize}`,
        },
      });
    }

    const slice = await readPrivateObjectSlice(fileVersion.storageKey, start, end);
    return new NextResponse(new Uint8Array(slice), {
      status: 206,
      headers: {
        ...securityHeaders,
        'Content-Range': `bytes ${start}-${end}/${totalSize}`,
        'Content-Length': String(slice.byteLength),
      },
    });
  }

  const fullBuffer = await readPrivateObjectFull(fileVersion.storageKey);
  return new NextResponse(new Uint8Array(fullBuffer), {
    status: 200,
    headers: {
      ...securityHeaders,
      'Content-Length': String(fullBuffer.byteLength),
    },
  });
}
