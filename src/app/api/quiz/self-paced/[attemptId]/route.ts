import { NextRequest, NextResponse } from 'next/server';
import { getCollections } from '@/lib/db/client';
import { getCurrentUser } from '@/features/auth/session';
import { calculateQuestionScore } from '@/features/quiz/scoring';

/**
 * Self-Paced Attempt State, Answer Submission & End-of-Quiz Review Endpoint
 * - Restricted to the player holding `attemptToken`, the signed-in reader who owns `attempt.userId`, or an Admin.
 * - Never leaks future questions' `correctOptionId` or `explanation` until answered.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ attemptId: string }> }
) {
  const { attemptId } = await context.params;
  const url = new URL(req.url);
  const attemptToken =
    req.headers.get('x-attempt-token') ||
    url.searchParams.get('attemptToken') ||
    '';

  const { quizAttempts, quizVersions } = await getCollections();
  const attempt = await quizAttempts.findOne({ attemptId });
  if (!attempt) {
    return NextResponse.json({ error: 'Quiz attempt not found' }, { status: 404 });
  }

  const user = await getCurrentUser();
  const isOwnerByToken = Boolean(attemptToken && attempt.attemptToken === attemptToken);
  const isOwnerByUser = Boolean(user && attempt.userId && attempt.userId === user.userId);
  const isAdmin = Boolean(user && user.role === 'admin');

  if (!isOwnerByToken && !isOwnerByUser && !isAdmin) {
    return NextResponse.json(
      { error: 'Forbidden: You do not have access to this player result.' },
      { status: 403 }
    );
  }

  const quizVersion = await quizVersions.findOne({ versionId: attempt.versionId });
  if (!quizVersion) {
    return NextResponse.json({ error: 'Quiz version snapshot not found' }, { status: 404 });
  }

  const currentQ =
    attempt.status === 'in_progress'
      ? quizVersion.questions[attempt.currentQuestionIndex] || null
      : null;

  const answerMap = new Map(attempt.answers.map((a) => [a.questionIndex, a]));

  const completedReview =
    attempt.status === 'completed'
      ? quizVersion.questions.map((q, idx) => {
          const ans = answerMap.get(idx);
          return {
            questionIndex: idx,
            questionNumber: idx + 1,
            questionId: q.questionId,
            type: q.type,
            promptEn: q.promptEn,
            promptMl: q.promptMl,
            options: q.options,
            selectedOptionId: ans?.selectedOptionId || null,
            correctOptionId: q.correctOptionId,
            isCorrect: ans?.isCorrect || false,
            responseTimeMs: ans?.responseTimeMs || null,
            pointsEarned: ans?.totalPointsEarned || 0,
            basePointsEarned: ans?.basePointsEarned || 0,
            speedBonusEarned: ans?.speedBonusEarned || 0,
            streakBonusEarned: ans?.streakBonusEarned || 0,
            explanationEn: q.explanationEn || '',
            explanationMl: q.explanationMl || '',
            linkedDocSnapshot: q.linkedDocSnapshot || null,
          };
        })
      : null;

  return NextResponse.json(
    {
      serverNow: new Date().toISOString(),
      isSignedInReader: Boolean(user),
      attempt: {
        attemptId: attempt.attemptId,
        mode: attempt.mode,
        roomCode: attempt.roomCode,
        quizId: attempt.quizId,
        version: attempt.version,
        quizTitleEn: attempt.quizTitleEn,
        quizTitleMl: attempt.quizTitleMl,
        displayName: attempt.displayName,
        preferredLanguage: attempt.preferredLanguage,
        status: attempt.status,
        scoringRules: attempt.scoringRules,
        currentQuestionIndex: attempt.currentQuestionIndex,
        currentQuestionStartedAt: attempt.currentQuestionStartedAt,
        totalQuestions: attempt.totalQuestions,
        totalPoints: attempt.totalPoints,
        correctCount: attempt.correctCount,
        answeredCount: attempt.answeredCount,
        accuracyPercent: attempt.accuracyPercent,
        currentStreak: attempt.currentStreak,
        maxStreak: attempt.maxStreak,
        rank: attempt.rank,
        totalParticipantsInRoom: attempt.totalParticipantsInRoom,
        startedAt: attempt.startedAt,
        completedAt: attempt.completedAt,
      },
      availableLanguages: {
        en: quizVersion.questions.some((q) => Boolean(q.promptEn)),
        ml: quizVersion.questions.some((q) => Boolean(q.promptMl)),
      },
      currentQuestion: currentQ
        ? {
            questionIndex: attempt.currentQuestionIndex,
            questionNumber: attempt.currentQuestionIndex + 1,
            totalQuestions: quizVersion.questions.length,
            questionId: currentQ.questionId,
            type: currentQ.type,
            sectionEn: currentQ.sectionEn || '',
            sectionMl: currentQ.sectionMl || '',
            reference: currentQ.reference || '',
            promptEn: currentQ.promptEn,
            promptMl: currentQ.promptMl,
            options: currentQ.options,
            timeLimitSeconds:
              currentQ.timeLimitSeconds || quizVersion.defaultTimeSeconds || 20,
          }
        : null,
      completedReview,
    },
    { status: 200, headers: { 'Cache-Control': 'private, no-store' } }
  );
}

/**
 * Submits an answer for the current question in a Self-Paced attempt (or switches preferredLanguage)
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ attemptId: string }> }
) {
  const { attemptId } = await context.params;
  const body = await req.json();
  const attemptToken = String(body.attemptToken || '');

  const { quizAttempts, quizVersions } = await getCollections();
  const attempt = await quizAttempts.findOne({ attemptId });
  if (!attempt) {
    return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
  }

  const user = await getCurrentUser();
  const isOwner =
    (attemptToken && attempt.attemptToken === attemptToken) ||
    (user && attempt.userId === user.userId);
  if (!isOwner) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (body.action === 'switch_language') {
    const preferredLanguage = body.preferredLanguage === 'ml' ? 'ml' : 'en';
    await quizAttempts.updateOne(
      { attemptId },
      { $set: { preferredLanguage } }
    );
    return NextResponse.json({ ok: true, preferredLanguage });
  }

  if (attempt.status === 'completed') {
    return NextResponse.json({ ok: true, alreadyCompleted: true });
  }

  const quizVersion = await quizVersions.findOne({ versionId: attempt.versionId });
  if (!quizVersion) {
    return NextResponse.json({ error: 'Quiz version missing' }, { status: 404 });
  }

  const qIdx = Number(body.questionIndex ?? attempt.currentQuestionIndex);
  // Idempotent retry protection
  const alreadyAnswered = attempt.answers.find((a) => a.questionIndex === qIdx);
  if (alreadyAnswered) {
    return NextResponse.json({
      ok: true,
      duplicateRetry: true,
      answerResult: alreadyAnswered,
    });
  }

  if (qIdx !== attempt.currentQuestionIndex) {
    return NextResponse.json(
      { error: 'Question index out of sync.' },
      { status: 409 }
    );
  }

  const question = quizVersion.questions[qIdx];
  if (!question) {
    return NextResponse.json({ error: 'Question not found' }, { status: 400 });
  }

  const now = new Date();
  const startedMs = new Date(attempt.currentQuestionStartedAt).getTime();
  const responseTimeMs = Math.max(0, now.getTime() - startedMs);
  const timeLimitSec = question.timeLimitSeconds || quizVersion.defaultTimeSeconds || 20;
  const isTimedOut =
    body.timedOut === true || responseTimeMs > (timeLimitSec + 2) * 1000;

  const selectedOptionId = isTimedOut
    ? 'TIMEOUT'
    : String(body.selectedOptionId || '').trim().toUpperCase();

  const isCorrect = !isTimedOut && selectedOptionId === question.correctOptionId;

  const scoreRes = calculateQuestionScore({
    isCorrect,
    responseTimeMs,
    timeLimitSeconds: timeLimitSec,
    previousStreak: attempt.currentStreak,
    rules: attempt.scoringRules,
  });

  const answerRecord = {
    questionIndex: qIdx,
    questionId: question.questionId,
    selectedOptionId,
    isCorrect: scoreRes.isCorrect,
    responseTimeMs,
    basePointsEarned: scoreRes.basePointsEarned,
    speedBonusEarned: scoreRes.speedBonusEarned,
    streakBonusEarned: scoreRes.streakBonusEarned,
    totalPointsEarned: scoreRes.totalPointsEarned,
    streakAfterAnswer: scoreRes.streakAfterAnswer,
    questionStartedAt: attempt.currentQuestionStartedAt,
    submittedAt: now,
  };

  const nextAnswers = [...attempt.answers, answerRecord];
  const nextPoints = attempt.totalPoints + scoreRes.totalPointsEarned;
  const nextCorrect = attempt.correctCount + (scoreRes.isCorrect ? 1 : 0);
  const nextAnswered = attempt.answeredCount + 1;
  const nextCumTime =
    attempt.cumulativeCorrectTimeMs + (scoreRes.isCorrect ? responseTimeMs : 0);
  const nextMaxStreak = Math.max(attempt.maxStreak, scoreRes.streakAfterAnswer);

  const isLastQuestion = qIdx + 1 >= quizVersion.questions.length;
  const nextStatus = isLastQuestion ? 'completed' : 'in_progress';
  const nextQIndex = isLastQuestion ? qIdx : qIdx + 1;
  const accuracyPercent =
    quizVersion.questions.length > 0
      ? Math.round((nextCorrect / quizVersion.questions.length) * 100)
      : 0;

  await quizAttempts.updateOne(
    { attemptId },
    {
      $set: {
        status: nextStatus,
        currentQuestionIndex: nextQIndex,
        currentQuestionStartedAt: now,
        totalPoints: nextPoints,
        correctCount: nextCorrect,
        answeredCount: nextAnswered,
        accuracyPercent,
        cumulativeCorrectTimeMs: nextCumTime,
        currentStreak: scoreRes.streakAfterAnswer,
        maxStreak: nextMaxStreak,
        answers: nextAnswers,
        ...(isLastQuestion ? { completedAt: now } : {}),
      },
    }
  );

  return NextResponse.json(
    {
      ok: true,
      completed: isLastQuestion,
      feedback: {
        questionIndex: qIdx,
        selectedOptionId,
        correctOptionId: question.correctOptionId,
        isCorrect: scoreRes.isCorrect,
        basePointsEarned: scoreRes.basePointsEarned,
        speedBonusEarned: scoreRes.speedBonusEarned,
        streakBonusEarned: scoreRes.streakBonusEarned,
        totalPointsEarned: scoreRes.totalPointsEarned,
        streakAfterAnswer: scoreRes.streakAfterAnswer,
        explanationEn: question.explanationEn || '',
        explanationMl: question.explanationMl || '',
        linkedDocSnapshot: question.linkedDocSnapshot || null,
      },
    },
    { status: 200, headers: { 'Cache-Control': 'private, no-store' } }
  );
}
