import { NextResponse } from 'next/server';
import { getCollections } from '@/lib/db/client';
import { getCurrentUser } from '@/features/auth/session';
import { ensureDefaultPublishedQuiz } from '@/features/quiz/service';

/**
 * Public Quiz Lobby Catalog Endpoint
 * - Accessible to both guests and signed-in readers so guests can reach the join screen and start self-paced quizzes.
 * - Never exposes correct answers or explanations in the catalog listing.
 */
export async function GET() {
  await ensureDefaultPublishedQuiz();
  const { quizzes, quizRooms } = await getCollections();
  const user = await getCurrentUser();

  const [publishedQuizzes, activeRooms] = await Promise.all([
    quizzes.find({ status: 'published' }).sort({ updatedAt: -1 }).toArray(),
    quizRooms
      .find({ status: { $in: ['lobby', 'question_open', 'question_revealed'] } })
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray(),
  ]);

  return NextResponse.json(
    {
      currentUser: user
        ? {
            userId: user.userId,
            loginId: user.loginId,
            displayName: user.displayName,
            role: user.role,
          }
        : null,
      quizzes: publishedQuizzes.map((q) => ({
        quizId: q.quizId,
        slug: q.slug,
        titleEn: q.titleEn,
        titleMl: q.titleMl,
        descriptionEn: q.descriptionEn,
        descriptionMl: q.descriptionMl,
        questionCount: q.questions.length,
        defaultTimeSeconds: q.defaultTimeSeconds,
        scoringRules: q.scoringRules,
        enabledModes: q.enabledModes,
        availableLanguages: {
          en: q.questions.some((item) => Boolean(item.promptEn)),
          ml: q.questions.some((item) => Boolean(item.promptMl)),
        },
      })),
      activeRooms: activeRooms.map((r) => ({
        roomCode: r.roomCode,
        quizId: r.quizId,
        mode: r.mode,
        status: r.status,
        joinLocked: r.joinLocked,
        capacity: r.capacity,
      })),
    },
    {
      status: 200,
      headers: { 'Cache-Control': 'private, no-store, no-cache, must-revalidate' },
    }
  );
}
