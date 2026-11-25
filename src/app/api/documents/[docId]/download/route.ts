import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/features/auth/session';
import { getCollections } from '@/lib/db/client';
import { readPrivateObjectFull } from '@/lib/storage/private-storage';
import { ensureAuthenticPdfInPrivateStorage } from '@/lib/storage/pdf-hydration';

/**
 * Authenticated Private PDF Download Endpoint
 * Applies identical server-side authentication, active session, and publication checks as the PDF reader stream.
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
      { error: 'Document not found or unauthorized' },
      {
        status: 404,
        headers: { 'Cache-Control': 'private, no-store, no-cache, must-revalidate' },
      }
    );
  }

  const fileVersion =
    doc.versions.find((v) => v.version === doc.currentVersion) ||
    doc.versions[doc.versions.length - 1];

  if (!fileVersion) {
    return NextResponse.json({ error: 'File version not found' }, { status: 404 });
  }

  await ensureAuthenticPdfInPrivateStorage(
    doc,
    fileVersion.storageKey,
    fileVersion.pageCount || 2
  );
  const buffer = await readPrivateObjectFull(fileVersion.storageKey);
  const safeFilename = `${doc.documentNumber.replace(/[^a-zA-Z0-9_-]+/g, '_')}_${doc.docId}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${safeFilename}"`,
      'Content-Length': String(buffer.byteLength),
      'Cache-Control': 'private, no-store, no-cache, must-revalidate, max-age=0',
      Pragma: 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
