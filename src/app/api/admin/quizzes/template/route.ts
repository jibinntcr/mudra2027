import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/features/auth/session';
import { generateQuizExcelTemplateBuffer } from '@/features/quiz/excel';

export async function GET(req: NextRequest) {
  const auth = await requireApiUser(req, { requiredRole: 'admin' });
  if ('errorResponse' in auth) return auth.errorResponse;

  const buf = generateQuizExcelTemplateBuffer();

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition':
        'attachment; filename="Mudra_Quiz_Bulk_Import_Template.xlsx"',
      'Cache-Control': 'private, no-store',
    },
  });
}
