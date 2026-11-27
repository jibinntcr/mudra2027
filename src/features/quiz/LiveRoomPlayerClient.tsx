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
  SkipForward,
  Eye,
  RotateCcw,
  Zap,
  Crown,
  Sparkles,
  Play,
} from 'lucide-react';
import {
  isQuizSoundMuted,
  setQuizSoundMuted,
  playQuizSound,
} from '@/features/quiz/sound';

const GAMIFIED_OPTION_TILES = [
  {
    bg: 'from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 border-rose-400/60 text-white shadow-rose-950/40',
    badge: 'bg-black/25 text-rose-100 border border-white/20',
    shape: '▲',
  },
  {
    bg: 'from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 border-blue-400/60 text-white shadow-indigo-950/40',
    badge: 'bg-black/25 text-blue-100 border border-white/20',
    shape: '◆',
  },
  {
    bg: 'from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 border-amber-300/70 text-white shadow-orange-950/40',
    badge: 'bg-black/25 text-amber-100 border border-white/20',
    shape: '●',
  },
  {
    bg: 'from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 border-emerald-400/60 text-white shadow-emerald-950/40',
    badge: 'bg-black/25 text-emerald-100 border border-white/20',
    shape: '■',
  },
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
  const [advancing, setAdvancing] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [muted, setMuted] = useState<boolean>(false);
  const [mobileRankDrawerOpen, setMobileRankDrawerOpen] = useState<boolean>(false);

  const lastPlayedRevealQRef = useRef<number>(-1);
  const lastPlayedPodiumRef = useRef<boolean>(false);
  const serverClockOffsetMsRef = useRef<number>(0);

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
        `/api/quiz/rooms/${encodeURIComponent(
          normalizedCode
        )}/state?participantToken=${encodeURIComponent(token)}`,
        { cache: 'no-store' }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.serverNow) {
          serverClockOffsetMsRef.current =
            new Date(data.serverNow).getTime() - Date.now();
        }
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
      const alignedNow = Date.now() + serverClockOffsetMsRef.current;
      if (room.status === 'question_open' && room.questionDeadlineAt) {
        const diff = new Date(room.questionDeadlineAt).getTime() - alignedNow;
        setRemainingSeconds(Math.max(0, Math.ceil(diff / 1000)));
      } else if (
        room.status === 'question_revealed' &&
        room.mode === 'auto_live' &&
        room.revealEndsAt
      ) {
        const diff = new Date(room.revealEndsAt).getTime() - alignedNow;
        setRemainingSeconds(Math.max(0, Math.ceil(diff / 1000)));
      } else {
        setRemainingSeconds(0);
      }
    };
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [state]);

  // Clear submitError automatically whenever question index or room status changes
  useEffect(() => {
    setSubmitError(null);
  }, [state?.room?.currentQuestionIndex, state?.room?.status]);

  // Keyboard shortcuts (1-4 or A-D) for accessibility — disabled when typing in input fields
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
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
        const match = options.find((o: { optionId: string }) => o.optionId === key);
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

  async function handleRoomTransitionAction(
    action: 'start_demo_room' | 'reveal_question' | 'next_question' | 'restart_demo_room'
  ) {
    setAdvancing(true);
    setSubmitError(null);
    playQuizSound('select');
    try {
      await fetch(`/api/quiz/rooms/${encodeURIComponent(normalizedCode)}/state`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantToken,
          action,
          expectedQuestionIndex:
            typeof state?.room?.currentQuestionIndex === 'number'
              ? state.room.currentQuestionIndex
              : undefined,
        }),
      });
      await pollRoomState();
    } finally {
      setAdvancing(false);
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
          window.localStorage.setItem(
            `mudra_quiz_name_${normalizedCode}`,
            data.participant.displayName || displayNameInput.trim()
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
        if (data.code === 'LATE_SUBMISSION') {
          // Another player or timer just revealed the question; sync immediately without showing an error
          await pollRoomState();
        } else {
          setSubmitError(data.error || 'Could not submit answer.');
        }
      } else {
        await pollRoomState();
      }
    } finally {
      setSubmittingOption(null);
    }
  }

  if (!state?.room) {
    return (
      <div className="min-h-[75vh] flex flex-col items-center justify-center bg-[#070f1d] text-white px-4">
        <Loader2 className="h-8 w-8 animate-spin mb-3 text-amber-400" />
        <p className="text-sm font-bold">
          Entering Live Quiz Arena <span className="font-mono text-amber-300">{normalizedCode}</span>…
        </p>
      </div>
    );
  }

  const {
    room,
    quiz,
    participantCount,
    currentQuestionAnsweredCount,
    currentQuestion,
    leaderboard,
    podium,
    me,
    isSignedInReader,
  } = state;

  // If visitor opened shareable room link directly without joining yet, show gamified join gate
  if (!me) {
    return (
      <div className="min-h-[80vh] bg-gradient-to-b from-[#070f1d] via-[#0b192c] to-[#132743] px-4 py-12 flex items-center justify-center">
        <div className="w-full max-w-md rounded-3xl border-2 border-amber-400 bg-[#0b192c] p-7 text-white shadow-2xl">
          <div className="flex items-center justify-between">
            <span className="rounded-xl bg-amber-400 px-3 py-1 font-mono text-xs font-black text-[#0b192c]">
              ARENA {room.roomCode}
            </span>
            <span className="text-xs text-emerald-300 font-bold">
              ● {participantCount} Players Inside
            </span>
          </div>

          <h1 className="mt-4 font-serif text-2xl font-bold text-white">
            {lang === 'ml' ? quiz.titleMl || quiz.titleEn : quiz.titleEn || quiz.titleMl}
          </h1>
          <p className="mt-1 text-xs text-parchment-200">
            Enter your player name to jump into the live classroom arena
          </p>

          {joinError && (
            <div className="mt-4 rounded-xl border border-red-400 bg-red-950/70 p-3 text-xs text-red-200 font-medium">
              {joinError}
            </div>
          )}

          <form onSubmit={handleQuickJoinInRoom} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-amber-300 mb-1.5">
                Player Display Name
              </label>
              <input
                type="text"
                required
                value={displayNameInput}
                onChange={(e) => setDisplayNameInput(e.target.value)}
                placeholder="Type your nickname…"
                className="w-full rounded-2xl border-2 border-white/20 bg-white/10 px-4 py-3 text-base font-bold text-white placeholder:text-white/40 focus:border-amber-400 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={joining}
              className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 py-3.5 text-sm font-black text-[#0b192c] hover:from-amber-300 hover:to-orange-400 shadow-xl transition active:scale-95"
            >
              <Zap className="h-4 w-4 fill-current" />
              <span>{joining ? 'Entering Arena…' : 'Enter Live Quiz Arena'}</span>
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
  const questionTimeLimit = currentQuestion?.timeLimitSeconds || 20;
  const timerPct =
    room.status === 'question_open' && questionTimeLimit > 0
      ? Math.max(0, Math.min(100, Math.round((remainingSeconds / questionTimeLimit) * 100)))
      : 100;

  return (
    <div className="min-h-[85vh] bg-gradient-to-br from-[#060d1a] via-[#0b192c] to-[#162a4a] text-white py-5 px-3.5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        {/* TOP GAMIFIED ARENA HUD BAR */}
        <div className="rounded-3xl bg-[#0d1f38]/90 backdrop-blur-md p-4 sm:p-5 border border-amber-400/25 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Left HUD: Room Badge + Player Avatar & Score XP */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 px-3.5 py-1.5 text-[#0b192c] font-mono text-xs font-black shadow-md">
                <Sparkles className="h-3.5 w-3.5" />
                <span>ROOM {room.roomCode}</span>
              </div>

              <div className="flex items-center gap-2.5 rounded-2xl bg-white/10 border border-white/15 px-3.5 py-1.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-[#0b192c] font-black text-xs">
                  {me.displayName.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <div className="text-xs font-bold text-white leading-none">
                    {me.displayName}
                  </div>
                  <div className="text-[11px] font-mono text-amber-300 mt-0.5">
                    <strong>{me.totalPoints.toLocaleString()} XP</strong>
                    {me.rank ? ` • Rank #${me.isTied ? `=${me.rank}` : me.rank}` : ''}
                  </div>
                </div>
              </div>

              {/* Streak Multiplier Flame Pill */}
              {me.currentStreak >= 1 && (
                <div
                  className={`inline-flex items-center gap-1.5 rounded-2xl px-3.5 py-1.5 text-xs font-black border ${
                    me.currentStreak >= 3
                      ? 'bg-gradient-to-r from-orange-500 to-red-600 border-amber-300 text-white shadow-lg shadow-orange-600/30 motion-safe:animate-bounce'
                      : 'bg-orange-500/20 border-orange-400/40 text-orange-300'
                  }`}
                  data-testid="player-streak-badge"
                >
                  <Flame className="h-4 w-4 text-amber-300 fill-current" />
                  <span>
                    {me.currentStreak}x Streak{me.currentStreak >= 3 ? ' (+100 Bonus!)' : ''}
                  </span>
                </div>
              )}
            </div>

            {/* Right HUD: Next Button + Language Switcher + Sound Mute */}
            <div className="flex flex-wrap items-center gap-2">
              {room.status === 'question_open' && (
                <button
                  type="button"
                  disabled={advancing}
                  onClick={() => handleRoomTransitionAction('reveal_question')}
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-amber-400 px-3.5 py-2 text-xs font-black text-[#0b192c] hover:bg-amber-300 shadow-md transition active:scale-95"
                  title="Reveal Answer Now"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>{me.currentSubmission ? 'Reveal & Next →' : 'Skip / Reveal →'}</span>
                </button>
              )}

              {room.status === 'question_revealed' && (
                <button
                  type="button"
                  disabled={advancing}
                  onClick={() => handleRoomTransitionAction('next_question')}
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-500 px-4 py-2 text-xs font-black text-[#0b192c] hover:from-emerald-300 hover:to-teal-400 shadow-lg transition active:scale-95"
                >
                  <SkipForward className="h-3.5 w-3.5 fill-current" />
                  <span>
                    {currentQNumber < totalQuestions
                      ? `Next Question (Q${currentQNumber + 1}) →`
                      : 'Finish & Show Podium →'}
                  </span>
                </button>
              )}

              <div
                className="flex items-center rounded-2xl bg-black/35 p-1 border border-white/15 text-xs"
                role="group"
                aria-label="Quiz Language Switcher"
              >
                <button
                  type="button"
                  onClick={() => handleSwitchLanguage('en')}
                  className={`rounded-xl px-2.5 py-1 font-bold transition ${
                    lang === 'en' ? 'bg-amber-400 text-[#0b192c]' : 'text-parchment-200'
                  }`}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchLanguage('ml')}
                  className={`rounded-xl px-2.5 py-1 font-bold transition ${
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
                aria-label={muted ? 'Unmute quiz sound' : 'Mute quiz sound'}
                className="rounded-2xl bg-white/10 border border-white/15 p-2 text-parchment-200 hover:bg-white/20"
              >
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Animated Countdown Bar & Stage Progress */}
          {room.status !== 'lobby' && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-black text-amber-300 uppercase">
                    Round {currentQNumber} / {totalQuestions}
                  </span>
                  <span className="text-parchment-300 text-[11px]">
                    ({currentQuestionAnsweredCount} of {participantCount} players answered)
                  </span>
                </div>

                {room.status === 'question_open' && (
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1 font-mono text-xs font-black shadow ${
                      remainingSeconds <= 5
                        ? 'bg-red-600 text-white motion-safe:animate-pulse'
                        : 'bg-amber-400 text-[#0b192c]'
                    }`}
                  >
                    <Clock className="h-3.5 w-3.5" />
                    {remainingSeconds}s Left
                  </span>
                )}
              </div>

              <div className="h-2.5 w-full rounded-full bg-black/40 overflow-hidden p-0.5 border border-white/10">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    room.status === 'question_open'
                      ? remainingSeconds <= 5
                        ? 'bg-gradient-to-r from-red-500 to-rose-600'
                        : 'bg-gradient-to-r from-amber-400 via-yellow-300 to-emerald-400'
                      : 'bg-emerald-400'
                  }`}
                  style={{
                    width: `${room.status === 'question_open' ? timerPct : progressPct}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Mobile Compact Live Rank Strip (Visible on Mobile right below HUD) */}
          <div className="lg:hidden mt-3 pt-3 border-t border-white/10">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                <span className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-amber-400/20 border border-amber-400/40 px-2 py-1 text-[10px] font-black text-amber-300">
                  <Trophy className="h-3 w-3" />
                  <span>Top Ranks:</span>
                </span>
                {leaderboard.slice(0, 3).map(
                  (
                    item: {
                      participantId?: string;
                      displayName: string;
                      rank: number;
                      totalPoints: number;
                    },
                    idx: number
                  ) => (
                    <span
                      key={item.participantId || idx}
                      className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-white/10 border border-white/15 px-2 py-1 text-[10px] font-bold text-white"
                    >
                      <strong className="text-amber-300">#{item.rank}</strong>
                      <span className="max-w-[75px] truncate">{item.displayName}</span>
                      <span className="font-mono text-amber-200">{item.totalPoints}</span>
                    </span>
                  )
                )}
              </div>

              <button
                type="button"
                onClick={() => setMobileRankDrawerOpen(!mobileRankDrawerOpen)}
                className="shrink-0 rounded-xl bg-white/10 border border-amber-400/40 px-2.5 py-1 text-[10px] font-black text-amber-300"
              >
                {mobileRankDrawerOpen ? 'Hide Ranks ▲' : `All Ranks (${participantCount}) ▼`}
              </button>
            </div>
          </div>
        </div>

        {/* MAIN TWO-COLUMN GAMIFIED ARENA: LEFT LIVE RANK LIST + RIGHT GAME STAGE */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 items-start">
          {/* LEFT SIDEBAR: PERSISTENT LIVE RANK LIST (LEADERBOARD) */}
          <aside
            className={`lg:col-span-4 ${
              mobileRankDrawerOpen ? 'order-1' : 'order-2'
            } lg:order-1 rounded-3xl bg-[#0d1f38]/95 border border-amber-400/30 p-4 sm:p-5 shadow-2xl lg:sticky lg:top-20`}
            data-testid="live-rank-list-sidebar"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3.5 mb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-400 text-[#0b192c] shadow">
                  <Trophy className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="font-serif text-base font-bold text-white leading-tight">
                    Live Rank List
                  </h2>
                  <p className="text-[11px] text-amber-300/90">
                    {participantCount} {participantCount === 1 ? 'Player' : 'Players'} in Arena
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-emerald-500/20 border border-emerald-400/40 px-2.5 py-0.5 text-[10px] font-black uppercase text-emerald-300">
                ● Live
              </span>
            </div>

            {leaderboard.length === 0 ? (
              <div className="py-8 text-center text-xs text-parchment-300">
                Waiting for players to score…
              </div>
            ) : (
              <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                {leaderboard.map(
                  (
                    item: {
                      participantId?: string;
                      displayName: string;
                      rank: number;
                      isTied: boolean;
                      totalPoints: number;
                      currentStreak?: number;
                    },
                    idx: number
                  ) => {
                    const isMe = item.participantId
                      ? item.participantId === me.participantId
                      : item.displayName === me.displayName && item.rank === me.rank;
                    const rankBadgeClass =
                      item.rank === 1
                        ? 'bg-gradient-to-br from-amber-300 to-amber-500 text-[#0b192c] ring-2 ring-amber-200'
                        : item.rank === 2
                        ? 'bg-gradient-to-br from-slate-200 to-slate-400 text-slate-950'
                        : item.rank === 3
                        ? 'bg-gradient-to-br from-amber-600 to-amber-800 text-white'
                        : 'bg-white/10 text-parchment-200';

                    return (
                      <div
                        key={`${item.displayName}-${idx}`}
                        className={`flex items-center justify-between gap-2.5 rounded-2xl px-3.5 py-2.5 text-xs transition ${
                          isMe
                            ? 'bg-gradient-to-r from-amber-400/25 to-orange-500/20 border-2 border-amber-400 shadow-lg'
                            : 'bg-white/5 border border-white/10 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl font-mono text-xs font-black shadow-xs ${rankBadgeClass}`}
                          >
                            {item.rank === 1 ? (
                              <Crown className="h-3.5 w-3.5" />
                            ) : item.isTied ? (
                              `=${item.rank}`
                            ) : (
                              item.rank
                            )}
                          </span>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`font-bold truncate ${
                                  isMe ? 'text-amber-300' : 'text-white'
                                }`}
                              >
                                {item.displayName}
                              </span>
                              {isMe && (
                                <span className="rounded bg-amber-400 px-1.5 py-0.2 text-[9px] font-black uppercase text-[#0b192c]">
                                  YOU
                                </span>
                              )}
                            </div>
                            {(item.currentStreak || 0) >= 2 && (
                              <div className="text-[10px] font-bold text-orange-300 flex items-center gap-1">
                                <Flame className="h-3 w-3 fill-current" />
                                <span>{item.currentStreak} streak</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-mono text-sm font-black text-amber-300">
                            {item.totalPoints.toLocaleString()}
                          </span>
                          <span className="block text-[9px] uppercase text-parchment-300">
                            PTS
                          </span>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            )}

            {/* Quick Bonus Legend Footer inside Rank List */}
            <div className="mt-4 pt-3 border-t border-white/10 grid grid-cols-3 gap-1.5 text-center text-[10px]">
              <div className="rounded-xl bg-white/5 p-2">
                <span className="block font-black text-amber-300">
                  +{room.scoringRules.basePoints}
                </span>
                <span className="text-parchment-300">Base Correct</span>
              </div>
              <div className="rounded-xl bg-white/5 p-2">
                <span className="block font-black text-emerald-300">
                  {room.scoringRules.speedBonusEnabled
                    ? `+${room.scoringRules.speedBonusMax}`
                    : 'OFF'}
                </span>
                <span className="text-parchment-300">Speed Bonus</span>
              </div>
              <div className="rounded-xl bg-white/5 p-2">
                <span className="block font-black text-orange-300">
                  {room.scoringRules.streakBonusEnabled
                    ? `+${room.scoringRules.streakBonusPoints}`
                    : 'OFF'}
                </span>
                <span className="text-parchment-300">3x Streak</span>
              </div>
            </div>
          </aside>

          {/* RIGHT MAIN STAGE: LOBBY / ACTIVE QUESTION / REVEAL / PODIUM */}
          <main
            className={`lg:col-span-8 ${
              mobileRankDrawerOpen ? 'order-2' : 'order-1'
            } lg:order-2 space-y-5`}
          >
            {/* STAGE 1: LOBBY SCREEN */}
            {room.status === 'lobby' && (
              <div className="rounded-3xl border-2 border-amber-400/40 bg-[#0d1f38]/95 p-6 sm:p-10 text-center shadow-2xl space-y-6">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 text-[#0b192c] shadow-xl">
                  <Users className="h-10 w-10" />
                </div>

                <div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 px-4 py-1 text-xs font-black text-emerald-300">
                    ● READY IN ARENA LOBBY ({participantCount} Players Joined)
                  </span>
                  <h1 className="mt-3 font-serif text-2xl sm:text-3xl font-bold text-white">
                    {lang === 'ml' ? quiz.titleMl || quiz.titleEn : quiz.titleEn || quiz.titleMl}
                  </h1>
                  <p className="mt-2 text-xs sm:text-sm text-parchment-200 max-w-lg mx-auto">
                    Click the button below to launch Round 1 immediately, or wait for the Host to
                    start from the Host Console.
                  </p>
                </div>

                <div>
                  <button
                    type="button"
                    disabled={advancing}
                    onClick={() => handleRoomTransitionAction('start_demo_room')}
                    className="inline-flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-300 to-orange-400 px-8 py-4 text-base font-black text-[#0b192c] hover:scale-105 shadow-2xl shadow-amber-500/30 transition active:scale-95"
                  >
                    <Play className="h-5 w-5 fill-current" />
                    <span>Start Live Quiz Now (Round 1)</span>
                  </button>
                </div>
              </div>
            )}

            {/* STAGE 2: QUESTION OPEN OR REVEALED */}
            {(room.status === 'question_open' || room.status === 'question_revealed') &&
              currentQuestion && (
                <div className="rounded-3xl border border-white/15 bg-[#0d1f38]/95 p-5 sm:p-8 shadow-2xl space-y-6">
                  {/* Question Prompt Header */}
                  <div className="rounded-2xl bg-gradient-to-r from-[#132c4e] to-[#1a3a63] p-5 sm:p-6 border border-white/10 shadow-inner">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-lg bg-amber-400/20 border border-amber-400/40 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-amber-300">
                          {currentQuestion.type === 'true_false'
                            ? 'True / False Challenge'
                            : 'Multiple Choice Challenge'}
                        </span>
                        {(currentQuestion.sectionEn || currentQuestion.sectionMl) && (
                          <span className="rounded-lg bg-indigo-500/25 border border-indigo-400/40 px-2.5 py-0.5 text-[11px] font-bold text-indigo-200">
                            {lang === 'ml'
                              ? currentQuestion.sectionMl || currentQuestion.sectionEn
                              : currentQuestion.sectionEn || currentQuestion.sectionMl}
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-mono text-parchment-200">
                        Question {currentQNumber} of {totalQuestions}
                      </span>
                    </div>
                    <h2 className="font-serif text-lg sm:text-2xl font-bold text-white leading-snug">
                      {lang === 'ml'
                        ? currentQuestion.promptMl || currentQuestion.promptEn
                        : currentQuestion.promptEn || currentQuestion.promptMl}
                    </h2>
                  </div>

                  {submitError && (
                    <div className="rounded-xl border border-red-400 bg-red-950/80 p-3 text-xs font-medium text-red-200">
                      {submitError}
                    </div>
                  )}

                  {/* Submitted State Banner + Instant "Reveal & Go to Next" Action */}
                  {room.status === 'question_open' && me.currentSubmission && (
                    <div
                      className="rounded-2xl border-2 border-emerald-400 bg-emerald-950/70 p-4 text-xs text-emerald-100 flex flex-wrap items-center justify-between gap-3 shadow-lg"
                      data-testid="answer-submitted-banner"
                    >
                      <div className="flex items-center gap-2.5">
                        <CheckCircle2 className="h-6 w-6 text-emerald-400 shrink-0" />
                        <div>
                          <p className="font-black text-sm text-white">
                            Answer Locked In! (Option {me.currentSubmission.selectedOptionId})
                          </p>
                          <p className="text-emerald-300">
                            Speed: {(me.currentSubmission.responseTimeMs / 1000).toFixed(2)}s •
                            Click &ldquo;Reveal &amp; Next&rdquo; or wait for countdown
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={advancing}
                        onClick={() => handleRoomTransitionAction('reveal_question')}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-4 py-2.5 text-xs font-black text-[#0b192c] hover:bg-amber-300 shadow transition active:scale-95"
                      >
                        <Eye className="h-4 w-4" />
                        <span>Reveal Answer &amp; Next →</span>
                      </button>
                    </div>
                  )}

                  {/* Gamified Arcade Answer Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                        const tile = GAMIFIED_OPTION_TILES[idx % GAMIFIED_OPTION_TILES.length];
                        let cardStyle = `bg-gradient-to-br ${tile.bg}`;

                        if (isRevealed) {
                          if (isCorrectOpt) {
                            cardStyle =
                              'bg-gradient-to-br from-emerald-500 to-green-700 border-emerald-300 text-white ring-4 ring-emerald-400/60 shadow-xl';
                          } else if (isMyChoice && !isCorrectOpt) {
                            cardStyle =
                              'bg-gradient-to-br from-red-700 to-rose-900 border-red-400 text-white opacity-90';
                          } else {
                            cardStyle =
                              'bg-white/5 border-white/10 text-white/40 opacity-50';
                          }
                        } else if (isMyChoice) {
                          cardStyle =
                            'bg-gradient-to-br from-amber-400 to-orange-500 border-white text-[#0b192c] ring-4 ring-amber-300 shadow-2xl scale-[1.01]';
                        }

                        return (
                          <button
                            key={opt.optionId}
                            type="button"
                            disabled={isDisabled}
                            onClick={() => handleSubmitAnswer(opt.optionId)}
                            data-testid={`quiz-option-${opt.optionId}`}
                            className={`w-full text-left rounded-2xl border-2 p-5 transition duration-150 shadow-lg active:scale-95 focus:outline-none ${cardStyle}`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 font-mono text-xs font-black ${
                                  isMyChoice && !isRevealed
                                    ? 'bg-[#0b192c] text-amber-300'
                                    : tile.badge
                                }`}
                              >
                                <span>{tile.shape}</span>
                                <span>{opt.optionId}</span>
                              </span>

                              {isMyChoice && (
                                <span className="rounded-full bg-black/30 px-2.5 py-0.5 text-[10px] font-black uppercase">
                                  Your Pick
                                </span>
                              )}
                              {isRevealed && isCorrectOpt && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-white text-emerald-900 px-2.5 py-0.5 text-[10px] font-black uppercase">
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                  Correct
                                </span>
                              )}
                            </div>

                            <p className="text-base sm:text-lg font-extrabold leading-snug">
                              {lang === 'ml'
                                ? opt.textMl || opt.textEn
                                : opt.textEn || opt.textMl}
                            </p>
                          </button>
                        );
                      }
                    )}
                  </div>

                  {/* REVEAL PANEL WITH EXPLANATION, POINTS BREAKDOWN & PROMINENT "NEXT QUESTION" BUTTON */}
                  {room.status === 'question_revealed' && (
                    <div className="space-y-4 pt-3 border-t border-white/10">
                      <div
                        className={`rounded-2xl border-2 p-5 ${
                          me.currentSubmission?.isCorrect
                            ? 'border-emerald-400 bg-emerald-950/75 text-emerald-50'
                            : 'border-rose-400 bg-rose-950/75 text-rose-50'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 font-black text-base sm:text-lg">
                              {me.currentSubmission?.isCorrect ? (
                                <>
                                  <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                                  <span>
                                    Awesome! +{me.currentSubmission.totalPointsEarned} Points
                                  </span>
                                </>
                              ) : (
                                <>
                                  <XCircle className="h-6 w-6 text-rose-400" />
                                  <span>
                                    {me.currentSubmission
                                      ? `Not Quite! Correct Answer: Option ${currentQuestion.correctOptionId}`
                                      : `Time Up! Correct Answer: Option ${currentQuestion.correctOptionId}`}
                                  </span>
                                </>
                              )}
                            </div>

                            {me.currentSubmission?.isCorrect && (
                              <div className="flex flex-wrap gap-2 text-xs font-mono text-emerald-200">
                                <span>Base: +{me.currentSubmission.basePointsEarned}</span>
                                <span>• Speed: +{me.currentSubmission.speedBonusEarned}</span>
                                {me.currentSubmission.streakBonusEarned > 0 && (
                                  <span className="text-amber-300 font-bold">
                                    • Streak Bonus: +{me.currentSubmission.streakBonusEarned}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* PROMINENT NEXT QUESTION BUTTON */}
                          <button
                            type="button"
                            disabled={advancing}
                            onClick={() => handleRoomTransitionAction('next_question')}
                            data-testid="next-question-btn"
                            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 px-6 py-3.5 text-sm font-black text-[#0b192c] hover:from-amber-300 hover:to-orange-400 shadow-xl transition active:scale-95"
                          >
                            <span>
                              {currentQNumber < totalQuestions
                                ? `Next Question (Round ${currentQNumber + 1}) →`
                                : 'View Final Podium & Results →'}
                            </span>
                            <SkipForward className="h-4 w-4 fill-current" />
                          </button>
                        </div>

                        {(currentQuestion.explanationEn || currentQuestion.explanationMl) && (
                          <div className="mt-4 rounded-xl bg-black/30 p-3.5 text-xs sm:text-sm leading-relaxed border border-white/10">
                            <strong className="text-amber-300">Official Explanation:</strong>{' '}
                            {lang === 'ml'
                              ? currentQuestion.explanationMl || currentQuestion.explanationEn
                              : currentQuestion.explanationEn || currentQuestion.explanationMl}
                          </div>
                        )}

                        {currentQuestion.linkedDocSnapshot && (
                          <div className="mt-3 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
                            <span className="inline-flex items-center gap-1.5 font-bold text-amber-200">
                              <FileText className="h-4 w-4" />
                              Source Order: {currentQuestion.linkedDocSnapshot.documentNumber}
                            </span>
                            {isSignedInReader ? (
                              <Link
                                href={`/library/documents/${currentQuestion.linkedDocSnapshot.slug}`}
                                target="_blank"
                                className="inline-flex items-center gap-1 rounded-xl bg-white/15 border border-white/20 px-3.5 py-1.5 font-bold text-amber-300 hover:bg-white/25"
                              >
                                <span>Open in Mudra PDF Reader</span>
                                <ExternalLink className="h-3 w-3" />
                              </Link>
                            ) : (
                              <Link
                                href={`/login?returnTo=${encodeURIComponent(
                                  `/library/documents/${currentQuestion.linkedDocSnapshot.slug}`
                                )}`}
                                className="inline-flex items-center gap-1 rounded-xl bg-amber-400 px-3.5 py-1.5 font-bold text-[#0b192c]"
                              >
                                <Lock className="h-3 w-3" />
                                <span>Sign In to Read Source PDF</span>
                              </Link>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

            {/* STAGE 3: COMPLETED PODIUM + PLAY AGAIN + END-OF-QUIZ REVIEW */}
            {room.status === 'completed' && (
              <div className="space-y-6">
                <div
                  className="rounded-3xl bg-gradient-to-br from-[#0f2442] via-[#152f54] to-[#0b192c] p-6 sm:p-8 text-white shadow-2xl border-2 border-amber-400/50"
                  data-testid="final-podium"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                    <div>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 border border-amber-400/40 px-3.5 py-1 text-xs font-black text-amber-300">
                        <Award className="h-4 w-4" />
                        VICTORY PODIUM • ROOM {room.roomCode}
                      </span>
                      <h2 className="mt-2 font-serif text-2xl sm:text-3xl font-bold text-white">
                        {lang === 'ml'
                          ? quiz.titleMl || quiz.titleEn
                          : quiz.titleEn || quiz.titleMl}
                      </h2>
                    </div>

                    <button
                      type="button"
                      disabled={advancing}
                      onClick={() => handleRoomTransitionAction('restart_demo_room')}
                      className="inline-flex items-center gap-2 rounded-2xl bg-amber-400 px-5 py-3 text-xs font-black text-[#0b192c] hover:bg-amber-300 shadow-lg transition active:scale-95"
                    >
                      <RotateCcw className="h-4 w-4" />
                      <span>Play Again (Reset Room)</span>
                    </button>
                  </div>

                  {/* Personal Score Summary Banner */}
                  <div className="mb-6 grid grid-cols-3 gap-3 rounded-2xl bg-black/30 p-4 border border-white/10 text-center">
                    <div>
                      <span className="text-[11px] uppercase text-parchment-300">
                        Your Final Rank
                      </span>
                      <p className="font-mono text-xl sm:text-2xl font-black text-amber-300">
                        #{me.isTied ? `=${me.rank}` : me.rank}{' '}
                        <span className="text-xs font-normal">of {participantCount}</span>
                      </p>
                    </div>
                    <div>
                      <span className="text-[11px] uppercase text-parchment-300">
                        Total Score
                      </span>
                      <p className="font-mono text-xl sm:text-2xl font-black text-emerald-300">
                        {me.totalPoints.toLocaleString()} XP
                      </p>
                    </div>
                    <div>
                      <span className="text-[11px] uppercase text-parchment-300">
                        Accuracy &amp; Streak
                      </span>
                      <p className="font-mono text-xl sm:text-2xl font-black text-white">
                        {me.correctCount}/{totalQuestions}{' '}
                        <span className="text-xs text-orange-300">({me.maxStreak}x max)</span>
                      </p>
                    </div>
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
                            className={`rounded-2xl p-5 text-center border-2 ${
                              p.rank === 1
                                ? 'bg-gradient-to-b from-amber-300 to-amber-500 text-[#0b192c] border-white shadow-2xl sm:py-8'
                                : p.rank === 2
                                ? 'bg-white/15 text-white border-slate-300/40 sm:py-6'
                                : 'bg-amber-900/50 text-amber-100 border-amber-500/40 sm:py-5'
                            }`}
                          >
                            <div className="font-mono text-xs font-black uppercase">
                              {p.rank === 1
                                ? '👑 1st Place Champion'
                                : `Place #${p.isTied ? `=${p.rank}` : p.rank}`}
                            </div>
                            <div className="mt-1 font-serif text-lg font-bold truncate">
                              {p.displayName}
                            </div>
                            <div className="mt-1 font-mono text-base font-black">
                              {p.totalPoints.toLocaleString()} XP
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>

                {/* End-of-Quiz Question-by-Question Review with Linked Mudra PDFs */}
                {me.completedReview && (
                  <div className="rounded-3xl border border-white/15 bg-[#0d1f38]/95 p-6 shadow-xl space-y-4">
                    <h3 className="font-serif text-xl font-bold text-white">
                      Your Question-by-Question Answer Review
                    </h3>
                    <div className="space-y-4">
                      {me.completedReview.map(
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
                                ? 'border-emerald-400/50 bg-emerald-950/40'
                                : 'border-rose-400/50 bg-rose-950/40'
                            }`}
                          >
                            <div className="flex items-center justify-between font-bold mb-1.5">
                              <span className="text-amber-300">
                                Round {rev.questionNumber}
                              </span>
                              <span
                                className={
                                  rev.isCorrect ? 'text-emerald-300' : 'text-rose-300'
                                }
                              >
                                {rev.isCorrect
                                  ? `✓ Correct (+${rev.pointsEarned} XP)`
                                  : `✗ Your Pick: ${
                                      rev.selectedOptionId || 'None'
                                    } • Correct: ${rev.correctOptionId}`}
                              </span>
                            </div>

                            <p className="font-bold text-sm text-white">
                              {lang === 'ml'
                                ? rev.promptMl || rev.promptEn
                                : rev.promptEn || rev.promptMl}
                            </p>

                            {(rev.explanationEn || rev.explanationMl) && (
                              <p className="mt-2 text-parchment-200 leading-relaxed">
                                <strong className="text-amber-300">Explanation:</strong>{' '}
                                {lang === 'ml'
                                  ? rev.explanationMl || rev.explanationEn
                                  : rev.explanationEn || rev.explanationMl}
                              </p>
                            )}

                            {rev.linkedDocSnapshot && (
                              <div className="mt-3 pt-2.5 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
                                <span className="font-semibold text-amber-200">
                                  Reference Order: {rev.linkedDocSnapshot.documentNumber}
                                </span>
                                {isSignedInReader ? (
                                  <Link
                                    href={`/library/documents/${rev.linkedDocSnapshot.slug}`}
                                    target="_blank"
                                    className="inline-flex items-center gap-1 rounded-xl bg-amber-400 px-3 py-1.5 font-bold text-[#0b192c]"
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
                                    className="inline-flex items-center gap-1 rounded-xl bg-amber-400 px-3 py-1.5 font-bold text-[#0b192c]"
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
          </main>
        </div>
      </div>
    </div>
  );
}
