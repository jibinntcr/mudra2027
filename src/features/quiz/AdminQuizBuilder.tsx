'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  PlusCircle,
  Edit3,
  Eye,
  Upload,
  Download,
  Play,
  ArrowUp,
  ArrowDown,
  Trash2,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  FileText,
  Archive,
  Globe,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import type {
  QuizDocument,
  QuizQuestionItem,
  QuizOptionItem,
  QuizRoomDocument,
  LinkedDocumentRef,
} from '@/lib/db/types';
import type { ExcelQuestionRowPreview } from '@/features/quiz/excel';

const EMPTY_MCQ_OPTIONS: QuizOptionItem[] = [
  { optionId: 'A', textEn: '', textMl: '' },
  { optionId: 'B', textEn: '', textMl: '' },
  { optionId: 'C', textEn: '', textMl: '' },
  { optionId: 'D', textEn: '', textMl: '' },
];

const EMPTY_TF_OPTIONS: QuizOptionItem[] = [
  { optionId: 'TRUE', textEn: 'True', textMl: 'ശരി (True)' },
  { optionId: 'FALSE', textEn: 'False', textMl: 'തെറ്റ് (False)' },
];

export default function AdminQuizBuilder() {
  const [quizzes, setQuizzes] = useState<QuizDocument[]>([]);
  const [recentRooms, setRecentRooms] = useState<QuizRoomDocument[]>([]);
  const [availableDocs, setAvailableDocs] = useState<LinkedDocumentRef[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<QuizDocument | null>(null);
  const [previewLang, setPreviewLang] = useState<'en' | 'ml'>('en');
  const [previewMode, setPreviewMode] = useState(false);
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [loading, setLoading] = useState(true);

  // Create Quiz modal/card state
  const [newTitleEn, setNewTitleEn] = useState('');
  const [newTitleMl, setNewTitleMl] = useState('');
  const [newDescEn, setNewDescEn] = useState('');
  const [newDescMl, setNewDescMl] = useState('');
  const [newDefaultTime, setNewDefaultTime] = useState(20);

  // Question editor state
  const [editingQIndex, setEditingQIndex] = useState<number | null>(null);
  const [qType, setQType] = useState<'single_choice' | 'true_false'>('single_choice');
  const [qPromptEn, setQPromptEn] = useState('');
  const [qPromptMl, setQPromptMl] = useState('');
  const [qOptions, setQOptions] = useState<QuizOptionItem[]>(EMPTY_MCQ_OPTIONS);
  const [qCorrectId, setQCorrectId] = useState('A');
  const [qExpEn, setQExpEn] = useState('');
  const [qExpMl, setQExpMl] = useState('');
  const [qTimeLimit, setQTimeLimit] = useState(20);
  const [qLinkedDocId, setQLinkedDocId] = useState('');

  // Excel bulk import state
  const [excelFileBase64, setExcelFileBase64] = useState<string | null>(null);
  const [excelFileName, setExcelFileName] = useState<string>('');
  const [excelPreview, setExcelPreview] = useState<{
    totalRows: number;
    validRowsCount: number;
    invalidRowsCount: number;
    canImport: boolean;
    rows: ExcelQuestionRowPreview[];
  } | null>(null);
  const [replaceOnImport, setReplaceOnImport] = useState(false);
  const [importingExcel, setImportingExcel] = useState(false);

  // Open Live Room modal state
  const [hostMode, setHostMode] = useState<'auto_live' | 'host_live'>('auto_live');
  const [roomCapacity, setRoomCapacity] = useState(100);
  const [revealSeconds, setRevealSeconds] = useState(6);
  const [speedBonusEnabled, setSpeedBonusEnabled] = useState(true);
  const [streakBonusEnabled, setStreakBonusEnabled] = useState(true);

  const loadQuizData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/quizzes');
      if (res.ok) {
        const data = await res.json();
        setQuizzes(data.quizzes || []);
        setRecentRooms(data.recentRooms || []);
        setAvailableDocs(data.availableDocuments || []);
        if (!selectedQuiz && data.quizzes?.length > 0) {
          setSelectedQuiz(data.quizzes[0]);
        } else if (selectedQuiz) {
          const refreshed = (data.quizzes || []).find(
            (q: QuizDocument) => q.quizId === selectedQuiz.quizId
          );
          if (refreshed) setSelectedQuiz(refreshed);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [selectedQuiz]);

  useEffect(() => {
    loadQuizData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetQuestionForm(defaultTime = 20) {
    setEditingQIndex(null);
    setQType('single_choice');
    setQPromptEn('');
    setQPromptMl('');
    setQOptions(EMPTY_MCQ_OPTIONS.map((o) => ({ ...o })));
    setQCorrectId('A');
    setQExpEn('');
    setQExpMl('');
    setQTimeLimit(defaultTime);
    setQLinkedDocId('');
  }

  function loadQuestionIntoEditor(q: QuizQuestionItem, idx: number) {
    setEditingQIndex(idx);
    setQType(q.type);
    setQPromptEn(q.promptEn);
    setQPromptMl(q.promptMl);
    setQOptions(q.options.map((o) => ({ ...o })));
    setQCorrectId(q.correctOptionId);
    setQExpEn(q.explanationEn || '');
    setQExpMl(q.explanationMl || '');
    setQTimeLimit(q.timeLimitSeconds || selectedQuiz?.defaultTimeSeconds || 20);
    setQLinkedDocId(q.linkedDocId || '');
  }

  async function handleCreateQuiz(e: React.FormEvent) {
    e.preventDefault();
    setBanner(null);
    const res = await fetch('/api/admin/quizzes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titleEn: newTitleEn,
        titleMl: newTitleMl,
        descriptionEn: newDescEn,
        descriptionMl: newDescMl,
        defaultTimeSeconds: newDefaultTime,
        status: 'draft',
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setBanner({ type: 'err', text: data.error || 'Failed to create quiz' });
      return;
    }
    setBanner({
      type: 'ok',
      text: `Created quiz "${data.quiz.titleEn || data.quiz.titleMl}" (${data.quiz.quizId}).`,
    });
    setNewTitleEn('');
    setNewTitleMl('');
    setNewDescEn('');
    setNewDescMl('');
    setSelectedQuiz(data.quiz);
    loadQuizData();
  }

  async function handleUpdateQuizStatus(quiz: QuizDocument, status: 'draft' | 'published' | 'archived') {
    setBanner(null);
    const res = await fetch('/api/admin/quizzes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quizId: quiz.quizId,
        status,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setBanner({ type: 'err', text: data.error || 'Failed to update status' });
      return;
    }
    setSelectedQuiz(data.quiz);
    setBanner({
      type: 'ok',
      text: `Quiz ${data.quiz.quizId} is now ${status.toUpperCase()} (Fixed Version v${data.quiz.currentVersion}).`,
    });
    loadQuizData();
  }

  async function handleSaveQuestion(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedQuiz) return;
    setBanner(null);

    if (!qPromptEn.trim() && !qPromptMl.trim()) {
      setBanner({
        type: 'err',
        text: 'Please provide the question prompt in English, Malayalam, or both.',
      });
      return;
    }

    const activeOptions =
      qType === 'true_false'
        ? qOptions.slice(0, 2)
        : qOptions.filter((o) => o.textEn.trim() || o.textMl.trim());

    if (activeOptions.length < 2) {
      setBanner({
        type: 'err',
        text: 'Please provide at least two answer choices.',
      });
      return;
    }

    const newQ: QuizQuestionItem = {
      questionId:
        editingQIndex !== null && selectedQuiz.questions[editingQIndex]
          ? selectedQuiz.questions[editingQIndex].questionId
          : `Q-${Date.now()}`,
      order:
        editingQIndex !== null
          ? editingQIndex + 1
          : selectedQuiz.questions.length + 1,
      type: qType,
      promptEn: qPromptEn.trim(),
      promptMl: qPromptMl.trim(),
      options: activeOptions,
      correctOptionId: qCorrectId,
      explanationEn: qExpEn.trim(),
      explanationMl: qExpMl.trim(),
      timeLimitSeconds: Number(qTimeLimit) || selectedQuiz.defaultTimeSeconds || 20,
      linkedDocId: qLinkedDocId || null,
    };

    const nextQuestions = [...selectedQuiz.questions];
    if (editingQIndex !== null) {
      nextQuestions[editingQIndex] = newQ;
    } else {
      nextQuestions.push(newQ);
    }

    const res = await fetch('/api/admin/quizzes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quizId: selectedQuiz.quizId,
        questions: nextQuestions,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setBanner({ type: 'err', text: data.error || 'Failed to save question' });
      return;
    }

    setSelectedQuiz(data.quiz);
    resetQuestionForm(data.quiz.defaultTimeSeconds);
    setBanner({
      type: 'ok',
      text: `Saved question to ${data.quiz.quizId} (Total: ${data.quiz.questions.length} questions, Version v${data.quiz.currentVersion}).`,
    });
    loadQuizData();
  }

  async function handleReorderQuestion(idx: number, direction: 'up' | 'down') {
    if (!selectedQuiz) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= selectedQuiz.questions.length) return;

    const nextQuestions = [...selectedQuiz.questions];
    const temp = nextQuestions[idx];
    nextQuestions[idx] = nextQuestions[targetIdx];
    nextQuestions[targetIdx] = temp;

    const res = await fetch('/api/admin/quizzes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quizId: selectedQuiz.quizId,
        questions: nextQuestions,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setSelectedQuiz(data.quiz);
      loadQuizData();
    }
  }

  async function handleDeleteQuestion(idx: number) {
    if (!selectedQuiz) return;
    const nextQuestions = selectedQuiz.questions.filter((_, i) => i !== idx);
    const res = await fetch('/api/admin/quizzes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quizId: selectedQuiz.quizId,
        questions: nextQuestions,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setSelectedQuiz(data.quiz);
      loadQuizData();
    }
  }

  async function handleExcelFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selectedQuiz) return;
    setExcelFileName(file.name);
    setImportingExcel(true);
    setBanner(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const b64 = window.btoa(binary);
      setExcelFileBase64(b64);

      const res = await fetch('/api/admin/quizzes/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'preview',
          quizId: selectedQuiz.quizId,
          fileBase64: b64,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBanner({ type: 'err', text: data.error || 'Failed to parse Excel file' });
      } else {
        setExcelPreview(data);
      }
    } finally {
      setImportingExcel(false);
    }
  }

  async function handleConfirmExcelImport() {
    if (!excelFileBase64 || !selectedQuiz) return;
    setImportingExcel(true);
    setBanner(null);

    try {
      const res = await fetch('/api/admin/quizzes/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'confirm',
          quizId: selectedQuiz.quizId,
          fileBase64: excelFileBase64,
          replaceExisting: replaceOnImport,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBanner({ type: 'err', text: data.error || 'Import failed' });
        return;
      }
      setSelectedQuiz(data.quiz);
      setExcelPreview(null);
      setExcelFileBase64(null);
      setExcelFileName('');
      setBanner({
        type: 'ok',
        text: `Imported ${data.importedCount} validated questions into ${data.quiz.quizId} (Total: ${data.totalQuestions}).`,
      });
      loadQuizData();
    } finally {
      setImportingExcel(false);
    }
  }

  async function handleLaunchLiveRoom(quiz: QuizDocument) {
    setBanner(null);
    const res = await fetch('/api/admin/quizzes/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quizId: quiz.quizId,
        mode: hostMode,
        capacity: roomCapacity,
        revealDurationSeconds: revealSeconds,
        scoringRules: {
          ...quiz.scoringRules,
          speedBonusEnabled,
          streakBonusEnabled,
        },
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setBanner({ type: 'err', text: data.error || 'Failed to open live room' });
      return;
    }
    window.location.href = `/admin/quizzes/host/${data.room.roomCode}`;
  }

  if (loading && quizzes.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-xs text-mudra-700">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading Mudra Quiz Builder…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {banner && (
        <div
          className={`rounded-xl border p-4 text-xs font-medium flex items-center gap-2 ${
            banner.type === 'ok'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
              : 'border-red-300 bg-red-50 text-red-900'
          }`}
        >
          {banner.type === 'ok' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-700 shrink-0" />
          )}
          <span>{banner.text}</span>
        </div>
      )}

      {/* Top Grid: Quiz Catalog + Create Quiz + Live Room Launcher */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Existing Quizzes & Create Quiz */}
        <div className="lg:col-span-4 space-y-5">
          <div className="rounded-2xl border border-mudra-200 bg-white p-5 shadow-xs">
            <h2 className="font-serif text-base font-bold text-mudra-950 mb-3">
              Mudra Quizzes ({quizzes.length})
            </h2>
            <div className="space-y-2.5 max-h-72 overflow-y-auto">
              {quizzes.map((q) => {
                const isSelected = selectedQuiz?.quizId === q.quizId;
                return (
                  <div
                    key={q.quizId}
                    onClick={() => {
                      setSelectedQuiz(q);
                      resetQuestionForm(q.defaultTimeSeconds);
                    }}
                    className={`cursor-pointer rounded-xl border p-3.5 transition ${
                      isSelected
                        ? 'border-[#0b192c] bg-parchment-100/90 shadow-2xs'
                        : 'border-mudra-100 bg-parchment-50/50 hover:bg-parchment-100/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] font-bold text-mudra-700">
                        {q.quizId} • v{q.currentVersion}
                      </span>
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                          q.status === 'published'
                            ? 'bg-emerald-100 text-emerald-900'
                            : q.status === 'archived'
                            ? 'bg-gray-200 text-gray-700'
                            : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        {q.status}
                      </span>
                    </div>
                    <p className="mt-1 font-serif text-sm font-bold text-mudra-950">
                      {q.titleEn || q.titleMl}
                    </p>
                    {q.titleMl && q.titleEn && (
                      <p className="text-xs text-mudra-700 truncate">{q.titleMl}</p>
                    )}
                    <p className="mt-1 text-[11px] text-mudra-600">
                      {q.questions.length} Questions • Default {q.defaultTimeSeconds}s
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Create New Quiz Form */}
          <div className="rounded-2xl border border-mudra-200 bg-white p-5 shadow-xs">
            <h3 className="flex items-center gap-1.5 font-serif text-sm font-bold text-mudra-950 mb-3">
              <PlusCircle className="h-4 w-4 text-mudra-700" />
              Create New Bilingual Quiz
            </h3>
            <form onSubmit={handleCreateQuiz} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-mudra-800 mb-1">
                  Title (English)
                </label>
                <input
                  type="text"
                  value={newTitleEn}
                  onChange={(e) => setNewTitleEn(e.target.value)}
                  placeholder="e.g. Kerala Stamp Act & LRC Rulings Quiz"
                  className="w-full rounded-lg border border-mudra-300 bg-parchment-50 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-mudra-800 mb-1">
                  Title (Malayalam / മലയാളം)
                </label>
                <input
                  type="text"
                  value={newTitleMl}
                  onChange={(e) => setNewTitleMl(e.target.value)}
                  placeholder="e.g. കേരള മുദ്രപത്ര നിയമം ക്വിസ്"
                  className="w-full rounded-lg border border-mudra-300 bg-parchment-50 px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-mudra-800 mb-1">
                    Default Timer (sec)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={300}
                    value={newDefaultTime}
                    onChange={(e) => setNewDefaultTime(Number(e.target.value))}
                    className="w-full rounded-lg border border-mudra-300 bg-parchment-50 px-3 py-2"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full rounded-lg bg-[#0b192c] px-3 py-2 font-bold text-amber-300 hover:bg-mudra-900"
                  >
                    + Create Quiz
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Recent Live Rooms & Excel Report Export */}
          {recentRooms.length > 0 && (
            <div className="rounded-2xl border border-mudra-200 bg-white p-5 shadow-xs">
              <h3 className="font-serif text-sm font-bold text-mudra-950 mb-3">
                Live Rooms &amp; Excel Reports
              </h3>
              <div className="space-y-2 text-xs">
                {recentRooms.slice(0, 6).map((r) => (
                  <div
                    key={r.roomCode}
                    className="flex items-center justify-between rounded-xl border border-mudra-100 bg-parchment-50 px-3 py-2"
                  >
                    <div>
                      <span className="font-mono font-bold text-mudra-950">
                        {r.roomCode}
                      </span>
                      <span className="ml-2 text-[10px] uppercase text-mudra-600">
                        {r.mode.replace('_', ' ')} • {r.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/admin/quizzes/host/${r.roomCode}`}
                        className="rounded bg-[#0b192c] px-2 py-1 text-[11px] font-bold text-amber-300"
                      >
                        Host Console
                      </Link>
                      <a
                        href={`/api/admin/quizzes/rooms/${r.roomCode}/export`}
                        className="rounded border border-mudra-300 bg-white px-2 py-1 text-[11px] font-semibold text-mudra-800 hover:bg-parchment-100"
                        title="Download .xlsx Report"
                      >
                        .xlsx
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Active Quiz Editor, Preview, Excel Bulk Import & Live Host Launcher */}
        <div className="lg:col-span-8 space-y-6">
          {selectedQuiz ? (
            <>
              {/* Quiz Action Bar */}
              <div className="rounded-2xl border border-mudra-200 bg-white p-5 shadow-xs">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-[#0b192c] px-2.5 py-0.5 font-mono text-xs font-bold text-amber-300">
                        {selectedQuiz.quizId} (v{selectedQuiz.currentVersion})
                      </span>
                      <span
                        className={`rounded px-2.5 py-0.5 text-xs font-bold uppercase ${
                          selectedQuiz.status === 'published'
                            ? 'bg-emerald-100 text-emerald-900'
                            : selectedQuiz.status === 'archived'
                            ? 'bg-gray-200 text-gray-800'
                            : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        {selectedQuiz.status}
                      </span>
                    </div>
                    <h2 className="mt-2 font-serif text-xl font-bold text-mudra-950">
                      {selectedQuiz.titleEn || selectedQuiz.titleMl}
                    </h2>
                    {selectedQuiz.titleMl && selectedQuiz.titleEn && (
                      <p className="text-sm font-medium text-mudra-700">
                        {selectedQuiz.titleMl}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewMode((p) => !p)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-mudra-300 bg-parchment-50 px-3.5 py-2 text-xs font-bold text-mudra-900 hover:bg-mudra-100"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>{previewMode ? 'Exit Preview' : 'Preview Quiz'}</span>
                    </button>

                    {selectedQuiz.status !== 'published' && (
                      <button
                        type="button"
                        onClick={() => handleUpdateQuizStatus(selectedQuiz, 'published')}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-500"
                      >
                        <Globe className="h-3.5 w-3.5" />
                        <span>Publish Quiz</span>
                      </button>
                    )}

                    {selectedQuiz.status !== 'archived' && (
                      <button
                        type="button"
                        onClick={() => handleUpdateQuizStatus(selectedQuiz, 'archived')}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-mudra-300 bg-white px-3 py-2 text-xs font-semibold text-mudra-700 hover:bg-parchment-100"
                      >
                        <Archive className="h-3.5 w-3.5" />
                        <span>Archive</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Launch Live Session Bar */}
                {selectedQuiz.status === 'published' && (
                  <div className="mt-5 rounded-xl border border-amber-300 bg-gradient-to-r from-[#0b192c] to-[#132743] p-4 text-white">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                          Launch Classroom Live Game
                        </span>
                        <p className="text-xs text-parchment-200 mt-0.5">
                          Creates a fixed version snapshot (v{selectedQuiz.currentVersion}) with a
                          6-character room code &amp; copyable join link.
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5 text-xs">
                        <select
                          value={hostMode}
                          onChange={(e) =>
                            setHostMode(e.target.value as 'auto_live' | 'host_live')
                          }
                          className="rounded-lg bg-white/10 border border-white/20 px-2.5 py-1.5 text-white font-semibold"
                        >
                          <option value="auto_live" className="text-mudra-950">
                            Automatic Live Mode
                          </option>
                          <option value="host_live" className="text-mudra-950">
                            Host-Controlled Live Mode
                          </option>
                        </select>

                        <label className="flex items-center gap-1 text-[11px]">
                          <span>Cap:</span>
                          <input
                            type="number"
                            min={2}
                            max={500}
                            value={roomCapacity}
                            onChange={(e) => setRoomCapacity(Number(e.target.value))}
                            className="w-16 rounded bg-white/10 border border-white/20 px-2 py-1 text-white font-mono"
                          />
                        </label>

                        <label className="flex items-center gap-1 text-[11px]">
                          <span>Reveal(s):</span>
                          <input
                            type="number"
                            min={2}
                            max={30}
                            value={revealSeconds}
                            onChange={(e) => setRevealSeconds(Number(e.target.value))}
                            className="w-14 rounded bg-white/10 border border-white/20 px-2 py-1 text-white font-mono"
                          />
                        </label>

                        <label className="flex items-center gap-1 text-[11px]">
                          <input
                            type="checkbox"
                            checked={speedBonusEnabled}
                            onChange={(e) => setSpeedBonusEnabled(e.target.checked)}
                          />
                          <span>Speed Bonus</span>
                        </label>

                        <label className="flex items-center gap-1 text-[11px]">
                          <input
                            type="checkbox"
                            checked={streakBonusEnabled}
                            onChange={(e) => setStreakBonusEnabled(e.target.checked)}
                          />
                          <span>Streak Bonus</span>
                        </label>

                        <button
                          type="button"
                          onClick={() => handleLaunchLiveRoom(selectedQuiz)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-4 py-2 text-xs font-bold text-[#0b192c] hover:bg-amber-300 shadow"
                        >
                          <Play className="h-3.5 w-3.5 fill-current" />
                          <span>Open Live Room</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* PREVIEW MODE */}
              {previewMode && (
                <div className="rounded-2xl border-2 border-[#0b192c] bg-white p-6 shadow-md">
                  <div className="flex items-center justify-between border-b border-mudra-200 pb-3 mb-4">
                    <div>
                      <span className="text-xs font-bold uppercase text-mudra-700">
                        Bilingual Player Preview
                      </span>
                      <h3 className="font-serif text-lg font-bold text-mudra-950">
                        {previewLang === 'ml'
                          ? selectedQuiz.titleMl || selectedQuiz.titleEn
                          : selectedQuiz.titleEn || selectedQuiz.titleMl}
                      </h3>
                    </div>
                    <div className="flex items-center gap-1 rounded-xl bg-parchment-100 p-1 border border-mudra-200 text-xs">
                      <button
                        type="button"
                        onClick={() => setPreviewLang('en')}
                        className={`rounded-lg px-3 py-1 font-bold ${
                          previewLang === 'en' ? 'bg-[#0b192c] text-amber-300' : 'text-mudra-800'
                        }`}
                      >
                        English
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewLang('ml')}
                        className={`rounded-lg px-3 py-1 font-bold ${
                          previewLang === 'ml' ? 'bg-[#0b192c] text-amber-300' : 'text-mudra-800'
                        }`}
                      >
                        മലയാളം
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {selectedQuiz.questions.map((q, idx) => (
                      <div
                        key={q.questionId}
                        className="rounded-xl border border-mudra-200 bg-parchment-50 p-4"
                      >
                        <div className="flex items-center justify-between text-xs text-mudra-600 mb-1.5">
                          <span className="font-bold text-mudra-900">
                            Question {idx + 1} ({q.type === 'true_false' ? 'True / False' : 'Multiple Choice'})
                          </span>
                          <span className="font-mono">{q.timeLimitSeconds}s timer</span>
                        </div>
                        <p className="font-semibold text-sm text-mudra-950">
                          {previewLang === 'ml'
                            ? q.promptMl || q.promptEn
                            : q.promptEn || q.promptMl}
                        </p>
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {q.options.map((opt) => {
                            const isCorrect = opt.optionId === q.correctOptionId;
                            return (
                              <div
                                key={opt.optionId}
                                className={`rounded-lg border px-3 py-2 text-xs flex items-center justify-between ${
                                  isCorrect
                                    ? 'border-emerald-500 bg-emerald-50 font-bold text-emerald-950'
                                    : 'border-mudra-200 bg-white text-mudra-900'
                                }`}
                              >
                                <span>
                                  <strong className="font-mono mr-2">{opt.optionId}:</strong>
                                  {previewLang === 'ml'
                                    ? opt.textMl || opt.textEn
                                    : opt.textEn || opt.textMl}
                                </span>
                                {isCorrect && (
                                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {(q.explanationEn || q.explanationMl) && (
                          <p className="mt-2.5 text-xs text-mudra-700 bg-white/80 rounded-lg p-2.5 border border-mudra-100">
                            <strong>Explanation:</strong>{' '}
                            {previewLang === 'ml'
                              ? q.explanationMl || q.explanationEn
                              : q.explanationEn || q.explanationMl}
                          </p>
                        )}
                        {q.linkedDocSnapshot && (
                          <div className="mt-2">
                            <Link
                              href={`/library/documents/${q.linkedDocSnapshot.slug}`}
                              target="_blank"
                              className="inline-flex items-center gap-1.5 text-xs font-bold text-mudra-800 hover:underline"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              <span>
                                Linked Mudra PDF: {q.linkedDocSnapshot.documentNumber}
                              </span>
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* EXCEL (.XLSX) BULK IMPORT CARD */}
              <div className="rounded-2xl border border-mudra-200 bg-white p-5 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <div>
                    <h3 className="flex items-center gap-2 font-serif text-base font-bold text-mudra-950">
                      <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
                      Excel (.xlsx) Bulk Question Import
                    </h3>
                    <p className="text-xs text-mudra-600">
                      Download the bilingual template, upload your `.xlsx` sheet to preview rows and
                      row-level validation errors, and confirm batch import once valid.
                    </p>
                  </div>

                  <a
                    href="/api/admin/quizzes/template"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-mudra-300 bg-parchment-50 px-3.5 py-2 text-xs font-bold text-mudra-900 hover:bg-mudra-100"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download .xlsx Template</span>
                  </a>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#0b192c] px-4 py-2.5 text-xs font-bold text-amber-300 hover:bg-mudra-900">
                    <Upload className="h-3.5 w-3.5" />
                    <span>{excelFileName || 'Choose .xlsx File to Preview'}</span>
                    <input
                      type="file"
                      accept=".xlsx"
                      onChange={handleExcelFileChange}
                      className="hidden"
                    />
                  </label>

                  <label className="flex items-center gap-1.5 text-xs text-mudra-700">
                    <input
                      type="checkbox"
                      checked={replaceOnImport}
                      onChange={(e) => setReplaceOnImport(e.target.checked)}
                    />
                    <span>Replace existing questions on confirm</span>
                  </label>
                </div>

                {excelPreview && (
                  <div className="mt-4 rounded-xl border border-mudra-200 bg-parchment-50 p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs font-semibold">
                        Previewed <strong>{excelPreview.totalRows}</strong> row(s):{' '}
                        <span className="text-emerald-700">
                          {excelPreview.validRowsCount} Valid
                        </span>{' '}
                        •{' '}
                        <span
                          className={
                            excelPreview.invalidRowsCount > 0
                              ? 'text-red-700 font-bold'
                              : 'text-mudra-600'
                          }
                        >
                          {excelPreview.invalidRowsCount} With Errors
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setExcelPreview(null);
                            setExcelFileBase64(null);
                            setExcelFileName('');
                          }}
                          className="rounded-lg border border-mudra-300 bg-white px-3 py-1.5 text-xs"
                        >
                          Clear
                        </button>
                        <button
                          type="button"
                          disabled={!excelPreview.canImport || importingExcel}
                          onClick={handleConfirmExcelImport}
                          className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-40"
                        >
                          {importingExcel
                            ? 'Importing…'
                            : `Confirm & Import ${excelPreview.validRowsCount} Questions`}
                        </button>
                      </div>
                    </div>

                    <div className="overflow-x-auto max-h-64">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-mudra-200 text-mudra-600">
                            <th className="py-1.5 pr-2">Row #</th>
                            <th className="py-1.5 px-2">Type</th>
                            <th className="py-1.5 px-2">Question (EN / ML)</th>
                            <th className="py-1.5 px-2">Correct</th>
                            <th className="py-1.5 px-2">PDF Ref</th>
                            <th className="py-1.5 pl-2">Validation Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-mudra-100">
                          {excelPreview.rows.map((r) => (
                            <tr key={r.rowNumber}>
                              <td className="py-2 pr-2 font-mono font-bold">
                                Row {r.rowNumber}
                              </td>
                              <td className="py-2 px-2 font-mono">{r.type}</td>
                              <td className="py-2 px-2 max-w-xs truncate">
                                {r.promptEn || r.promptMl || '(empty)'}
                              </td>
                              <td className="py-2 px-2 font-mono font-bold">
                                {r.correctOptionId}
                              </td>
                              <td className="py-2 px-2 font-mono">
                                {r.resolvedDocument
                                  ? r.resolvedDocument.documentNumber
                                  : r.linkedDocRefRaw || '—'}
                              </td>
                              <td className="py-2 pl-2">
                                {r.isValid ? (
                                  <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                                    <CheckCircle2 className="h-3.5 w-3.5" /> Valid
                                  </span>
                                ) : (
                                  <ul className="text-red-700 font-medium list-disc pl-4">
                                    {r.errors.map((err, i) => (
                                      <li key={i}>{err}</li>
                                    ))}
                                  </ul>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* QUESTIONS LIST & REORDERING */}
              <div className="rounded-2xl border border-mudra-200 bg-white p-5 shadow-xs">
                <h3 className="font-serif text-base font-bold text-mudra-950 mb-3">
                  Questions in Quiz ({selectedQuiz.questions.length})
                </h3>
                {selectedQuiz.questions.length === 0 ? (
                  <p className="text-xs text-mudra-600 py-4">
                    No questions added yet. Use the form below or upload an `.xlsx` sheet above.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {selectedQuiz.questions.map((q, idx) => (
                      <div
                        key={q.questionId}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-mudra-100 bg-parchment-50/70 p-3.5 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded bg-[#0b192c] px-2 py-0.5 font-mono text-[11px] font-bold text-amber-300">
                              Q{idx + 1}
                            </span>
                            <span className="rounded bg-mudra-100 px-2 py-0.5 text-[10px] font-semibold text-mudra-800 uppercase">
                              {q.type.replace('_', ' ')}
                            </span>
                            <span className="font-mono text-[11px] text-emerald-800 font-bold">
                              Correct: {q.correctOptionId}
                            </span>
                            <span className="font-mono text-[11px] text-mudra-600">
                              {q.timeLimitSeconds}s
                            </span>
                            {q.linkedDocSnapshot && (
                              <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                                <FileText className="h-3 w-3" />
                                PDF: {q.linkedDocSnapshot.documentNumber}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 font-semibold text-mudra-950 truncate">
                            {q.promptEn || q.promptMl}
                          </p>
                          {q.promptMl && q.promptEn && (
                            <p className="text-mudra-700 truncate">{q.promptMl}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleReorderQuestion(idx, 'up')}
                            className="rounded border border-mudra-300 bg-white p-1.5 hover:bg-parchment-100 disabled:opacity-35"
                            title="Move Up"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === selectedQuiz.questions.length - 1}
                            onClick={() => handleReorderQuestion(idx, 'down')}
                            className="rounded border border-mudra-300 bg-white p-1.5 hover:bg-parchment-100 disabled:opacity-35"
                            title="Move Down"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => loadQuestionIntoEditor(q, idx)}
                            className="inline-flex items-center gap-1 rounded border border-mudra-300 bg-white px-2.5 py-1.5 font-semibold text-mudra-800 hover:bg-parchment-100"
                          >
                            <Edit3 className="h-3 w-3" /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteQuestion(idx)}
                            className="rounded border border-red-200 bg-red-50 p-1.5 text-red-700 hover:bg-red-100"
                            title="Delete Question"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ADD / EDIT QUESTION FORM */}
              <div className="rounded-2xl border border-mudra-200 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-serif text-base font-bold text-mudra-950">
                    {editingQIndex !== null
                      ? `Edit Question #${editingQIndex + 1}`
                      : 'Add Question to Quiz'}
                  </h3>
                  {editingQIndex !== null && (
                    <button
                      type="button"
                      onClick={() => resetQuestionForm(selectedQuiz.defaultTimeSeconds)}
                      className="text-xs font-semibold text-mudra-700 hover:underline"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>

                <form onSubmit={handleSaveQuestion} className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold text-mudra-800 mb-1">
                        Question Type
                      </label>
                      <select
                        value={qType}
                        onChange={(e) => {
                          const nextType = e.target.value as 'single_choice' | 'true_false';
                          setQType(nextType);
                          if (nextType === 'true_false') {
                            setQOptions(EMPTY_TF_OPTIONS.map((o) => ({ ...o })));
                            setQCorrectId('TRUE');
                          } else {
                            setQOptions(EMPTY_MCQ_OPTIONS.map((o) => ({ ...o })));
                            setQCorrectId('A');
                          }
                        }}
                        className="w-full rounded-lg border border-mudra-300 bg-parchment-50 px-3 py-2"
                      >
                        <option value="single_choice">Single-Answer Multiple Choice</option>
                        <option value="true_false">True or False</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-mudra-800 mb-1">
                        Answer Time Limit (Seconds)
                      </label>
                      <input
                        type="number"
                        min={5}
                        max={300}
                        value={qTimeLimit}
                        onChange={(e) => setQTimeLimit(Number(e.target.value))}
                        className="w-full rounded-lg border border-mudra-300 bg-parchment-50 px-3 py-2 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-mudra-800 mb-1">
                        Link Existing Mudra PDF (Optional)
                      </label>
                      <select
                        value={qLinkedDocId}
                        onChange={(e) => setQLinkedDocId(e.target.value)}
                        className="w-full rounded-lg border border-mudra-300 bg-parchment-50 px-3 py-2"
                      >
                        <option value="">— No Linked PDF —</option>
                        {availableDocs.map((d) => (
                          <option key={d.docId} value={d.docId}>
                            {d.documentNumber} ({d.docId})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-mudra-800 mb-1">
                        Question Prompt (English)
                      </label>
                      <textarea
                        rows={2}
                        value={qPromptEn}
                        onChange={(e) => setQPromptEn(e.target.value)}
                        placeholder="Enter English question text…"
                        className="w-full rounded-lg border border-mudra-300 bg-parchment-50 p-2.5"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-mudra-800 mb-1">
                        Question Prompt (Malayalam / മലയാളം)
                      </label>
                      <textarea
                        rows={2}
                        value={qPromptMl}
                        onChange={(e) => setQPromptMl(e.target.value)}
                        placeholder="മലയാളം ചോദ്യം ഇവിടെ നൽകുക…"
                        className="w-full rounded-lg border border-mudra-300 bg-parchment-50 p-2.5"
                      />
                    </div>
                  </div>

                  {/* Stable Option IDs Across Both Languages */}
                  <div className="space-y-2">
                    <label className="block font-semibold text-mudra-800">
                      Answer Choices (Matched by Stable Option IDs &amp; Radio for Correct Answer)
                    </label>
                    {qOptions.map((opt, idx) => (
                      <div
                        key={opt.optionId}
                        className={`grid grid-cols-1 sm:grid-cols-12 gap-2 items-center rounded-xl border p-2.5 ${
                          qCorrectId === opt.optionId
                            ? 'border-emerald-500 bg-emerald-50/50'
                            : 'border-mudra-200 bg-parchment-50/50'
                        }`}
                      >
                        <label className="sm:col-span-2 flex items-center gap-2 font-mono font-bold text-mudra-950 cursor-pointer">
                          <input
                            type="radio"
                            name="correctOptionId"
                            checked={qCorrectId === opt.optionId}
                            onChange={() => setQCorrectId(opt.optionId)}
                          />
                          <span>Option {opt.optionId}</span>
                        </label>
                        <input
                          type="text"
                          value={opt.textEn}
                          onChange={(e) => {
                            const copy = [...qOptions];
                            copy[idx] = { ...copy[idx], textEn: e.target.value };
                            setQOptions(copy);
                          }}
                          placeholder={`Option ${opt.optionId} (English)`}
                          className="sm:col-span-5 rounded-lg border border-mudra-300 bg-white px-3 py-1.5"
                        />
                        <input
                          type="text"
                          value={opt.textMl}
                          onChange={(e) => {
                            const copy = [...qOptions];
                            copy[idx] = { ...copy[idx], textMl: e.target.value };
                            setQOptions(copy);
                          }}
                          placeholder={`Option ${opt.optionId} (മലയാളം)`}
                          className="sm:col-span-5 rounded-lg border border-mudra-300 bg-white px-3 py-1.5"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-mudra-800 mb-1">
                        Answer Explanation (English — Optional)
                      </label>
                      <textarea
                        rows={2}
                        value={qExpEn}
                        onChange={(e) => setQExpEn(e.target.value)}
                        placeholder="Explain why the answer is correct…"
                        className="w-full rounded-lg border border-mudra-300 bg-parchment-50 p-2.5"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-mudra-800 mb-1">
                        Answer Explanation (Malayalam — Optional)
                      </label>
                      <textarea
                        rows={2}
                        value={qExpMl}
                        onChange={(e) => setQExpMl(e.target.value)}
                        placeholder="ഉത്തരത്തിന്റെ വിശദീകരണം…"
                        className="w-full rounded-lg border border-mudra-300 bg-parchment-50 p-2.5"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="rounded-xl bg-[#0b192c] px-5 py-2.5 text-xs font-bold text-amber-300 hover:bg-mudra-900 shadow"
                  >
                    {editingQIndex !== null ? 'Update Question' : '+ Add Question to Quiz'}
                  </button>
                </form>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
