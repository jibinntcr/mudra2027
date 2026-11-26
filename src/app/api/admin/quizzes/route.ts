import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/features/auth/session';
import { getCollections } from '@/lib/db/client';
import { slugify } from '@/lib/validation/normalize';
import { DEFAULT_SCORING_RULES } from '@/features/quiz/scoring';
import {
  ensureDefaultPublishedQuiz,
  ensureFixedQuizVersion,
  hydrateQuestionLinkedDocs,
} from '@/features/quiz/service';
import type {
  QuizDocument,
  QuizPlayMode,
  QuizQuestionItem,
  QuizStatus,
} from '@/lib/db/types';

export async function GET(req: NextRequest) {
  const auth = await requireApiUser(req, { requiredRole: 'admin' });
  if ('errorResponse' in auth) return auth.errorResponse;

  await ensureDefaultPublishedQuiz();
  const { quizzes, quizRooms, documents } = await getCollections();

  const [allQuizzes, recentRooms, docCatalogue] = await Promise.all([
    quizzes.find({}).sort({ updatedAt: -1 }).toArray(),
    quizRooms.find({}).sort({ createdAt: -1 }).limit(20).toArray(),
    documents
      .find(
        { isPublished: true },
        {
          projection: {
            docId: 1,
            slug: 1,
            documentNumber: 1,
            titleEn: 1,
            titleMl: 1,
          },
        }
      )
      .sort({ year: -1 })
      .limit(50)
      .toArray(),
  ]);

  return NextResponse.json(
    {
      quizzes: allQuizzes,
      recentRooms,
      availableDocuments: docCatalogue,
    },
    { status: 200, headers: { 'Cache-Control': 'private, no-store' } }
  );
}

/**
 * Create a new Quiz (with optional questions)
 */
export async function POST(req: NextRequest) {
  const auth = await requireApiUser(req, { requiredRole: 'admin' });
  if ('errorResponse' in auth) return auth.errorResponse;

  try {
    const body = await req.json();
    const titleEn = String(body.titleEn || '').trim();
    const titleMl = String(body.titleMl || '').trim();

    if (!titleEn && !titleMl) {
      return NextResponse.json(
        { error: 'Quiz title is required in English, Malayalam, or both.' },
        { status: 400 }
      );
    }

    const { quizzes } = await getCollections();
    const count = await quizzes.countDocuments();
    const quizId = `QUIZ-2026-${String(count + 1).padStart(4, '0')}`;
    const baseSlug = slugify(titleEn || titleMl || quizId) || slugify(quizId);
    const existingSlug = await quizzes.findOne({ slug: baseSlug });
    const slug = existingSlug ? `${baseSlug}-${count + 1}` : baseSlug;

    const rawQuestions: QuizQuestionItem[] = Array.isArray(body.questions)
      ? body.questions
      : [];
    const hydratedQuestions = await hydrateQuestionLinkedDocs(rawQuestions);

    const status: QuizStatus =
      body.status === 'published' || body.status === 'archived'
        ? body.status
        : 'draft';

    const enabledModes: QuizPlayMode[] =
      Array.isArray(body.enabledModes) && body.enabledModes.length > 0
        ? body.enabledModes
        : ['auto_live', 'host_live', 'self_paced'];

    const now = new Date();
    const newQuiz: QuizDocument = {
      quizId,
      slug,
      titleEn,
      titleMl,
      descriptionEn: String(body.descriptionEn || '').trim(),
      descriptionMl: String(body.descriptionMl || '').trim(),
      status,
      defaultTimeSeconds: Math.min(300, Math.max(5, Number(body.defaultTimeSeconds || 20))),
      defaultRevealSeconds: Math.min(60, Math.max(2, Number(body.defaultRevealSeconds || 6))),
      scoringRules: {
        ...DEFAULT_SCORING_RULES,
        ...(body.scoringRules || {}),
      },
      enabledModes,
      questions: hydratedQuestions,
      currentVersion: 1,
      createdBy: auth.user.loginId,
      createdAt: now,
      updatedAt: now,
    };

    await quizzes.insertOne(newQuiz);

    if (newQuiz.status === 'published' && newQuiz.questions.length > 0) {
      await ensureFixedQuizVersion(newQuiz);
    }

    return NextResponse.json(
      { ok: true, quiz: newQuiz },
      { status: 201, headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to create quiz' },
      { status: 500 }
    );
  }
}

/**
 * Update an existing Quiz (edit metadata, add/edit/reorder questions, publish, or archive).
 * Increments `currentVersion` whenever questions or scoring rules are edited so existing
 * live sessions and self-paced attempts retain their fixed version snapshot.
 */
export async function PATCH(req: NextRequest) {
  const auth = await requireApiUser(req, { requiredRole: 'admin' });
  if ('errorResponse' in auth) return auth.errorResponse;

  try {
    const body = await req.json();
    const quizId = String(body.quizId || '').trim();
    if (!quizId) {
      return NextResponse.json({ error: 'quizId is required' }, { status: 400 });
    }

    const { quizzes } = await getCollections();
    const existing = await quizzes.findOne({ quizId });
    if (!existing) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }

    const now = new Date();
    const updates: Record<string, unknown> = { updatedAt: now };
    let bumpVersion = false;

    if (typeof body.titleEn === 'string') updates.titleEn = body.titleEn.trim();
    if (typeof body.titleMl === 'string') updates.titleMl = body.titleMl.trim();
    if (typeof body.descriptionEn === 'string') updates.descriptionEn = body.descriptionEn.trim();
    if (typeof body.descriptionMl === 'string') updates.descriptionMl = body.descriptionMl.trim();

    if (typeof body.defaultTimeSeconds === 'number') {
      updates.defaultTimeSeconds = Math.min(300, Math.max(5, body.defaultTimeSeconds));
    }
    if (typeof body.defaultRevealSeconds === 'number') {
      updates.defaultRevealSeconds = Math.min(60, Math.max(2, body.defaultRevealSeconds));
    }
    if (body.scoringRules && typeof body.scoringRules === 'object') {
      updates.scoringRules = {
        ...existing.scoringRules,
        ...body.scoringRules,
      };
      bumpVersion = true;
    }
    if (Array.isArray(body.enabledModes) && body.enabledModes.length > 0) {
      updates.enabledModes = body.enabledModes;
    }

    if (Array.isArray(body.questions)) {
      const hydrated = await hydrateQuestionLinkedDocs(body.questions);
      updates.questions = hydrated;
      bumpVersion = true;
    }

    if (
      body.status === 'draft' ||
      body.status === 'published' ||
      body.status === 'archived'
    ) {
      const targetQuestions = (updates.questions as QuizQuestionItem[]) || existing.questions;
      if (body.status === 'published' && targetQuestions.length === 0) {
        return NextResponse.json(
          { error: 'Cannot publish a quiz with 0 questions. Add at least one question first.' },
          { status: 400 }
        );
      }
      updates.status = body.status;
    }

    const nextVersion = bumpVersion ? existing.currentVersion + 1 : existing.currentVersion;
    updates.currentVersion = nextVersion;

    await quizzes.updateOne({ quizId }, { $set: updates });
    const updatedQuiz = (await quizzes.findOne({ quizId }))!;

    if (updatedQuiz.status === 'published' && updatedQuiz.questions.length > 0) {
      await ensureFixedQuizVersion(updatedQuiz);
    }

    return NextResponse.json(
      { ok: true, quiz: updatedQuiz },
      { status: 200, headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to update quiz' },
      { status: 500 }
    );
  }
}
