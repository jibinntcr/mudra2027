'use client';

import React, { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Trophy,
  Play,
  Users,
  History,
  Flame,
  Clock,
  Sparkles,
  AlertCircle,
  Loader2,
  ArrowRight,
  Shield,
} from 'lucide-react';

function QuizLobbyInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefilledCode = (searchParams.get('code') || '').trim().toUpperCase();

  const [roomCode, setRoomCode] = useState(prefilledCode);
  const [displayName, setDisplayName] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState<'en' | 'ml'>('en');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [catalog, setCatalog] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [joiningRoom, setJoiningRoom] = useState(false);
  const [startingQuizId, setStartingQuizId] = useState<string | null>(null);

  useEffect(() => {
    if (prefilledCode) {
      setRoomCode(prefilledCode);
    }
  }, [prefilledCode]);

  useEffect(() => {
    async function loadCatalog() {
      const res = await fetch('/api/quiz/catalog', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setCatalog(data);
        if (data.currentUser?.displayName) {
          setDisplayName(data.currentUser.displayName);
        }
      }
    }
    loadCatalog();
  }, []);

  async function handleJoinRoom(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setErrorCode(null);

    const code = roomCode.trim().toUpperCase();
    if (!code) {
      setError('Please enter a 6-character room code.');
      return;
    }

    setJoiningRoom(true);
    try {
      const savedToken =
        typeof window !== 'undefined'
          ? window.localStorage.getItem(`mudra_quiz_token_${code}`)
          : null;

      const res = await fetch(`/api/quiz/rooms/${encodeURIComponent(code)}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode: code,
          displayName,
          participantToken: savedToken,
          preferredLanguage,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not join room.');
        setErrorCode(data.code || null);
        setJoiningRoom(false);
        return;
      }

      if (typeof window !== 'undefined' && data.participant?.participantToken) {
        window.localStorage.setItem(
          `mudra_quiz_token_${code}`,
          data.participant.participantToken
        );
      }

      router.push(`/quiz/room/${code}`);
    } catch {
      setError('Network error while joining room.');
      setJoiningRoom(false);
    }
  }

  async function handleStartSelfPaced(quizId: string) {
    setError(null);
    setStartingQuizId(quizId);

    try {
      const res = await fetch('/api/quiz/self-paced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quizId,
          displayName: displayName || catalog?.currentUser?.displayName || 'Guest Player',
          preferredLanguage,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not start self-paced quiz.');
        setStartingQuizId(null);
        return;
      }

      if (typeof window !== 'undefined' && data.attemptToken) {
        window.localStorage.setItem(
          `mudra_attempt_token_${data.attemptId}`,
          data.attemptToken
        );
      }

      router.push(`/quiz/self-paced/${data.attemptId}`);
    } catch {
      setError('Network error while starting quiz.');
      setStartingQuizId(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12 sm:px-6 lg:px-8 space-y-8">
      {/* Top Arena Hero + Room Code Join Card */}
      <div className="rounded-3xl bg-gradient-to-br from-[#0b192c] via-[#132743] to-mudra-950 p-6 sm:p-10 text-white shadow-2xl border border-amber-400/20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/15 px-3.5 py-1 text-xs font-bold text-amber-300">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Mudra Classroom Live &amp; Self-Paced Quiz Arena</span>
            </div>

            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-white leading-tight">
              Mudra Registration &amp; Revenue Quiz Challenge
            </h1>
            <p className="text-base sm:text-lg font-medium text-amber-300">
              മുദ്ര ക്വിസ് മത്സരം — രജിസ്ട്രേഷൻ &amp; സ്റ്റാമ്പ് ആക്ട് വിജ്ഞാന പരീക്ഷണം
            </p>
            <p className="text-xs sm:text-sm text-parchment-200 leading-relaxed max-w-xl">
              Join a live classroom game with a 6-character Room Code or practice independently in
              Self-Paced mode. Switch freely between Malayalam and English at any point without
              losing progress.
            </p>

            {/* Default Scoring Rules Pill Bar */}
            <div className="pt-2 flex flex-wrap gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 border border-white/15 px-3 py-1.5 text-parchment-100">
                <Trophy className="h-3.5 w-3.5 text-amber-400" />
                <strong>1,000 pts</strong> Base Correct
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 border border-white/15 px-3 py-1.5 text-parchment-100">
                <Clock className="h-3.5 w-3.5 text-emerald-400" />
                Up to <strong>+500 pts</strong> Speed Bonus
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 border border-white/15 px-3 py-1.5 text-parchment-100">
                <Flame className="h-3.5 w-3.5 text-orange-400" />
                <strong>+100 pts</strong> 3+ Streak Bonus
              </span>
            </div>

            {catalog?.currentUser && (
              <div className="pt-2 flex flex-wrap items-center gap-3">
                <Link
                  href="/quiz/history"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 border border-white/20 px-4 py-2 text-xs font-bold text-amber-300 hover:bg-white/20 transition"
                >
                  <History className="h-4 w-4" />
                  <span>My Quiz History ({catalog.currentUser.displayName})</span>
                </Link>
                {catalog.currentUser.role === 'admin' && (
                  <Link
                    href="/admin?tab=quizzes"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400/20 border border-amber-400/40 px-4 py-2 text-xs font-bold text-amber-300 hover:bg-amber-400/30 transition"
                  >
                    <Shield className="h-4 w-4" />
                    <span>Open Admin Quiz Builder</span>
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Right: Join Live Room Card */}
          <div className="lg:col-span-5">
            <div className="rounded-3xl bg-white p-6 sm:p-7 text-mudra-950 shadow-2xl border-2 border-amber-400">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-serif text-lg font-bold text-mudra-950">
                  Join a Live Room
                </h2>
                <div className="flex items-center rounded-xl bg-parchment-100 p-1 border border-mudra-200 text-xs">
                  <button
                    type="button"
                    onClick={() => setPreferredLanguage('en')}
                    className={`rounded-lg px-2.5 py-1 font-bold ${
                      preferredLanguage === 'en'
                        ? 'bg-[#0b192c] text-amber-300'
                        : 'text-mudra-800'
                    }`}
                  >
                    English
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreferredLanguage('ml')}
                    className={`rounded-lg px-2.5 py-1 font-bold ${
                      preferredLanguage === 'ml'
                        ? 'bg-[#0b192c] text-amber-300'
                        : 'text-mudra-800'
                    }`}
                  >
                    മലയാളം
                  </button>
                </div>
              </div>

              {error && (
                <div
                  role="alert"
                  data-testid="quiz-join-error"
                  className={`mb-4 flex items-start gap-2 rounded-xl border p-3 text-xs font-medium ${
                    errorCode === 'ROOM_FULL'
                      ? 'border-amber-400 bg-amber-50 text-amber-950'
                      : 'border-red-300 bg-red-50 text-red-800'
                  }`}
                >
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    {errorCode === 'ROOM_FULL' && (
                      <div className="font-bold uppercase text-[11px] mb-0.5">
                        Room Full
                      </div>
                    )}
                    <span>{error}</span>
                  </div>
                </div>
              )}

              <form onSubmit={handleJoinRoom} className="space-y-4">
                <div>
                  <label
                    htmlFor="roomCodeInput"
                    className="block text-xs font-bold uppercase tracking-wider text-mudra-700 mb-1"
                  >
                    6-Character Room Code
                  </label>
                  <input
                    id="roomCodeInput"
                    type="text"
                    required
                    maxLength={10}
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    placeholder="e.g. MUD207"
                    className="w-full rounded-xl border-2 border-mudra-300 bg-parchment-50 px-4 py-3 font-mono text-lg font-black tracking-widest text-mudra-950 uppercase focus:border-[#0b192c] focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="displayNameInput"
                    className="block text-xs font-bold uppercase tracking-wider text-mudra-700 mb-1"
                  >
                    {catalog?.currentUser
                      ? 'Your Player Name (Signed-in Account)'
                      : 'Your Display Name (Guest)'}
                  </label>
                  <input
                    id="displayNameInput"
                    type="text"
                    required
                    maxLength={40}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Enter your name…"
                    className="w-full rounded-xl border border-mudra-300 bg-parchment-50 px-4 py-3 text-sm font-semibold text-mudra-950 focus:border-[#0b192c] focus:bg-white focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={joiningRoom}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-[#0b192c] px-5 py-3.5 text-sm font-black text-amber-300 hover:bg-mudra-900 shadow-lg transition active:scale-[0.99] disabled:opacity-50"
                >
                  {joiningRoom ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Joining Live Room…</span>
                    </>
                  ) : (
                    <>
                      <Users className="h-4 w-4" />
                      <span>Join Live Game</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Active Open Rooms Quick Tap */}
              {catalog?.activeRooms?.length > 0 && (
                <div className="mt-4 pt-3 border-t border-mudra-100">
                  <p className="text-[11px] font-bold uppercase text-mudra-600 mb-2">
                    Active Live Rooms Open Right Now:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {catalog.activeRooms.map((r: { roomCode: string; status: string }) => (
                      <button
                        key={r.roomCode}
                        type="button"
                        onClick={() => setRoomCode(r.roomCode)}
                        className="rounded-lg bg-amber-100 border border-amber-300 px-2.5 py-1 font-mono text-xs font-bold text-mudra-950 hover:bg-amber-200"
                      >
                        {r.roomCode} ({r.status})
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Published Quizzes Available for Self-Paced Play */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="font-serif text-2xl font-bold text-mudra-950">
              Self-Paced Published Quizzes (സ്വയം പരിശീലന ക്വിസുകൾ)
            </h2>
            <p className="text-xs text-mudra-700">
              Practice independently at your own pace with instant explanations and linked Mudra
              reference PDFs.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {(catalog?.quizzes || []).map(
            (q: {
              quizId: string;
              titleEn: string;
              titleMl: string;
              descriptionEn?: string;
              descriptionMl?: string;
              questionCount: number;
              defaultTimeSeconds: number;
              scoringRules: {
                basePoints: number;
                speedBonusEnabled: boolean;
                speedBonusMax: number;
                streakBonusEnabled: boolean;
                streakBonusPoints: number;
              };
            }) => (
              <div
                key={q.quizId}
                className="flex flex-col justify-between rounded-3xl border border-mudra-200 bg-white p-6 shadow-xs hover:border-mudra-400 transition"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="rounded-lg bg-[#0b192c] px-2.5 py-1 font-mono text-xs font-bold text-amber-300">
                      {q.questionCount} Questions • {q.defaultTimeSeconds}s / Q
                    </span>
                    <span className="rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-bold text-emerald-900">
                      Malayalam &amp; English
                    </span>
                  </div>

                  <h3 className="font-serif text-xl font-bold text-mudra-950">
                    {preferredLanguage === 'ml'
                      ? q.titleMl || q.titleEn
                      : q.titleEn || q.titleMl}
                  </h3>
                  {q.titleMl && q.titleEn && (
                    <p className="text-sm font-medium text-mudra-700 mt-0.5">
                      {preferredLanguage === 'ml' ? q.titleEn : q.titleMl}
                    </p>
                  )}

                  <p className="mt-2.5 text-xs text-mudra-700 leading-relaxed">
                    {preferredLanguage === 'ml'
                      ? q.descriptionMl || q.descriptionEn
                      : q.descriptionEn || q.descriptionMl}
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-mudra-100 flex items-center justify-between gap-3">
                  <div className="text-[11px] text-mudra-600">
                    Scoring: <strong>{q.scoringRules.basePoints}</strong> pts
                    {q.scoringRules.speedBonusEnabled
                      ? ` + ${q.scoringRules.speedBonusMax} speed`
                      : ''}
                    {q.scoringRules.streakBonusEnabled
                      ? ` + ${q.scoringRules.streakBonusPoints} streak`
                      : ''}
                  </div>

                  <button
                    type="button"
                    disabled={startingQuizId === q.quizId}
                    onClick={() => handleStartSelfPaced(q.quizId)}
                    className="inline-flex items-center gap-2 rounded-2xl bg-amber-400 px-5 py-2.5 text-xs font-black text-[#0b192c] hover:bg-amber-300 shadow transition active:scale-95"
                  >
                    {startingQuizId === q.quizId ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Starting…</span>
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 fill-current" />
                        <span>Start Self-Paced Quiz</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

export default function PublicQuizLobbyPage() {
  return (
    <Suspense fallback={<div className="py-16 text-center text-sm">Loading Mudra Quiz Arena…</div>}>
      <QuizLobbyInner />
    </Suspense>
  );
}
