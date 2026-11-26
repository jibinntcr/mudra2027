import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/features/auth/session';
import { getCollections } from '@/lib/db/client';
import { syncLiveRoomStateMachine } from '@/features/quiz/service';
import { rankParticipants } from '@/features/quiz/scoring';
import { generateRoomReportExcelBuffer } from '@/features/quiz/excel';

/**
 * Authorized Admin/Host `.xlsx` Report Export Endpoint
 * Exports participant rankings, scores, accuracy, response times, and per-question answer distributions.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ roomCode: string }> }
) {
  const auth = await requireApiUser(req, { requiredRole: 'admin' });
  if ('errorResponse' in auth) return auth.errorResponse;

  const { roomCode } = await context.params;
  const normalizedCode = roomCode.trim().toUpperCase();

  const { room, quizVersion } = await syncLiveRoomStateMachine(normalizedCode);
  if (!room || !quizVersion) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  }

  const { quizParticipants, quizSubmissions } = await getCollections();
  const [participants, submissions] = await Promise.all([
    quizParticipants.find({ roomCode: normalizedCode, removed: false }).toArray(),
    quizSubmissions.find({ roomCode: normalizedCode }).toArray(),
  ]);

  const ranked = rankParticipants(participants);
  const totalQuestions = quizVersion.questions.length;

  const participantRows = ranked.map((p) => ({
    rank: p.rank,
    displayName: p.displayName,
    loginId: p.loginId,
    isGuest: p.isGuest,
    totalPoints: p.totalPoints,
    correctCount: p.correctCount,
    answeredCount: p.answeredCount,
    totalQuestions,
    accuracyPercent:
      totalQuestions > 0 ? Math.round((p.correctCount / totalQuestions) * 100) : 0,
    cumulativeCorrectTimeMs: p.cumulativeCorrectTimeMs,
    maxStreak: p.maxStreak,
  }));

  const questionBreakdowns = quizVersion.questions.map((q, idx) => {
    const qSubs = submissions.filter((s) => s.questionIndex === idx);
    const optionCounts: Record<string, number> = {};
    for (const opt of q.options) {
      optionCounts[opt.optionId] = 0;
    }
    let correctAnswers = 0;
    for (const s of qSubs) {
      optionCounts[s.selectedOptionId] = (optionCounts[s.selectedOptionId] || 0) + 1;
      if (s.isCorrect) correctAnswers++;
    }
    return {
      questionNumber: idx + 1,
      promptEn: q.promptEn,
      promptMl: q.promptMl,
      type: q.type,
      correctOptionId: q.correctOptionId,
      totalAnswers: qSubs.length,
      correctAnswers,
      accuracyPercent:
        qSubs.length > 0 ? Math.round((correctAnswers / qSubs.length) * 100) : 0,
      optionCounts,
    };
  });

  const excelBuf = generateRoomReportExcelBuffer({
    roomCode: normalizedCode,
    quizTitleEn: quizVersion.titleEn,
    quizTitleMl: quizVersion.titleMl,
    mode: room.mode,
    completedAt: room.completedAt,
    participants: participantRows,
    questionBreakdowns,
  });

  return new NextResponse(new Uint8Array(excelBuf), {
    status: 200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="Mudra_Quiz_Report_${normalizedCode}.xlsx"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
