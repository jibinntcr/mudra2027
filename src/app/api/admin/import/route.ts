import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/features/auth/session';
import { getCollections } from '@/lib/db/client';
import { runEaadharamMigration } from '../../../../../scripts/import/migrate-eaadharam';

export async function GET(req: NextRequest) {
  const auth = await requireApiUser(req, { requiredRole: 'admin' });
  if ('errorResponse' in auth) return auth.errorResponse;

  const { importLogs } = await getCollections();
  const logs = await importLogs
    .find({}, { projection: { details: 0 } })
    .sort({ startedAt: -1 })
    .limit(10)
    .toArray();

  return NextResponse.json(
    { logs },
    { status: 200, headers: { 'Cache-Control': 'private, no-store' } }
  );
}

export async function POST(req: NextRequest) {
  const auth = await requireApiUser(req, { requiredRole: 'admin' });
  if ('errorResponse' in auth) return auth.errorResponse;

  try {
    const report = await runEaadharamMigration();
    return NextResponse.json(
      {
        ok: true,
        runId: report.runId,
        categoriesProcessed: report.categoriesProcessed,
        documentsInspected: report.documentsInspected,
        documentsInserted: report.documentsInserted,
        documentsUpdatedCategory: report.documentsUpdatedCategory,
        duplicatesSkipped: report.duplicatesSkipped,
        textPdfsCount: report.textPdfsCount,
        scannedPdfsCount: report.scannedPdfsCount,
      },
      { status: 200, headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || 'Import run failed' },
      { status: 500 }
    );
  }
}
