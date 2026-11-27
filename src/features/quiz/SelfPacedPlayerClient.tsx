'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Flame,
  Clock,
  CheckCircle2,
  XCircle,
  Volume2,
  VolumeX,
  FileText,
  Lock,
  ExternalLink,
  ArrowRight,
  Loader2,
  Award,
} from 'lucide-react';
import {
  isQuizSoundMuted,
  setQuizSoundMuted,
  playQuizSound,
} from '@/features/quiz/sound';

const OPTION_STYLES = [
  'border-amber-400 bg-amber-50/90 hover:bg-amber-100 text-mudra-950',
  'border-sky-400 bg-sky-50/90 hover:bg-sky-100 text-slate-950',
  'border-emerald-400 bg-emerald-50/90 hover:bg-emerald-100 text-emerald-950',
  'border-purple-400 bg-purple-50/90 hover:bg-purple-100 text-purple-950',
];

export default function SelfPacedPlayerClient({ attemptId }: { attemptId: string }) {
  const [attemptToken, setAttemptToken] = useState<string>('');
  const [lang, setLang] = useState<'en' | 'ml'>('en');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [stepFeedback, setStepFeedback] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(20);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    setMuted(isQuizSoundMuted());
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem(`mudra_attempt_token_${attemptId}`);
      if (saved) setAttemptToken(saved);
    }
  }, [attemptId]);

  const loadAttempt = useCallback(async () => {
    const token =
      attemptToken ||
      (typeof window !== 'undefined'
        ? window.localStorage.getItem(`mudra_attempt_token_${attemptId}`) || ''
        : '');
    const res = await fetch(
      `/api/quiz/self-paced/${encodeURIComponent(
        attemptId
      )}?attemptToken=${encodeURIComponent(token)}`,
      { cache: 'no-store' }
    );
    if (res.ok) {
      const json = await res.json();
      setData(json);
      if (json.attempt?.preferredLanguage) {
        setLang(json.attempt.preferredLanguage);
      }
      if (json.currentQuestion) {
        setRemainingSeconds(json.currentQuestion.timeLimitSeconds || 20);
      }
    }
  }, [attemptId, attemptToken]);

  useEffect(() => {
    loadAttempt();
  }, [loadAttempt]);

  // Countdown timer for active self-paced question
  useEffect(() => {
    if (!data?.currentQuestion || stepFeedback || data?.attempt?.status === 'completed') {
      return;
    }
    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleAnswer('TIMEOUT', true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.currentQuestion?.questionIndex, stepFeedback, data?.attempt?.status]);

  async function handleSwitchLang(nextLang: 'en' | 'ml') {
    setLang(nextLang);
    const token =
      attemptToken ||
      (typeof window !== 'undefined'
        ? window.localStorage.getItem(`mudra_attempt_token_${attemptId}`) || ''
        : '');
    await fetch(`/api/quiz/self-paced/${encodeURIComponent(attemptId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attemptToken: token,
        action: 'switch_language',
        preferredLanguage: nextLang,
      }),
    });
  }

  async function handleAnswer(optionId: string, timedOut = false) {
    if (submitting || stepFeedback || !data?.currentQuestion) return;
    setSubmitting(true);
    const token =
      attemptToken ||
      (typeof window !== 'undefined'
        ? window.localStorage.getItem(`mudra_attempt_token_${attemptId}`) || ''
        : '');

    try {
      const res = await fetch(`/api/quiz/self-paced/${encodeURIComponent(attemptId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptToken: token,
          questionIndex: data.currentQuestion.questionIndex,
          selectedOptionId: optionId,
          timedOut,
        }),
      });
      const json = await res.json();
      if (res.ok && json.feedback) {
        if (json.feedback.isCorrect) {
          playQuizSound('correct');
        } else {
          playQuizSound('wrong');
        }
        setStepFeedback(json.feedback);
        if (json.completed) {
          setTimeout(() => {
            setStepFeedback(null);
            loadAttempt();
          }, 1800);
        }
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleNextQuestion() {
    setStepFeedback(null);
    await loadAttempt();
  }

  if (!data?.attempt) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center text-sm text-mudra-700">
        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
        Loading Self-Paced Quiz Attempt…
      </div>
    );
  }

  const { attempt, currentQuestion, completedReview, isSignedInReader } = data;
  const progressPct =
    attempt.totalQuestions > 0
      ? Math.round(
          ((attempt.status === 'completed'
            ? attempt.totalQuestions
            : attempt.currentQuestionIndex + 1) /
            attempt.totalQuestions) *
            100
        )
      : 0;

  return (
    <div className="mx-auto max-w-3xl px-3.5 sm:px-6 py-6 sm:py-8 space-y-5">
      {/* Top Player Bar */}
      <div className="rounded-3xl bg-[#0b192c] p-4 sm:p-5 text-white shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="rounded-lg bg-amber-400 px-2.5 py-0.5 font-mono text-[11px] font-black text-[#0b192c] uppercase">
              Self-Paced Mode
            </span>
            <h1 className="mt-1 font-serif text-base sm:text-lg font-bold text-white">
              {lang === 'ml'
                ? attempt.quizTitleMl || attempt.quizTitleEn
                : attempt.quizTitleEn || attempt.quizTitleMl}
            </h1>
            <p className="text-xs text-amber-300 font-mono">
              Player: {attempt.displayName} • Score:{' '}
              <strong>{attempt.totalPoints.toLocaleString()} pts</strong>
            </p>
          </div>

          <div className="flex items-center gap-2">
            {attempt.currentStreak >= 2 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/20 border border-orange-400/50 px-3 py-1 text-xs font-black text-orange-300">
                <Flame className="h-3.5 w-3.5 text-orange-400 fill-current" />
                <span>{attempt.currentStreak} Streak!</span>
              </span>
            )}

            <div className="flex items-center rounded-xl bg-white/10 p-1 text-xs">
              <button
                type="button"
                onClick={() => handleSwitchLang('en')}
                className={`rounded-lg px-2.5 py-1 font-bold ${
                  lang === 'en' ? 'bg-amber-400 text-[#0b192c]' : 'text-parchment-200'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => handleSwitchLang('ml')}
                className={`rounded-lg px-2.5 py-1 font-bold ${
                  lang === 'ml' ? 'bg-amber-400 text-[#0b192c]' : 'text-parchment-200'
                }`}
              >
                മലയാളം
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                const next = !muted;
                setMuted(next);
                setQuizSoundMuted(next);
              }}
              className="rounded-xl bg-white/10 border border-white/15 p-2 text-parchment-200"
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono font-bold text-parchment-200">
              {attempt.status === 'completed'
                ? `Completed (${attempt.totalQuestions}/${attempt.totalQuestions})`
                : `Question ${attempt.currentQuestionIndex + 1} of ${attempt.totalQuestions}`}
            </span>
            {attempt.status === 'in_progress' && !stepFeedback && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-amber-400 px-2.5 py-0.5 font-mono text-xs font-black text-[#0b192c]">
                <Clock className="h-3.5 w-3.5" />
                {remainingSeconds}s
              </span>
            )}
          </div>
          <div className="h-2 w-full rounded-full bg-white/15 overflow-hidden">
            <div
              className="h-full bg-amber-400 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* IN-PROGRESS QUESTION */}
      {attempt.status === 'in_progress' && currentQuestion && (
        <div className="rounded-3xl border border-mudra-200 bg-white p-5 sm:p-7 shadow-sm space-y-5">
          {(currentQuestion.sectionEn || currentQuestion.sectionMl) && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg bg-amber-100 border border-amber-300 px-3 py-1 text-xs font-black text-mudra-950">
                {lang === 'ml'
                  ? currentQuestion.sectionMl || currentQuestion.sectionEn
                  : currentQuestion.sectionEn || currentQuestion.sectionMl}
              </span>
            </div>
          )}
          <h2 className="font-serif text-lg sm:text-xl font-bold text-mudra-950 leading-snug">
            {lang === 'ml'
              ? currentQuestion.promptMl || currentQuestion.promptEn
              : currentQuestion.promptEn || currentQuestion.promptMl}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {currentQuestion.options.map(
              (
                opt: { optionId: string; textEn: string; textMl: string },
                idx: number
              ) => {
                const isSelected = stepFeedback?.selectedOptionId === opt.optionId;
                const isCorrect =
                  stepFeedback && opt.optionId === stepFeedback.correctOptionId;

                let style = OPTION_STYLES[idx % OPTION_STYLES.length];
                if (stepFeedback) {
                  if (isCorrect) {
                    style = 'border-emerald-600 bg-emerald-100 text-emerald-950 ring-2 ring-emerald-500';
                  } else if (isSelected && !isCorrect) {
                    style = 'border-red-500 bg-red-100 text-red-950';
                  } else {
                    style = 'border-mudra-200 bg-gray-50 text-gray-500 opacity-75';
                  }
                }

                return (
                  <button
                    key={opt.optionId}
                    type="button"
                    disabled={Boolean(stepFeedback) || submitting}
                    onClick={() => handleAnswer(opt.optionId, false)}
                    className={`w-full text-left rounded-2xl border-2 p-4 sm:p-5 transition shadow-xs ${style}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-black/10 font-mono text-xs font-black">
                        {opt.optionId}
                      </span>
                    </div>
                    <p className="text-sm sm:text-base font-bold leading-snug">
                      {lang === 'ml'
                        ? opt.textMl || opt.textEn
                        : opt.textEn || opt.textMl}
                    </p>
                  </button>
                );
              }
            )}
          </div>

          {stepFeedback && (
            <div className="rounded-2xl border border-mudra-200 bg-parchment-50 p-4 text-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-sm">
                  {stepFeedback.isCorrect ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      <span className="text-emerald-900">
                        Correct! +{stepFeedback.totalPointsEarned} Points
                      </span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-5 w-5 text-red-600" />
                      <span className="text-red-900">
                        Incorrect (Correct Answer: Option {stepFeedback.correctOptionId})
                      </span>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleNextQuestion}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#0b192c] px-4 py-2 text-xs font-bold text-amber-300 hover:bg-mudra-900"
                >
                  <span>Next Question</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>

              {(stepFeedback.explanationEn || stepFeedback.explanationMl) && (
                <p className="text-mudra-800 leading-relaxed">
                  <strong>Explanation:</strong>{' '}
                  {lang === 'ml'
                    ? stepFeedback.explanationMl || stepFeedback.explanationEn
                    : stepFeedback.explanationEn || stepFeedback.explanationMl}
                </p>
              )}

              {stepFeedback.linkedDocSnapshot && (
                <div className="pt-2 border-t border-mudra-200 flex items-center justify-between">
                  <span className="font-semibold text-mudra-800">
                    Reference Order: {stepFeedback.linkedDocSnapshot.documentNumber}
                  </span>
                  {isSignedInReader ? (
                    <Link
                      href={`/library/documents/${stepFeedback.linkedDocSnapshot.slug}`}
                      target="_blank"
                      className="inline-flex items-center gap-1 rounded-xl bg-[#0b192c] px-3 py-1.5 font-bold text-amber-300"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      <span>Open Mudra PDF</span>
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  ) : (
                    <Link
                      href={`/login?returnTo=${encodeURIComponent(
                        `/library/documents/${stepFeedback.linkedDocSnapshot.slug}`
                      )}`}
                      className="inline-flex items-center gap-1 rounded-xl bg-amber-500 px-3 py-1.5 font-bold text-mudra-950"
                    >
                      <Lock className="h-3.5 w-3.5" />
                      <span>Sign In to Open PDF</span>
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* COMPLETED SUMMARY & REVIEW */}
      {attempt.status === 'completed' && (
        <div className="space-y-6">
          <div className="rounded-3xl bg-gradient-to-br from-[#0b192c] via-[#132743] to-mudra-950 p-6 sm:p-8 text-center text-white shadow-2xl">
            <Award className="h-12 w-12 text-amber-400 mx-auto mb-2" />
            <h2 className="font-serif text-2xl sm:text-3xl font-bold">
              Quiz Completed!
            </h2>
            <p className="mt-2 font-mono text-lg font-black text-amber-300">
              {attempt.totalPoints.toLocaleString()} Points • {attempt.correctCount}/
              {attempt.totalQuestions} Correct ({attempt.accuracyPercent}% Accuracy)
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Link
                href="/quiz"
                className="rounded-xl bg-amber-400 px-5 py-2.5 text-xs font-black text-[#0b192c]"
              >
                Play Another Quiz
              </Link>
              {isSignedInReader && (
                <Link
                  href="/quiz/history"
                  className="rounded-xl bg-white/10 border border-white/20 px-5 py-2.5 text-xs font-bold text-white"
                >
                  View My Quiz History
                </Link>
              )}
            </div>
          </div>

          {completedReview && (
            <div className="rounded-3xl border border-mudra-200 bg-white p-6 shadow-sm space-y-4">
              <h3 className="font-serif text-xl font-bold text-mudra-950">
                Complete Question &amp; Source PDF Review
              </h3>
              {completedReview.map(
                (rev: {
                  questionIndex: number;
                  questionNumber: number;
                  promptEn: string;
                  promptMl: string;
                  selectedOptionId: string | null;
                  correctOptionId: string;
                  isCorrect: boolean;
                  pointsEarned: number;
                  explanationEn: string;
                  explanationMl: string;
                  linkedDocSnapshot: {
                    docId: string;
                    slug: string;
                    documentNumber: string;
                  } | null;
                }) => (
                  <div
                    key={rev.questionIndex}
                    className={`rounded-2xl border p-4 text-xs ${
                      rev.isCorrect
                        ? 'border-emerald-300 bg-emerald-50/40'
                        : 'border-red-200 bg-red-50/40'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold mb-1">
                      <span>Question {rev.questionNumber}</span>
                      <span
                        className={
                          rev.isCorrect ? 'text-emerald-800' : 'text-red-800'
                        }
                      >
                        {rev.isCorrect
                          ? `✓ Correct (+${rev.pointsEarned} pts)`
                          : `✗ Your Answer: ${rev.selectedOptionId || 'None'} • Correct: ${
                              rev.correctOptionId
                            }`}
                      </span>
                    </div>
                    <p className="font-semibold text-sm text-mudra-950">
                      {lang === 'ml'
                        ? rev.promptMl || rev.promptEn
                        : rev.promptEn || rev.promptMl}
                    </p>
                    {(rev.explanationEn || rev.explanationMl) && (
                      <p className="mt-2 text-mudra-800 leading-relaxed">
                        <strong>Explanation:</strong>{' '}
                        {lang === 'ml'
                          ? rev.explanationMl || rev.explanationEn
                          : rev.explanationEn || rev.explanationMl}
                      </p>
                    )}
                    {rev.linkedDocSnapshot && (
                      <div className="mt-3 pt-2 border-t border-mudra-200/60 flex items-center justify-between">
                        <span className="font-semibold text-mudra-800">
                          Reference PDF: {rev.linkedDocSnapshot.documentNumber}
                        </span>
                        {isSignedInReader ? (
                          <Link
                            href={`/library/documents/${rev.linkedDocSnapshot.slug}`}
                            target="_blank"
                            className="inline-flex items-center gap-1 rounded-xl bg-[#0b192c] px-3 py-1.5 font-bold text-amber-300"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            <span>Open in Mudra PDF Reader</span>
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        ) : (
                          <Link
                            href={`/login?returnTo=${encodeURIComponent(
                              `/library/documents/${rev.linkedDocSnapshot.slug}`
                            )}`}
                            className="inline-flex items-center gap-1 rounded-xl bg-amber-500 px-3 py-1.5 font-bold text-mudra-950"
                          >
                            <Lock className="h-3.5 w-3.5" />
                            <span>Sign In to Read Source PDF</span>
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
