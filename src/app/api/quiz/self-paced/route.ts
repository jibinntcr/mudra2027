import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getCollections } from '@/lib/db/client';
import { getCurrentUser } from '@/features/auth/session';
import { ensureFixedQuizVersion } from '@/features/quiz/service';
import type { QuizAttemptDocument } from '@/lib/db/types';

/**
 * Starts a new Self-Paced Quiz Attempt bound to a fixed `QuizVersionDocument`.
 * Kept completely separate from live room rankings.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const quizIdentifier = String(body.quizId || '').trim();
    if (!quizIdentifier) {
      return NextResponse.json({ error: 'quizId is required' }, { status: 400 });
    }

    const { quizzes, quizAttempts } = await getCollections();
    const quiz = await quizzes.findOne({
      status: 'published',
      $or: [{ quizId: quizIdentifier }, { slug: quizIdentifier }],
    });

    if (!quiz || quiz.questions.length === 0) {
      return NextResponse.json(
        { error: 'Published quiz not found or has no questions.' },
        { status: 404 }
      );
    }

    const quizVersion = await ensureFixedQuizVersion(quiz);
    const user = await getCurrentUser();
    const displayName =
      String(body.displayName || '').trim() ||
      (user ? user.displayName : 'Guest Player');
    const preferredLanguage = body.preferredLanguage === 'ml' ? 'ml' : 'en';

    const now = new Date();
    const attemptId = `ATT-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const attemptToken = crypto.randomBytes(18).toString('hex');

    const attempt: QuizAttemptDocument = {
      attemptId,
      attemptToken,
      mode: 'self_paced',
      roomCode: null,
      participantId: null,
      quizId: quiz.quizId,
      versionId: quizVersion.versionId,
      version: quizVersion.version,
      quizTitleEn: quizVersion.titleEn,
      quizTitleMl: quizVersion.titleMl,
      userId: user?.userId || null,
      loginId: user?.loginId || null,
      displayName: displayName.slice(0, 40),
      isGuest: !user,
      preferredLanguage,
      status: 'in_progress',
      scoringRules: quizVersion.scoringRules,
      currentQuestionIndex: 0,
      currentQuestionStartedAt: now,
      totalQuestions: quizVersion.questions.length,
      totalPoints: 0,
      correctCount: 0,
      answeredCount: 0,
      accuracyPercent: 0,
      cumulativeCorrectTimeMs: 0,
      currentStreak: 0,
      maxStreak: 0,
      rank: null,
      totalParticipantsInRoom: null,
      answers: [],
      startedAt: now,
      completedAt: null,
    };

    await quizAttempts.insertOne(attempt);

    return NextResponse.json(
      {
        ok: true,
        attemptId: attempt.attemptId,
        attemptToken: attempt.attemptToken,
      },
      { status: 201, headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to start self-paced attempt' },
      { status: 500 }
    );
  }
}
