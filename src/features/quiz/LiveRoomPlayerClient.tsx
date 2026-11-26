'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Trophy,
  Flame,
  Clock,
  CheckCircle2,
  XCircle,
  Volume2,
  VolumeX,
  FileText,
  Lock,
  ExternalLink,
  Loader2,
  Users,
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

export default function LiveRoomPlayerClient({ roomCode }: { roomCode: string }) {
  const normalizedCode = roomCode.trim().toUpperCase();
  const [participantToken, setParticipantToken] = useState<string>('');
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [lang, setLang] = useState<'en' | 'ml'>('en');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [state, setState] = useState<any>(null);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [submittingOption, setSubmittingOption] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [muted, setMuted] = useState<boolean>(false);

  const lastPlayedRevealQRef = useRef<number>(-1);
  const lastPlayedPodiumRef = useRef<boolean>(false);

  useEffect(() => {
    setMuted(isQuizSoundMuted());
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem(`mudra_quiz_token_${normalizedCode}`);
      if (saved) setParticipantToken(saved);
    }
  }, [normalizedCode]);

  const pollRoomState = useCallback(async () => {
    try {
      const token =
        participantToken ||
        (typeof window !== 'undefined'
          ? window.localStorage.getItem(`mudra_quiz_token_${normalizedCode}`) || ''
          : '');
      const res = await fetch(
        `/api/quiz/rooms/${encodeURIComponent(normalizedCode)}/state?participantToken=${encodeURIComponent(
          token
        )}`,
        { cache: 'no-store' }
      );
      if (res.ok) {
        const data = await res.json();
        setState(data);
        if (data.me?.preferredLanguage) {
          setLang(data.me.preferredLanguage);
        }
      }
    } catch {
      // ignore transient network failure; automatic polling reconnects seamlessly
    }
  }, [normalizedCode, participantToken]);

  useEffect(() => {
    pollRoomState();
    const interval = setInterval(pollRoomState, 1000);
    return () => clearInterval(interval);
  }, [pollRoomState]);

  // Countdown timer & sound triggers
  useEffect(() => {
    if (!state?.room) return;
    const room = state.room;

    if (
      room.status === 'question_revealed' &&
      lastPlayedRevealQRef.current !== room.currentQuestionIndex
    ) {
      lastPlayedRevealQRef.current = room.currentQuestionIndex;
      if (state.me?.currentSubmission?.isCorrect) {
        playQuizSound('correct');
      } else if (state.me?.currentSubmission) {
        playQuizSound('wrong');
      }
    }

    if (room.status === 'completed' && !lastPlayedPodiumRef.current) {
      lastPlayedPodiumRef.current = true;
      playQuizSound('podium');
    }

    const tick = () => {
      if (room.status === 'question_open' && room.questionDeadlineAt) {
        const diff = new Date(room.questionDeadlineAt).getTime() - Date.now();
        setRemainingSeconds(Math.max(0, Math.ceil(diff / 1000)));
      } else if (
        room.status === 'question_revealed' &&
        room.mode === 'auto_live' &&
        room.revealEndsAt
      ) {
        const diff = new Date(room.revealEndsAt).getTime() - Date.now();
        setRemainingSeconds(Math.max(0, Math.ceil(diff / 1000)));
      } else {
        setRemainingSeconds(0);
      }
    };
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [state]);

  // Keyboard shortcuts (1-4 or A-D) for accessibility
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        !state?.room ||
        state.room.status !== 'question_open' ||
        !state.me ||
        state.me.currentSubmission
      ) {
        return;
      }
      const options = state.currentQuestion?.options || [];
      const key = e.key.toUpperCase();
      if (['1', '2', '3', '4'].includes(key)) {
        const idx = parseInt(key, 10) - 1;
        if (options[idx]) {
          handleSubmitAnswer(options[idx].optionId);
        }
      } else {
        const match = options.find(
          (o: { optionId: string }) => o.optionId === key
        );
        if (match) {
          handleSubmitAnswer(match.optionId);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  async function handleSwitchLanguage(nextLang: 'en' | 'ml') {
    setLang(nextLang);
    if (participantToken) {
      await fetch(`/api/quiz/rooms/${encodeURIComponent(normalizedCode)}/state`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantToken,
          preferredLanguage: nextLang,
        }),
      });
    }
  }

  async function handleQuickJoinInRoom(e: React.FormEvent) {
    e.preventDefault();
    setJoining(true);
    setJoinError(null);
    try {
      const res = await fetch(`/api/quiz/rooms/${encodeURIComponent(normalizedCode)}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode: normalizedCode,
          displayName: displayNameInput,
          participantToken: participantToken || null,
          preferredLanguage: lang,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setJoinError(data.error || 'Could not join room.');
        setJoining(false);
        return;
      }
      if (data.participant?.participantToken) {
        setParticipantToken(data.participant.participantToken);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(
            `mudra_quiz_token_${normalizedCode}`,
            data.participant.participantToken
          );
        }
      }
      await pollRoomState();
    } finally {
      setJoining(false);
    }
  }

  async function handleSubmitAnswer(optionId: string) {
    if (!state?.room || !participantToken || submittingOption) return;
    setSubmittingOption(optionId);
    setSubmitError(null);
    playQuizSound('select');

    try {
      const res = await fetch(
        `/api/quiz/rooms/${encodeURIComponent(normalizedCode)}/answer`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            participantToken,
            questionIndex: state.room.currentQuestionIndex,
            selectedOptionId: optionId,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || 'Could not submit answer.');
      } else {
        await pollRoomState();
      }
    } finally {
      setSubmittingOption(null);
    }
  }

  if (!state?.room) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center text-sm text-mudra-700">
        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-mudra-800" />
        Connecting to Live Quiz Room <strong className="font-mono">{normalizedCode}</strong>…
      </div>
    );
  }

  const { room, quiz, participantCount, currentQuestion, leaderboard, podium, me, isSignedInReader } =
    state;

  // If visitor opened shareable room link directly without joining yet, show inline join form
  if (!me) {
    return (
      <div className="mx-auto max-w-md px-4 py-10">
        <div className="rounded-3xl border-2 border-amber-400 bg-white p-6 sm:p-8 shadow-xl">
          <span className="rounded-lg bg-[#0b192c] px-3 py-1 font-mono text-xs font-bold text-amber-300">
            ROOM {room.roomCode}
          </span>
          <h1 className="mt-3 font-serif text-xl font-bold text-mudra-950">
            {lang === 'ml' ? quiz.titleMl || quiz.titleEn : quiz.titleEn || quiz.titleMl}
          </h1>
          <p className="mt-1 text-xs text-mudra-600">
            {participantCount} players in room • Enter your name to join
          </p>

          {joinError && (
            <div className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3 text-xs text-red-800 font-medium">
              {joinError}
            </div>
          )}

          <form onSubmit={handleQuickJoinInRoom} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-mudra-700 mb-1">
                Display Name
              </label>
              <input
                type="text"
                required
                value={displayNameInput}
                onChange={(e) => setDisplayNameInput(e.target.value)}
                placeholder="Enter your display name…"
                className="w-full rounded-xl border border-mudra-300 bg-parchment-50 px-4 py-3 text-sm font-semibold"
              />
            </div>

            <button
              type="submit"
              disabled={joining}
              className="w-full rounded-2xl bg-[#0b192c] py-3.5 text-sm font-black text-amber-300 hover:bg-mudra-900 shadow-lg"
            >
              {joining ? 'Joining…' : 'Enter Live Room'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const totalQuestions = room.totalQuestions || 1;
  const currentQNumber =
    room.currentQuestionIndex >= 0 ? room.currentQuestionIndex + 1 : 0;
  const progressPct =
    totalQuestions > 0 ? Math.round((currentQNumber / totalQuestions) * 100) : 0;

  return (
    <div className="mx-auto max-w-3xl px-3.5 sm:px-6 py-5 sm:py-8 space-y-5">
      {/* Top Player Status Bar: Question #, Score, Streak, Language Toggle & Mute */}
      <div className="rounded-3xl bg-[#0b192c] p-4 sm:p-5 text-white shadow-xl border border-white/10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-amber-400 px-3 py-1 font-mono text-xs font-black text-[#0b192c]">
              ROOM {room.roomCode}
            </span>
            <div>
              <p className="text-xs font-bold text-parchment-100">{me.displayName}</p>
              <p className="text-[11px] text-amber-300 font-mono">
                Score: <strong>{me.totalPoints.toLocaleString()} pts</strong>
                {me.rank ? ` • Rank #${me.isTied ? `=${me.rank}` : me.rank}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Streak Feedback Badge */}
            {me.currentStreak >= 2 && (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-orange-500/20 border border-orange-400/50 px-3 py-1 text-xs font-black text-orange-300 motion-safe:animate-pulse"
                data-testid="player-streak-badge"
              >
                <Flame className="h-3.5 w-3.5 text-orange-400 fill-current" />
                <span>{me.currentStreak} Streak!</span>
              </span>
            )}

            {/* Malayalam / English Language Switcher (Preserves Progress) */}
            <div
              className="flex items-center rounded-xl bg-white/10 p-1 text-xs"
              role="group"
              aria-label="Quiz Language Switcher"
            >
              <button
                type="button"
                onClick={() => handleSwitchLanguage('en')}
                className={`rounded-lg px-2.5 py-1 font-bold transition ${
                  lang === 'en' ? 'bg-amber-400 text-[#0b192c]' : 'text-parchment-200'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => handleSwitchLanguage('ml')}
                className={`rounded-lg px-2.5 py-1 font-bold transition ${
                  lang === 'ml' ? 'bg-amber-400 text-[#0b192c]' : 'text-parchment-200'
                }`}
              >
                മലയാളം
              </button>
            </div>

            {/* Persistent Sound Mute Button */}
            <button
              type="button"
              onClick={() => {
                const next = !muted;
                setMuted(next);
                setQuizSoundMuted(next);
              }}
              aria-label={muted ? 'Unmute quiz sound' : 'Mute quiz sound'}
              className="rounded-xl bg-white/10 border border-white/15 p-2 text-parchment-200 hover:bg-white/20"
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Question Progress Bar & Timer */}
        {room.status !== 'lobby' && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono font-bold text-parchment-200">
                Question {currentQNumber} of {totalQuestions}
              </span>
              {room.status === 'question_open' && (
                <span
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-0.5 font-mono text-xs font-black ${
                    remainingSeconds <= 5
                      ? 'bg-red-500 text-white'
                      : 'bg-amber-400 text-[#0b192c]'
                  }`}
                >
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
        )}
      </div>

      {/* STAGE 1: LOBBY SCREEN */}
      {room.status === 'lobby' && (
        <div className="rounded-3xl border border-mudra-200 bg-white p-6 sm:p-8 text-center shadow-sm space-y-5">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-800">
            <Users className="h-8 w-8" />
          </div>
          <div>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-900">
              You&apos;re in the Lobby! ({participantCount} players connected)
            </span>
            <h1 className="mt-3 font-serif text-2xl font-bold text-mudra-950">
              {lang === 'ml' ? quiz.titleMl || quiz.titleEn : quiz.titleEn || quiz.titleMl}
            </h1>
            <p className="mt-1 text-xs text-mudra-600">
              Waiting for the host to start Question 1…
            </p>
          </div>

          {/* Active Scoring Rules Shown Before Play */}
          <div className="rounded-2xl border border-mudra-200 bg-parchment-50 p-4 text-left text-xs space-y-1.5">
            <p className="font-bold text-mudra-950">Active Scoring Rules for This Room:</p>
            <ul className="list-disc pl-5 text-mudra-800 space-y-1">
              <li>
                Correct Answer: <strong>+{room.scoringRules.basePoints} points</strong>
              </li>
              <li>
                Speed Bonus:{' '}
                <strong>
                  {room.scoringRules.speedBonusEnabled
                    ? `Up to +${room.scoringRules.speedBonusMax} points based on how fast you answer`
                    : 'Off'}
                </strong>
              </li>
              <li>
                Streak Bonus:{' '}
                <strong>
                  {room.scoringRules.streakBonusEnabled
                    ? `+${room.scoringRules.streakBonusPoints} points from ${room.scoringRules.streakThreshold} consecutive correct answers onward`
                    : 'Off'}
                </strong>
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* STAGE 2: QUESTION OPEN OR REVEALED */}
      {(room.status === 'question_open' || room.status === 'question_revealed') &&
        currentQuestion && (
          <div className="rounded-3xl border border-mudra-200 bg-white p-5 sm:p-7 shadow-sm space-y-5">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-mudra-600">
                {currentQuestion.type === 'true_false'
                  ? 'True or False'
                  : 'Single-Answer Multiple Choice'}
              </span>
              <h2 className="mt-1 font-serif text-lg sm:text-xl font-bold text-mudra-950 leading-snug">
                {lang === 'ml'
                  ? currentQuestion.promptMl || currentQuestion.promptEn
                  : currentQuestion.promptEn || currentQuestion.promptMl}
              </h2>
            </div>

            {submitError && (
              <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-xs font-medium text-red-800">
                {submitError}
              </div>
            )}

            {/* Clear Submitted State Banner while Question is Still Open */}
            {room.status === 'question_open' && me.currentSubmission && (
              <div
                className="rounded-2xl border-2 border-emerald-500 bg-emerald-50 p-4 text-xs text-emerald-950 flex items-center justify-between"
                data-testid="answer-submitted-banner"
              >
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                  <div>
                    <p className="font-bold text-sm">
                      Answer Submitted! (Locked on Option{' '}
                      {me.currentSubmission.selectedOptionId})
                    </p>
                    <p className="text-emerald-800">
                      Recorded in {(me.currentSubmission.responseTimeMs / 1000).toFixed(2)}s •
                      Waiting for timer reveal…
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Responsive Touch/Keyboard Answer Cards Matched by Stable Option ID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {currentQuestion.options.map(
                (
                  opt: { optionId: string; textEn: string; textMl: string },
                  idx: number
                ) => {
                  const mySelectedId = me.currentSubmission?.selectedOptionId;
                  const isMyChoice = mySelectedId === opt.optionId;
                  const isRevealed = room.status === 'question_revealed';
                  const isCorrectOpt =
                    isRevealed && opt.optionId === currentQuestion.correctOptionId;
                  const isDisabled =
                    room.status !== 'question_open' ||
                    Boolean(mySelectedId) ||
                    Boolean(submittingOption);

                  let cardStyle = OPTION_STYLES[idx % OPTION_STYLES.length];
                  if (isRevealed) {
                    if (isCorrectOpt) {
                      cardStyle =
                        'border-emerald-600 bg-emerald-100 text-emerald-950 ring-2 ring-emerald-500';
                    } else if (isMyChoice && !isCorrectOpt) {
                      cardStyle = 'border-red-500 bg-red-100 text-red-950';
                    } else {
                      cardStyle = 'border-mudra-200 bg-gray-50 text-gray-500 opacity-75';
                    }
                  } else if (isMyChoice) {
                    cardStyle =
                      'border-[#0b192c] bg-[#0b192c] text-amber-300 ring-2 ring-amber-400';
                  }

                  return (
                    <button
                      key={opt.optionId}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => handleSubmitAnswer(opt.optionId)}
                      data-testid={`quiz-option-${opt.optionId}`}
                      className={`w-full text-left rounded-2xl border-2 p-4 sm:p-5 transition shadow-xs active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[#0b192c] ${cardStyle}`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-black/10 font-mono text-xs font-black">
                          {opt.optionId}
                        </span>
                        {isMyChoice && (
                          <span className="text-[11px] font-bold uppercase">
                            Your Answer
                          </span>
                        )}
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

            {/* ANSWER REVEAL + EXPLANATION + LINKED MUDRA PDF + LEADERBOARD BREAK */}
            {room.status === 'question_revealed' && (
              <div className="space-y-4 pt-3 border-t border-mudra-100">
                {/* Player's Score Feedback for This Question */}
                <div
                  className={`rounded-2xl border p-4 text-xs ${
                    me.currentSubmission?.isCorrect
                      ? 'border-emerald-400 bg-emerald-50 text-emerald-950'
                      : 'border-red-300 bg-red-50 text-red-950'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-sm">
                      {me.currentSubmission?.isCorrect ? (
                        <>
                          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                          <span>
                            Correct! +{me.currentSubmission.totalPointsEarned} Points
                          </span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-5 w-5 text-red-600" />
                          <span>
                            {me.currentSubmission
                              ? 'Incorrect (+0 Points)'
                              : 'Time Expired / Unanswered (+0 Points)'}
                          </span>
                        </>
                      )}
                    </div>
                    {me.rank && (
                      <span className="rounded-lg bg-[#0b192c] px-3 py-1 font-mono text-xs font-bold text-amber-300">
                        Live Rank: #{me.isTied ? `=${me.rank}` : me.rank}
                      </span>
                    )}
                  </div>

                  {(currentQuestion.explanationEn || currentQuestion.explanationMl) && (
                    <p className="mt-2.5 leading-relaxed">
                      <strong>Explanation:</strong>{' '}
                      {lang === 'ml'
                        ? currentQuestion.explanationMl || currentQuestion.explanationEn
                        : currentQuestion.explanationEn || currentQuestion.explanationMl}
                    </p>
                  )}

                  {/* Linked Mudra PDF Reference with Reader vs Guest Access Prompt */}
                  {currentQuestion.linkedDocSnapshot && (
                    <div className="mt-3 pt-2.5 border-t border-black/10 flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 font-semibold">
                        <FileText className="h-4 w-4" />
                        Reference Order: {currentQuestion.linkedDocSnapshot.documentNumber}
                      </span>
                      {isSignedInReader ? (
                        <Link
                          href={`/library/documents/${currentQuestion.linkedDocSnapshot.slug}`}
                          target="_blank"
                          className="inline-flex items-center gap-1 rounded-xl bg-[#0b192c] px-3 py-1.5 text-xs font-bold text-amber-300 hover:bg-mudra-900"
                        >
                          <span>Open in Mudra PDF Reader</span>
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      ) : (
                        <Link
                          href={`/login?returnTo=${encodeURIComponent(
                            `/library/documents/${currentQuestion.linkedDocSnapshot.slug}`
                          )}`}
                          className="inline-flex items-center gap-1 rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-bold text-mudra-950 hover:bg-amber-400"
                        >
                          <Lock className="h-3 w-3" />
                          <span>Sign In to Read Source PDF</span>
                        </Link>
                      )}
                    </div>
                  )}
                </div>

                {/* Live Leaderboard Break (Shared Leaderboard shows ONLY displayName and scores) */}
                <div className="rounded-2xl border border-mudra-200 bg-parchment-50 p-4">
                  <div className="flex items-center justify-between mb-2.5">
                    <h3 className="flex items-center gap-1.5 font-serif text-sm font-bold text-mudra-950">
                      <Trophy className="h-4 w-4 text-amber-500" />
                      Leaderboard Break
                    </h3>
                    {room.mode === 'auto_live' && remainingSeconds > 0 && (
                      <span className="text-xs font-mono font-bold text-mudra-700">
                        Next question in {remainingSeconds}s…
                      </span>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {leaderboard
                      .slice(0, 5)
                      .map(
                        (
                          item: {
                            displayName: string;
                            rank: number;
                            isTied: boolean;
                            totalPoints: number;
                          },
                          idx: number
                        ) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-xs border border-mudra-100"
                          >
                            <span className="font-bold text-mudra-950">
                              #{item.isTied ? `=${item.rank}` : item.rank} {item.displayName}
                            </span>
                            <span className="font-mono font-black text-mudra-900">
                              {item.totalPoints.toLocaleString()} pts
                            </span>
                          </div>
                        )
                      )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      {/* STAGE 3: COMPLETED PODIUM + END-OF-QUIZ REVIEW */}
      {room.status === 'completed' && (
        <div className="space-y-6">
          {/* Final Top-Three Podium */}
          <div
            className="rounded-3xl bg-gradient-to-br from-[#0b192c] via-[#132743] to-mudra-950 p-6 sm:p-8 text-white shadow-2xl border border-amber-400/30"
            data-testid="final-podium"
          >
            <div className="text-center mb-6">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 border border-amber-400/40 px-3.5 py-1 text-xs font-bold text-amber-300">
                <Award className="h-4 w-4" />
                Final Classroom Podium
              </span>
              <h2 className="mt-2 font-serif text-2xl sm:text-3xl font-bold text-white">
                {lang === 'ml' ? quiz.titleMl || quiz.titleEn : quiz.titleEn || quiz.titleMl}
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-amber-300 font-semibold">
                Your Final Score: {me.totalPoints.toLocaleString()} pts • Rank #
                {me.isTied ? `=${me.rank}` : me.rank} of {participantCount} •{' '}
                {me.correctCount}/{totalQuestions} Correct
              </p>
            </div>

            {podium?.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                {podium.map(
                  (
                    p: {
                      displayName: string;
                      rank: number;
                      isTied: boolean;
                      totalPoints: number;
                    },
                    idx: number
                  ) => (
                    <div
                      key={idx}
                      className={`rounded-2xl p-4 text-center border ${
                        p.rank === 1
                          ? 'bg-amber-400 text-[#0b192c] border-amber-200 shadow-xl sm:py-7'
                          : p.rank === 2
                          ? 'bg-white/15 text-white border-white/25 sm:py-5'
                          : 'bg-amber-900/50 text-amber-100 border-amber-500/30 sm:py-4'
                      }`}
                    >
                      <div className="font-mono text-xs font-black uppercase">
                        Place #{p.isTied ? `=${p.rank}` : p.rank}
                      </div>
                      <div className="mt-1 font-serif text-lg font-bold truncate">
                        {p.displayName}
                      </div>
                      <div className="mt-1 font-mono text-sm font-black">
                        {p.totalPoints.toLocaleString()} pts
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </div>

          {/* End-of-Quiz Question-by-Question Review with Linked Mudra PDFs */}
          {me.completedReview && (
            <div className="rounded-3xl border border-mudra-200 bg-white p-6 shadow-sm space-y-4">
              <h3 className="font-serif text-xl font-bold text-mudra-950">
                Your End-of-Quiz Answer Review
              </h3>
              <div className="space-y-4">
                {me.completedReview.map(
                  (rev: {
                    questionIndex: number;
                    questionNumber: number;
                    promptEn: string;
                    promptMl: string;
                    options: Array<{ optionId: string; textEn: string; textMl: string }>;
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
                      <div className="flex items-center justify-between font-bold mb-1.5">
                        <span className="text-mudra-900">
                          Question {rev.questionNumber}
                        </span>
                        <span
                          className={
                            rev.isCorrect ? 'text-emerald-800' : 'text-red-800'
                          }
                        >
                          {rev.isCorrect
                            ? `✓ Correct (+${rev.pointsEarned} pts)`
                            : `✗ Incorrect (Your Answer: ${
                                rev.selectedOptionId || 'None'
                              } • Correct: ${rev.correctOptionId})`}
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
                        <div className="mt-3 pt-2 border-t border-mudra-200/60 flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-mudra-800">
                            Source Order: {rev.linkedDocSnapshot.documentNumber}
                          </span>
                          {isSignedInReader ? (
                            <Link
                              href={`/library/documents/${rev.linkedDocSnapshot.slug}`}
                              target="_blank"
                              className="inline-flex items-center gap-1 rounded-xl bg-[#0b192c] px-3 py-1.5 font-bold text-amber-300"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              <span>Read Source PDF</span>
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
                              <span>Sign In to Open Mudra PDF</span>
                            </Link>
                          )}
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
