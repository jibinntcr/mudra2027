import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/features/auth/session';
import { getCollections } from '@/lib/db/client';
import {
  createLiveQuizRoom,
  executeHostRoomAction,
  syncLiveRoomStateMachine,
} from '@/features/quiz/service';
import { rankParticipants } from '@/features/quiz/scoring';

/**
 * Admin / Host Live Room Management Endpoint
 * - POST: Open a new live room (`auto_live` or `host_live`) with configurable capacity, reveal duration, and scoring bonuses.
 * - GET: Fetch full host dashboard state (room, active question, timer, participant count, live response count "72 of 100 answered", answer distribution, and full leaderboard).
 * - PATCH: Host controls (`start_quiz`, `reveal_question`, `next_question`, `toggle_lock`, `remove_participant`, `end_session`, `update_settings`).
 */
export async function GET(req: NextRequest) {
  const auth = await requireApiUser(req, { requiredRole: 'admin' });
  if ('errorResponse' in auth) return auth.errorResponse;

  const url = new URL(req.url);
  const roomCode = (url.searchParams.get('roomCode') || '').trim().toUpperCase();

  const { quizRooms, quizParticipants, quizSubmissions } = await getCollections();

  if (!roomCode) {
    const rooms = await quizRooms.find({}).sort({ createdAt: -1 }).limit(25).toArray();
    return NextResponse.json(
      { rooms },
      { status: 200, headers: { 'Cache-Control': 'private, no-store' } }
    );
  }

  const { room, quizVersion } = await syncLiveRoomStateMachine(roomCode);
  if (!room || !quizVersion) {
    return NextResponse.json({ error: 'Live room not found' }, { status: 404 });
  }

  const [participants, submissions] = await Promise.all([
    quizParticipants.find({ roomCode: room.roomCode, removed: false }).toArray(),
    quizSubmissions.find({ roomCode: room.roomCode }).toArray(),
  ]);

  const ranked = rankParticipants(participants);
  const currentQIndex = room.currentQuestionIndex;
  const currentQSubmissions =
    currentQIndex >= 0
      ? submissions.filter((s) => s.questionIndex === currentQIndex)
      : [];

  // Build answer distribution for current question & all questions
  const currentQuestion =
    currentQIndex >= 0 ? quizVersion.questions[currentQIndex] || null : null;

  const currentDistribution: Record<string, number> = {};
  if (currentQuestion) {
    for (const opt of currentQuestion.options) {
      currentDistribution[opt.optionId] = 0;
    }
    for (const sub of currentQSubmissions) {
      currentDistribution[sub.selectedOptionId] =
        (currentDistribution[sub.selectedOptionId] || 0) + 1;
    }
  }

  const perQuestionStats = quizVersion.questions.map((q, idx) => {
    const qSubs = submissions.filter((s) => s.questionIndex === idx);
    const counts: Record<string, number> = {};
    for (const opt of q.options) {
      counts[opt.optionId] = 0;
    }
    let correctCount = 0;
    for (const s of qSubs) {
      counts[s.selectedOptionId] = (counts[s.selectedOptionId] || 0) + 1;
      if (s.isCorrect) correctCount++;
    }
    return {
      questionIndex: idx,
      questionId: q.questionId,
      promptEn: q.promptEn,
      promptMl: q.promptMl,
      type: q.type,
      correctOptionId: q.correctOptionId,
      totalResponses: qSubs.length,
      correctResponses: correctCount,
      accuracyPercent:
        qSubs.length > 0 ? Math.round((correctCount / qSubs.length) * 100) : 0,
      optionCounts: counts,
    };
  });

  return NextResponse.json(
    {
      serverNow: new Date().toISOString(),
      room,
      quizVersion,
      participantCount: participants.length,
      currentQuestionAnsweredCount: currentQSubmissions.length,
      // Only expose answer distribution after the question closes (status === 'question_revealed' or 'completed')
      currentQuestionDistribution:
        room.status === 'question_revealed' || room.status === 'completed'
          ? currentDistribution
          : null,
      leaderboard: ranked.map((p) => ({
        participantId: p.participantId,
        displayName: p.displayName,
        loginId: p.loginId,
        isGuest: p.isGuest,
        rank: p.rank,
        isTied: p.isTied,
        totalPoints: p.totalPoints,
        correctCount: p.correctCount,
        answeredCount: p.answeredCount,
        accuracyPercent:
          quizVersion.questions.length > 0
            ? Math.round((p.correctCount / quizVersion.questions.length) * 100)
            : 0,
        cumulativeCorrectTimeMs: p.cumulativeCorrectTimeMs,
        currentStreak: p.currentStreak,
        maxStreak: p.maxStreak,
      })),
      perQuestionStats:
        room.status === 'completed' || room.status === 'question_revealed'
          ? perQuestionStats
          : [],
    },
    { status: 200, headers: { 'Cache-Control': 'private, no-store' } }
  );
}

export async function POST(req: NextRequest) {
  const auth = await requireApiUser(req, { requiredRole: 'admin' });
  if ('errorResponse' in auth) return auth.errorResponse;

  try {
    const body = await req.json();
    const quizId = String(body.quizId || '').trim();
    const mode = body.mode === 'host_live' ? 'host_live' : 'auto_live';

    const { room, quizVersion } = await createLiveQuizRoom({
      quizId,
      mode,
      hostUserId: auth.user.userId,
      hostLoginId: auth.user.loginId,
      capacity: body.capacity ? Number(body.capacity) : 100,
      revealDurationSeconds: body.revealDurationSeconds
        ? Number(body.revealDurationSeconds)
        : undefined,
      scoringOverrides: body.scoringRules || undefined,
    });

    return NextResponse.json(
      { ok: true, room, quizVersion },
      { status: 201, headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to create live room' },
      { status: 400 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireApiUser(req, { requiredRole: 'admin' });
  if ('errorResponse' in auth) return auth.errorResponse;

  try {
    const body = await req.json();
    const roomCode = String(body.roomCode || '').trim().toUpperCase();
    const action = body.action;

    const updatedRoom = await executeHostRoomAction({
      roomCode,
      action,
      participantId: body.participantId,
      joinLocked: body.joinLocked,
      revealDurationSeconds: body.revealDurationSeconds,
      capacity: body.capacity,
    });

    return NextResponse.json(
      { ok: true, room: updatedRoom },
      { status: 200, headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to execute host room action' },
      { status: 400 }
    );
  }
}
