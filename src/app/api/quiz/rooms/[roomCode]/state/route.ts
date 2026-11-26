import { NextRequest, NextResponse } from 'next/server';
import { getCollections } from '@/lib/db/client';
import { getCurrentUser } from '@/features/auth/session';
import { syncLiveRoomStateMachine } from '@/features/quiz/service';
import { rankParticipants } from '@/features/quiz/scoring';

/**
 * Live Room Real-Time State & Language Switch Endpoint
 *
 * SECURITY & FAIRNESS:
 * - While `room.status === 'question_open'`, NEVER sends `correctOptionId`, `explanationEn`, `explanationMl`,
 *   or `linkedDocSnapshot` to any client.
 * - Sends `correctOptionId`, `explanationEn`, `explanationMl`, and `linkedDocSnapshot` ONLY when
 *   `room.status === 'question_revealed'` or `room.status === 'completed'`.
 * - Shared leaderboards expose ONLY `displayName`, `rank`, `isTied`, and `totalPoints` (plus streak indicator).
 * - Player-specific answer breakdown & end-of-quiz review is returned ONLY to the matching authenticated `participantToken`.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ roomCode: string }> }
) {
  const { roomCode } = await context.params;
  const normalizedCode = roomCode.trim().toUpperCase();
  const url = new URL(req.url);
  const participantToken =
    req.headers.get('x-participant-token') ||
    url.searchParams.get('participantToken') ||
    '';

  const { room, quizVersion } = await syncLiveRoomStateMachine(normalizedCode);
  if (!room || !quizVersion) {
    return NextResponse.json(
      { error: 'Room not found.' },
      { status: 404, headers: { 'Cache-Control': 'private, no-store' } }
    );
  }

  const { quizParticipants, quizSubmissions } = await getCollections();
  const user = await getCurrentUser();

  const [allParticipants, myParticipant] = await Promise.all([
    quizParticipants.find({ roomCode: normalizedCode, removed: false }).toArray(),
    participantToken
      ? quizParticipants.findOne({
          roomCode: normalizedCode,
          participantToken,
        })
      : Promise.resolve(null),
  ]);

  const ranked = rankParticipants(allParticipants);
  const myRanked = myParticipant
    ? ranked.find((r) => r.participantId === myParticipant.participantId) || null
    : null;

  const currentQIndex = room.currentQuestionIndex;
  const rawQuestion =
    currentQIndex >= 0 ? quizVersion.questions[currentQIndex] || null : null;

  const [currentAnswerCount, myCurrentSub] = await Promise.all([
    currentQIndex >= 0
      ? quizSubmissions.countDocuments({
          roomCode: normalizedCode,
          questionIndex: currentQIndex,
        })
      : Promise.resolve(0),
    myParticipant && currentQIndex >= 0
      ? quizSubmissions.findOne({
          roomCode: normalizedCode,
          participantId: myParticipant.participantId,
          questionIndex: currentQIndex,
        })
      : Promise.resolve(null),
  ]);

  const isRevealedOrCompleted =
    room.status === 'question_revealed' || room.status === 'completed';

  // Build active question payload (stripping answer key while question_open!)
  let currentQuestionPayload = null;
  if (rawQuestion) {
    let answerDistribution: Record<string, number> | null = null;
    if (isRevealedOrCompleted) {
      const qSubs = await quizSubmissions
        .find({ roomCode: normalizedCode, questionIndex: currentQIndex })
        .toArray();
      answerDistribution = {};
      for (const opt of rawQuestion.options) {
        answerDistribution[opt.optionId] = 0;
      }
      for (const s of qSubs) {
        answerDistribution[s.selectedOptionId] =
          (answerDistribution[s.selectedOptionId] || 0) + 1;
      }
    }

    currentQuestionPayload = {
      questionIndex: currentQIndex,
      questionNumber: currentQIndex + 1,
      totalQuestions: quizVersion.questions.length,
      questionId: rawQuestion.questionId,
      type: rawQuestion.type,
      promptEn: rawQuestion.promptEn,
      promptMl: rawQuestion.promptMl,
      options: rawQuestion.options,
      timeLimitSeconds:
        rawQuestion.timeLimitSeconds || quizVersion.defaultTimeSeconds || 20,
      ...(isRevealedOrCompleted
        ? {
            correctOptionId: rawQuestion.correctOptionId,
            explanationEn: rawQuestion.explanationEn || '',
            explanationMl: rawQuestion.explanationMl || '',
            linkedDocSnapshot: rawQuestion.linkedDocSnapshot || null,
            answerDistribution,
          }
        : {}),
    };
  }

  // End-of-quiz full review (only when room is completed AND only for the requesting participant)
  let myCompletedReview = null;
  if (room.status === 'completed' && myParticipant) {
    const mySubs = await quizSubmissions
      .find({
        roomCode: normalizedCode,
        participantId: myParticipant.participantId,
      })
      .toArray();
    const subMap = new Map(mySubs.map((s) => [s.questionIndex, s]));

    myCompletedReview = quizVersion.questions.map((q, idx) => {
      const sub = subMap.get(idx);
      return {
        questionIndex: idx,
        questionNumber: idx + 1,
        questionId: q.questionId,
        type: q.type,
        promptEn: q.promptEn,
        promptMl: q.promptMl,
        options: q.options,
        selectedOptionId: sub?.selectedOptionId || null,
        correctOptionId: q.correctOptionId,
        isCorrect: sub?.isCorrect || false,
        responseTimeMs: sub?.responseTimeMs || null,
        pointsEarned: sub?.totalPointsEarned || 0,
        basePointsEarned: sub?.basePointsEarned || 0,
        speedBonusEarned: sub?.speedBonusEarned || 0,
        streakBonusEarned: sub?.streakBonusEarned || 0,
        explanationEn: q.explanationEn || '',
        explanationMl: q.explanationMl || '',
        linkedDocSnapshot: q.linkedDocSnapshot || null,
      };
    });
  }

  return NextResponse.json(
    {
      serverNow: new Date().toISOString(),
      isSignedInReader: Boolean(user),
      room: {
        roomCode: room.roomCode,
        quizId: room.quizId,
        version: room.version,
        mode: room.mode,
        status: room.status,
        capacity: room.capacity,
        joinLocked: room.joinLocked,
        revealDurationSeconds: room.revealDurationSeconds,
        scoringRules: room.scoringRules,
        currentQuestionIndex: room.currentQuestionIndex,
        totalQuestions: quizVersion.questions.length,
        questionOpenedAt: room.questionOpenedAt,
        questionDeadlineAt: room.questionDeadlineAt,
        revealStartedAt: room.revealStartedAt,
        revealEndsAt: room.revealEndsAt,
      },
      quiz: {
        titleEn: quizVersion.titleEn,
        titleMl: quizVersion.titleMl,
        descriptionEn: quizVersion.descriptionEn,
        descriptionMl: quizVersion.descriptionMl,
        availableLanguages: {
          en: quizVersion.questions.some((q) => Boolean(q.promptEn)),
          ml: quizVersion.questions.some((q) => Boolean(q.promptMl)),
        },
      },
      participantCount: allParticipants.length,
      currentQuestionAnsweredCount: currentAnswerCount,
      currentQuestion: currentQuestionPayload,
      // Shared leaderboard: only displayName, rank, isTied, totalPoints, and streak
      leaderboard: ranked.slice(0, 20).map((p) => ({
        displayName: p.displayName,
        rank: p.rank,
        isTied: p.isTied,
        totalPoints: p.totalPoints,
        currentStreak: p.currentStreak,
      })),
      podium:
        room.status === 'completed'
          ? ranked.slice(0, 3).map((p) => ({
              displayName: p.displayName,
              rank: p.rank,
              isTied: p.isTied,
              totalPoints: p.totalPoints,
              correctCount: p.correctCount,
            }))
          : [],
      me: myParticipant
        ? {
            participantId: myParticipant.participantId,
            displayName: myParticipant.displayName,
            preferredLanguage: myParticipant.preferredLanguage,
            removed: myParticipant.removed,
            totalPoints: myParticipant.totalPoints,
            correctCount: myParticipant.correctCount,
            answeredCount: myParticipant.answeredCount,
            currentStreak: myParticipant.currentStreak,
            maxStreak: myParticipant.maxStreak,
            rank: myRanked?.rank || null,
            isTied: myRanked?.isTied || false,
            currentSubmission: myCurrentSub
              ? {
                  questionIndex: myCurrentSub.questionIndex,
                  selectedOptionId: myCurrentSub.selectedOptionId,
                  responseTimeMs: myCurrentSub.responseTimeMs,
                  ...(isRevealedOrCompleted
                    ? {
                        isCorrect: myCurrentSub.isCorrect,
                        basePointsEarned: myCurrentSub.basePointsEarned,
                        speedBonusEarned: myCurrentSub.speedBonusEarned,
                        streakBonusEarned: myCurrentSub.streakBonusEarned,
                        totalPointsEarned: myCurrentSub.totalPointsEarned,
                        streakAfterAnswer: myCurrentSub.streakAfterAnswer,
                      }
                    : {}),
                }
              : null,
            completedReview: myCompletedReview,
          }
        : null,
    },
    {
      status: 200,
      headers: { 'Cache-Control': 'private, no-store, no-cache, must-revalidate' },
    }
  );
}

/**
 * Updates participant preferred language ('en' or 'ml') without losing progress
 */
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ roomCode: string }> }
) {
  const { roomCode } = await context.params;
  const normalizedCode = roomCode.trim().toUpperCase();
  const body = await req.json();
  const participantToken = String(body.participantToken || '');
  const preferredLanguage = body.preferredLanguage === 'ml' ? 'ml' : 'en';

  if (!participantToken) {
    return NextResponse.json({ error: 'participantToken required' }, { status: 400 });
  }

  const { quizParticipants } = await getCollections();
  await quizParticipants.updateOne(
    { roomCode: normalizedCode, participantToken },
    { $set: { preferredLanguage, lastSeenAt: new Date() } }
  );

  return NextResponse.json(
    { ok: true, preferredLanguage },
    { status: 200, headers: { 'Cache-Control': 'private, no-store' } }
  );
}
