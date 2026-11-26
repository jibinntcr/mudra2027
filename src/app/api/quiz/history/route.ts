import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/features/auth/session';
import { getCollections } from '@/lib/db/client';

/**
 * Signed-In Reader "My Quiz History" Endpoint
 * Returns all past live and self-paced attempts belonging ONLY to the authenticated reader.
 */
export async function GET(req: NextRequest) {
  const auth = await requireApiUser(req);
  if ('errorResponse' in auth) return auth.errorResponse;

  const { quizAttempts } = await getCollections();
  const attempts = await quizAttempts
    .find({
      $or: [{ userId: auth.user.userId }, { loginId: auth.user.loginId }],
    })
    .sort({ startedAt: -1 })
    .limit(50)
    .toArray();

  return NextResponse.json(
    {
      user: {
        userId: auth.user.userId,
        loginId: auth.user.loginId,
        displayName: auth.user.displayName,
        role: auth.user.role,
      },
      attempts: attempts.map((a) => ({
        attemptId: a.attemptId,
        attemptToken: a.attemptToken,
        mode: a.mode,
        roomCode: a.roomCode,
        quizId: a.quizId,
        version: a.version,
        quizTitleEn: a.quizTitleEn,
        quizTitleMl: a.quizTitleMl,
        status: a.status,
        totalQuestions: a.totalQuestions,
        totalPoints: a.totalPoints,
        correctCount: a.correctCount,
        answeredCount: a.answeredCount,
        accuracyPercent: a.accuracyPercent,
        maxStreak: a.maxStreak,
        rank: a.rank,
        totalParticipantsInRoom: a.totalParticipantsInRoom,
        startedAt: a.startedAt,
        completedAt: a.completedAt,
      })),
    },
    { status: 200, headers: { 'Cache-Control': 'private, no-store' } }
  );
}
