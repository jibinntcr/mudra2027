import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/features/auth/session';
import { getCollections } from '@/lib/db/client';
import {
  convertPreviewRowsToQuestions,
  parseAndValidateQuizExcel,
} from '@/features/quiz/excel';
import {
  ensureFixedQuizVersion,
  hydrateQuestionLinkedDocs,
} from '@/features/quiz/service';

/**
 * `.xlsx` Bulk Import Preview & Atomic Batch Commit Endpoint
 *
 * - `mode: "preview"`: Parses the uploaded `.xlsx` file (base64 or multipart FormData),
 *   validates every row, and returns row numbers, parsed fields, and specific validation errors
 *   WITHOUT writing to the database.
 * - `mode: "confirm"`: Re-validates the batch and writes to the quiz ONLY when validation passes
 *   (`invalidRowsCount === 0`) and the admin confirms.
 */
export async function POST(req: NextRequest) {
  const auth = await requireApiUser(req, { requiredRole: 'admin' });
  if ('errorResponse' in auth) return auth.errorResponse;

  try {
    let fileBuffer: Buffer | null = null;
    let mode: 'preview' | 'confirm' = 'preview';
    let quizId = '';
    let replaceExisting = false;

    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const file = form.get('file') as File | null;
      if (file) {
        fileBuffer = Buffer.from(await file.arrayBuffer());
      }
      mode = form.get('mode') === 'confirm' ? 'confirm' : 'preview';
      quizId = String(form.get('quizId') || '').trim();
      replaceExisting = form.get('replaceExisting') === 'true';
    } else {
      const body = await req.json();
      if (body.fileBase64) {
        fileBuffer = Buffer.from(String(body.fileBase64), 'base64');
      }
      mode = body.mode === 'confirm' ? 'confirm' : 'preview';
      quizId = String(body.quizId || '').trim();
      replaceExisting = Boolean(body.replaceExisting);
    }

    if (!fileBuffer || fileBuffer.byteLength === 0) {
      return NextResponse.json(
        { error: 'Please provide an .xlsx file to parse.' },
        { status: 400 }
      );
    }

    const { quizzes } = await getCollections();
    const quiz = quizId ? await quizzes.findOne({ quizId }) : null;
    const defaultTimeSeconds = quiz?.defaultTimeSeconds || 20;

    const preview = await parseAndValidateQuizExcel(fileBuffer, defaultTimeSeconds);

    if (mode === 'preview') {
      return NextResponse.json(
        {
          ok: true,
          mode: 'preview',
          ...preview,
        },
        { status: 200, headers: { 'Cache-Control': 'private, no-store' } }
      );
    }

    // Mode === 'confirm': Write the batch ONLY after validation passes and the admin confirms
    if (!preview.canImport || preview.invalidRowsCount > 0) {
      return NextResponse.json(
        {
          error: `Batch import blocked: ${preview.invalidRowsCount} row(s) contain validation errors. Fix all errors before confirming import.`,
          ...preview,
        },
        { status: 422, headers: { 'Cache-Control': 'private, no-store' } }
      );
    }

    if (!quiz) {
      return NextResponse.json(
        { error: 'Target quiz not found for confirming batch import.' },
        { status: 404 }
      );
    }

    const baseQuestions = replaceExisting ? [] : quiz.questions;
    const importedQuestions = convertPreviewRowsToQuestions(
      preview.rows,
      baseQuestions.length + 1
    );
    const combinedQuestions = await hydrateQuestionLinkedDocs([
      ...baseQuestions,
      ...importedQuestions,
    ]);

    const nextVersion = quiz.currentVersion + 1;
    await quizzes.updateOne(
      { quizId: quiz.quizId },
      {
        $set: {
          questions: combinedQuestions,
          currentVersion: nextVersion,
          updatedAt: new Date(),
        },
      }
    );

    const updatedQuiz = (await quizzes.findOne({ quizId: quiz.quizId }))!;
    if (updatedQuiz.status === 'published' && updatedQuiz.questions.length > 0) {
      await ensureFixedQuizVersion(updatedQuiz);
    }

    return NextResponse.json(
      {
        ok: true,
        mode: 'confirm',
        importedCount: importedQuestions.length,
        totalQuestions: updatedQuiz.questions.length,
        quiz: updatedQuiz,
      },
      { status: 200, headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to process Excel import' },
      { status: 500 }
    );
  }
}
