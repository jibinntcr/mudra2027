import Link from 'next/link';
import { requireServerUser } from '@/features/auth/session';
import { getCollections } from '@/lib/db/client';
import { History, Trophy, Calendar, ArrowUpRight, Play } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ReaderQuizHistoryPage() {
  const user = await requireServerUser({ returnTo: '/quiz/history' });
  const { quizAttempts } = await getCollections();

  const attempts = await quizAttempts
    .find({
      $or: [{ userId: user.userId }, { loginId: user.loginId }],
    })
    .sort({ startedAt: -1 })
    .limit(50)
    .toArray();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      <div className="rounded-3xl bg-gradient-to-r from-[#0b192c] via-[#132743] to-[#0b192c] p-6 sm:p-8 text-white shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 border border-amber-400/40 px-3 py-1 text-xs font-bold text-amber-300">
            <History className="h-3.5 w-3.5" />
            Subscriber Quiz History
          </span>
          <h1 className="mt-2 font-serif text-2xl sm:text-3xl font-bold text-white">
            My Quiz History ({user.displayName})
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-parchment-200">
            Review your past Live Classroom sessions and Self-Paced attempts, scores, accuracy, and
            linked Mudra PDF explanations.
          </p>
        </div>

        <Link
          href="/quiz"
          className="inline-flex items-center gap-2 rounded-2xl bg-amber-400 px-5 py-3 text-xs font-black text-[#0b192c] hover:bg-amber-300 shadow"
        >
          <Play className="h-4 w-4 fill-current" />
          <span>Go to Quiz Arena</span>
        </Link>
      </div>

      {attempts.length === 0 ? (
        <div className="rounded-3xl border border-mudra-200 bg-white p-12 text-center">
          <Trophy className="h-10 w-10 text-mudra-400 mx-auto mb-2" />
          <h2 className="font-serif text-lg font-bold text-mudra-950">
            No Quiz Attempts Yet
          </h2>
          <p className="mt-1 text-xs text-mudra-600">
            Join a live room or start a self-paced quiz to track your scores and explanations here.
          </p>
          <Link
            href="/quiz"
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#0b192c] px-5 py-2.5 text-xs font-bold text-amber-300"
          >
            Start Your First Quiz
          </Link>
        </div>
      ) : (
        <div className="space-y-3.5">
          {attempts.map((a) => {
            const reviewHref =
              a.mode === 'self_paced'
                ? `/quiz/self-paced/${a.attemptId}`
                : `/quiz/self-paced/${a.attemptId}`;

            return (
              <div
                key={a.attemptId}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-mudra-200 bg-white p-5 shadow-2xs"
                data-testid="quiz-history-item"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-lg bg-[#0b192c] px-2.5 py-0.5 font-mono text-xs font-bold text-amber-300 uppercase">
                      {a.mode.replace('_', ' ')}
                      {a.roomCode ? ` • Room ${a.roomCode}` : ''}
                    </span>
                    <span className="rounded-lg bg-parchment-100 border border-mudra-200 px-2.5 py-0.5 text-xs font-bold text-mudra-900">
                      v{a.version}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-mudra-600">
                      <Calendar className="h-3.5 w-3.5" />
                      {new Date(a.completedAt || a.startedAt).toLocaleDateString()}
                    </span>
                  </div>

                  <h3 className="font-serif text-base sm:text-lg font-bold text-mudra-950">
                    {a.quizTitleEn || a.quizTitleMl}
                  </h3>
                  {a.quizTitleMl && a.quizTitleEn && (
                    <p className="text-xs text-mudra-700">{a.quizTitleMl}</p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-4 shrink-0">
                  <div className="text-right">
                    <div className="font-mono text-base font-black text-mudra-950">
                      {a.totalPoints.toLocaleString()} pts
                    </div>
                    <div className="text-xs font-semibold text-emerald-800">
                      {a.correctCount}/{a.totalQuestions} Correct ({a.accuracyPercent}%)
                      {a.rank ? ` • Rank #${a.rank}` : ''}
                    </div>
                  </div>

                  <Link
                    href={reviewHref}
                    className="inline-flex items-center gap-1 rounded-xl bg-[#0b192c] px-4 py-2.5 text-xs font-bold text-amber-300 hover:bg-mudra-900"
                  >
                    <span>Review Answers</span>
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
