'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Play,
  Lock,
  Unlock,
  SkipForward,
  Eye,
  StopCircle,
  Download,
  Copy,
  Check,
  Users,
  Clock,
  Trophy,
  UserMinus,
  BarChart3,
  FileText,
  ExternalLink,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  isQuizSoundMuted,
  setQuizSoundMuted,
  playQuizSound,
} from '@/features/quiz/sound';

interface HostRoomViewProps {
  roomCode: string;
}

export default function HostRoomClient({ roomCode }: HostRoomViewProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [hostState, setHostState] = useState<any>(null);
  const [hostLang, setHostLang] = useState<'en' | 'ml'>('en');
  const [copiedLink, setCopiedLink] = useState(false);
  const [muted, setMuted] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [actionBusy, setActionBusy] = useState(false);

  useEffect(() => {
    setMuted(isQuizSoundMuted());
  }, []);

  const fetchHostState = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/admin/quizzes/rooms?roomCode=${encodeURIComponent(roomCode)}`,
        { cache: 'no-store' }
      );
      if (res.ok) {
        const data = await res.json();
        setHostState(data);
      }
    } catch {
      // ignore transient network error
    }
  }, [roomCode]);

  useEffect(() => {
    fetchHostState();
    const interval = setInterval(fetchHostState, 1000);
    return () => clearInterval(interval);
  }, [fetchHostState]);

  // Synchronized countdown timer from server deadline timestamp
  useEffect(() => {
    if (!hostState?.room) return;
    const room = hostState.room;
    const tick = () => {
      if (room.status === 'question_open' && room.questionDeadlineAt) {
        const diffMs = new Date(room.questionDeadlineAt).getTime() - Date.now();
        const sec = Math.max(0, Math.ceil(diffMs / 1000));
        setRemainingSeconds(sec);
      } else if (
        room.status === 'question_revealed' &&
        room.mode === 'auto_live' &&
        room.revealEndsAt
      ) {
        const diffMs = new Date(room.revealEndsAt).getTime() - Date.now();
        setRemainingSeconds(Math.max(0, Math.ceil(diffMs / 1000)));
      } else {
        setRemainingSeconds(0);
      }
    };
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [hostState]);

  async function sendHostAction(
    action:
      | 'start_quiz'
      | 'reveal_question'
      | 'next_question'
      | 'toggle_lock'
      | 'remove_participant'
      | 'end_session',
    extra: Record<string, unknown> = {}
  ) {
    setActionBusy(true);
    try {
      const res = await fetch('/api/admin/quizzes/rooms', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode,
          action,
          ...extra,
        }),
      });
      if (res.ok) {
        playQuizSound('select');
        await fetchHostState();
      }
    } finally {
      setActionBusy(false);
    }
  }

  function handleCopyJoinLink() {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/quiz?code=${encodeURIComponent(roomCode)}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  }

  if (!hostState?.room || !hostState?.quizVersion) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 text-center text-sm text-mudra-700">
        Loading Live Host Console for Room <strong className="font-mono">{roomCode}</strong>…
      </div>
    );
  }

  const {
    room,
    quizVersion,
    participantCount,
    currentQuestionAnsweredCount,
    currentQuestionDistribution,
    leaderboard,
    perQuestionStats,
  } = hostState;

  const currentQ =
    room.currentQuestionIndex >= 0
      ? quizVersion.questions[room.currentQuestionIndex] || null
      : null;

  const shareableJoinPath = `/quiz?code=${room.roomCode}`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      {/* Top Host Arena Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-[#0b192c] via-[#132743] to-[#0b192c] p-6 text-white shadow-xl border border-white/10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg bg-amber-400 px-3 py-1 font-mono text-sm font-black text-[#0b192c]">
                ROOM CODE: {room.roomCode}
              </span>
              <span className="rounded-lg bg-white/10 border border-white/20 px-2.5 py-1 text-xs font-bold uppercase text-amber-300">
                {room.mode === 'auto_live' ? 'Automatic Live Mode' : 'Host-Controlled Live Mode'}
              </span>
              <span className="rounded-lg bg-emerald-500/20 border border-emerald-400/30 px-2.5 py-1 text-xs font-bold uppercase text-emerald-300">
                Status: {room.status.replace('_', ' ')}
              </span>
              <span className="text-xs text-parchment-300 font-mono">
                Fixed Quiz v{room.version}
              </span>
            </div>

            <h1 className="mt-2 font-serif text-xl sm:text-2xl font-bold text-white">
              {hostLang === 'ml'
                ? quizVersion.titleMl || quizVersion.titleEn
                : quizVersion.titleEn || quizVersion.titleMl}
            </h1>
          </div>

          {/* Language Toggle, Sound Mute, Copy Link & Excel Export */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-xl bg-white/10 p-1 text-xs">
              <button
                type="button"
                onClick={() => setHostLang('en')}
                className={`rounded-lg px-2.5 py-1 font-bold ${
                  hostLang === 'en' ? 'bg-amber-400 text-[#0b192c]' : 'text-white'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setHostLang('ml')}
                className={`rounded-lg px-2.5 py-1 font-bold ${
                  hostLang === 'ml' ? 'bg-amber-400 text-[#0b192c]' : 'text-white'
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
              className="rounded-xl bg-white/10 border border-white/15 p-2 text-parchment-200 hover:bg-white/20"
              title={muted ? 'Unmute Sound' : 'Mute Sound'}
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>

            <button
              type="button"
              onClick={handleCopyJoinLink}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 border border-white/20 px-3.5 py-2 text-xs font-bold text-amber-300 hover:bg-white/20"
            >
              {copiedLink ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedLink ? 'Copied Join Link!' : `Copy Join Link (${shareableJoinPath})`}</span>
            </button>

            <a
              href={`/api/admin/quizzes/rooms/${room.roomCode}/export`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-bold text-[#0b192c] hover:bg-emerald-400 shadow"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export .xlsx Report</span>
            </a>
          </div>
        </div>

        {/* Host Control Bar + Live Response Counter ("72 of 100 answered") */}
        <div className="mt-5 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5 rounded-xl bg-black/30 px-3.5 py-2">
              <Users className="h-4 w-4 text-amber-400" />
              <span>
                Participants: <strong>{participantCount}</strong> / {room.capacity}
              </span>
            </div>

            {room.status !== 'lobby' && (
              <div
                className="flex items-center gap-1.5 rounded-xl bg-amber-400/20 border border-amber-400/40 px-3.5 py-2 font-bold text-amber-300"
                data-testid="host-response-count"
              >
                <span>
                  {currentQuestionAnsweredCount} of {participantCount} answered
                </span>
              </div>
            )}

            {(room.status === 'question_open' ||
              (room.status === 'question_revealed' && room.mode === 'auto_live')) && (
              <div className="flex items-center gap-1.5 rounded-xl bg-black/30 px-3.5 py-2 font-mono text-sm font-bold text-white">
                <Clock className="h-4 w-4 text-amber-400" />
                <span>
                  {room.status === 'question_open'
                    ? `${remainingSeconds}s remaining`
                    : `Auto-advancing in ${remainingSeconds}s`}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={actionBusy}
              onClick={() => sendHostAction('toggle_lock')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3.5 py-2 text-xs font-bold text-white hover:bg-white/20"
            >
              {room.joinLocked ? (
                <>
                  <Lock className="h-3.5 w-3.5 text-red-400" />
                  <span>Joining Locked (Unlock)</span>
                </>
              ) : (
                <>
                  <Unlock className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Lock Joining</span>
                </>
              )}
            </button>

            {room.status === 'lobby' && (
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => sendHostAction('start_quiz')}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-5 py-2.5 text-xs font-black text-[#0b192c] hover:bg-amber-300 shadow-lg"
              >
                <Play className="h-4 w-4 fill-current" />
                <span>Start Quiz Now</span>
              </button>
            )}

            {room.status === 'question_open' && (
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => sendHostAction('reveal_question')}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-4 py-2 text-xs font-bold text-[#0b192c] hover:bg-amber-300"
              >
                <Eye className="h-3.5 w-3.5" />
                <span>Lock &amp; Reveal Answer</span>
              </button>
            )}

            {room.status === 'question_revealed' && (
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => sendHostAction('next_question')}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-4 py-2 text-xs font-bold text-[#0b192c] hover:bg-amber-300"
              >
                <SkipForward className="h-3.5 w-3.5" />
                <span>
                  {room.currentQuestionIndex + 1 < quizVersion.questions.length
                    ? 'Next Question'
                    : 'Finish & Show Final Podium'}
                </span>
              </button>
            )}

            {room.status !== 'completed' && (
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => sendHostAction('end_session')}
                className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-red-500"
              >
                <StopCircle className="h-3.5 w-3.5" />
                <span>End Session</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Host Body: Left Question / Lobby Stage + Right Leaderboard & Participants */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7 space-y-6">
          {/* LOBBY STATE */}
          {room.status === 'lobby' && (
            <div className="rounded-3xl border border-mudra-200 bg-white p-6 sm:p-8 shadow-sm">
              <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
                Waiting in Lobby • Players can join at /quiz with code {room.roomCode}
              </span>
              <h2 className="mt-3 font-serif text-2xl font-bold text-mudra-950">
                {quizVersion.titleEn}
              </h2>
              {quizVersion.titleMl && (
                <p className="text-base font-medium text-mudra-700 mt-1">
                  {quizVersion.titleMl}
                </p>
              )}

              <div className="mt-6 rounded-2xl border border-mudra-200 bg-parchment-50 p-4 text-xs space-y-1.5">
                <p className="font-bold text-mudra-950">Active Session Scoring Rules:</p>
                <ul className="list-disc pl-5 text-mudra-800 space-y-1">
                  <li>
                    Base Score: <strong>{room.scoringRules.basePoints} points</strong> per correct
                    answer
                  </li>
                  <li>
                    Speed Bonus:{' '}
                    <strong>
                      {room.scoringRules.speedBonusEnabled
                        ? `Up to +${room.scoringRules.speedBonusMax} points (linearly decreasing)`
                        : 'Disabled for this session'}
                    </strong>
                  </li>
                  <li>
                    Streak Bonus:{' '}
                    <strong>
                      {room.scoringRules.streakBonusEnabled
                        ? `+${room.scoringRules.streakBonusPoints} points from ${room.scoringRules.streakThreshold} consecutive correct answers onward`
                        : 'Disabled for this session'}
                    </strong>
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* ACTIVE OR REVEALED QUESTION STAGE */}
          {(room.status === 'question_open' || room.status === 'question_revealed') &&
            currentQ && (
              <div className="rounded-3xl border border-mudra-200 bg-white p-6 shadow-sm space-y-5">
                <div className="flex items-center justify-between text-xs text-mudra-600">
                  <span className="rounded-lg bg-[#0b192c] px-3 py-1 font-mono font-bold text-amber-300">
                    Question {room.currentQuestionIndex + 1} of {quizVersion.questions.length}
                  </span>
                  <span className="font-bold text-mudra-900">
                    {currentQuestionAnsweredCount} of {participantCount} answered
                  </span>
                </div>

                <div>
                  <h2 className="font-serif text-xl font-bold text-mudra-950 leading-snug">
                    {hostLang === 'ml'
                      ? currentQ.promptMl || currentQ.promptEn
                      : currentQ.promptEn || currentQ.promptMl}
                  </h2>
                  {currentQ.promptMl && currentQ.promptEn && (
                    <p className="mt-1.5 text-sm text-mudra-700">
                      {hostLang === 'ml' ? currentQ.promptEn : currentQ.promptMl}
                    </p>
                  )}
                </div>

                {/* Options & Post-Close Answer Distribution */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {currentQ.options.map((opt: { optionId: string; textEn: string; textMl: string }) => {
                    const isRevealed = room.status === 'question_revealed';
                    const isCorrect = isRevealed && opt.optionId === currentQ.correctOptionId;
                    const count =
                      isRevealed && currentQuestionDistribution
                        ? currentQuestionDistribution[opt.optionId] || 0
                        : 0;
                    const pct =
                      isRevealed && currentQuestionAnsweredCount > 0
                        ? Math.round((count / currentQuestionAnsweredCount) * 100)
                        : 0;

                    return (
                      <div
                        key={opt.optionId}
                        className={`rounded-2xl border-2 p-4 transition ${
                          isCorrect
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-950'
                            : 'border-mudra-200 bg-parchment-50 text-mudra-950'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs font-black">
                            Option {opt.optionId}
                          </span>
                          {isRevealed && (
                            <span className="font-mono text-xs font-bold">
                              {count} ({pct}%)
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm font-bold">
                          {hostLang === 'ml'
                            ? opt.textMl || opt.textEn
                            : opt.textEn || opt.textMl}
                        </p>

                        {isRevealed && (
                          <div className="mt-2 h-2 w-full rounded-full bg-mudra-200 overflow-hidden">
                            <div
                              className={`h-full ${
                                isCorrect ? 'bg-emerald-600' : 'bg-mudra-600'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {room.status === 'question_revealed' && (
                  <div className="rounded-2xl border border-emerald-300 bg-emerald-50/80 p-4 text-xs text-emerald-950 space-y-2">
                    <p className="font-bold">
                      Correct Answer: Option {currentQ.correctOptionId}
                    </p>
                    {(currentQ.explanationEn || currentQ.explanationMl) && (
                      <p>
                        {hostLang === 'ml'
                          ? currentQ.explanationMl || currentQ.explanationEn
                          : currentQ.explanationEn || currentQ.explanationMl}
                      </p>
                    )}
                    {currentQ.linkedDocSnapshot && (
                      <Link
                        href={`/library/documents/${currentQ.linkedDocSnapshot.slug}`}
                        target="_blank"
                        className="inline-flex items-center gap-1.5 font-bold text-mudra-900 underline"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        <span>
                          Open Linked Mudra PDF ({currentQ.linkedDocSnapshot.documentNumber})
                        </span>
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                )}
              </div>
            )}

          {/* COMPLETED REPORT & QUESTION BREAKDOWN */}
          {room.status === 'completed' && (
            <div className="rounded-3xl border border-mudra-200 bg-white p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-serif text-xl font-bold text-mudra-950">
                  <BarChart3 className="h-5 w-5 text-mudra-700" />
                  Completed Session Question Breakdown
                </h2>
                <a
                  href={`/api/admin/quizzes/rooms/${room.roomCode}/export`}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#0b192c] px-4 py-2 text-xs font-bold text-amber-300"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download Full .xlsx Report</span>
                </a>
              </div>

              <div className="space-y-3">
                {perQuestionStats.map(
                  (qs: {
                    questionIndex: number;
                    promptEn: string;
                    promptMl: string;
                    correctOptionId: string;
                    totalResponses: number;
                    correctResponses: number;
                    accuracyPercent: number;
                    optionCounts: Record<string, number>;
                  }) => (
                    <div
                      key={qs.questionIndex}
                      className="rounded-2xl border border-mudra-100 bg-parchment-50 p-4 text-xs"
                    >
                      <div className="flex items-center justify-between font-bold text-mudra-900">
                        <span>
                          Q{qs.questionIndex + 1}: {qs.promptEn || qs.promptMl}
                        </span>
                        <span className="text-emerald-800">
                          {qs.accuracyPercent}% Correct ({qs.correctResponses}/
                          {qs.totalResponses})
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {Object.entries(qs.optionCounts).map(([optId, cnt]) => (
                          <span
                            key={optId}
                            className={`rounded-lg px-2.5 py-1 font-mono text-[11px] ${
                              optId === qs.correctOptionId
                                ? 'bg-emerald-100 text-emerald-900 font-bold border border-emerald-300'
                                : 'bg-white text-mudra-800 border border-mudra-200'
                            }`}
                          >
                            {optId}: {cnt}
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Live Leaderboard & Participant Management */}
        <div className="lg:col-span-5">
          <div className="rounded-3xl border border-mudra-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="flex items-center gap-2 font-serif text-lg font-bold text-mudra-950">
                <Trophy className="h-5 w-5 text-amber-500" />
                Live Leaderboard ({participantCount})
              </h2>
              <span className="text-xs text-mudra-600">
                Ranked by Points → Correct → Speed
              </span>
            </div>

            {leaderboard.length === 0 ? (
              <p className="text-xs text-mudra-600 py-8 text-center">
                No participants have joined yet. Share room code{' '}
                <strong className="font-mono">{room.roomCode}</strong>!
              </p>
            ) : (
              <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1">
                {leaderboard.map(
                  (p: {
                    participantId: string;
                    displayName: string;
                    isGuest: boolean;
                    rank: number;
                    isTied: boolean;
                    totalPoints: number;
                    correctCount: number;
                    accuracyPercent: number;
                    cumulativeCorrectTimeMs: number;
                    currentStreak: number;
                  }) => (
                    <div
                      key={p.participantId}
                      className="flex items-center justify-between gap-2 rounded-xl border border-mudra-100 bg-parchment-50/80 px-3.5 py-2.5 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-xs font-black ${
                            p.rank === 1
                              ? 'bg-amber-400 text-[#0b192c]'
                              : p.rank === 2
                              ? 'bg-slate-300 text-slate-900'
                              : p.rank === 3
                              ? 'bg-amber-700 text-white'
                              : 'bg-mudra-100 text-mudra-800'
                          }`}
                        >
                          {p.isTied ? `=${p.rank}` : p.rank}
                        </span>
                        <div className="min-w-0">
                          <div className="font-bold text-mudra-950 truncate">
                            {p.displayName}
                          </div>
                          <div className="text-[10px] text-mudra-600">
                            {p.correctCount} correct ({p.accuracyPercent}%) •{' '}
                            {(p.cumulativeCorrectTimeMs / 1000).toFixed(1)}s
                            {p.currentStreak >= 3 ? ` • 🔥 ${p.currentStreak} streak` : ''}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-sm font-black text-mudra-950">
                          {p.totalPoints.toLocaleString()} pts
                        </span>
                        {room.status !== 'completed' && (
                          <button
                            type="button"
                            onClick={() =>
                              sendHostAction('remove_participant', {
                                participantId: p.participantId,
                              })
                            }
                            className="rounded border border-red-200 bg-red-50 p-1 text-red-700 hover:bg-red-100"
                            title="Remove Participant"
                          >
                            <UserMinus className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
