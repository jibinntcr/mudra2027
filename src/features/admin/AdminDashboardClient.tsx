'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Users,
  FileText,
  FolderTree,
  RefreshCw,
  UserPlus,
  KeyRound,
  Ban,
  CheckCircle2,
  Eye,
  EyeOff,
  PlusCircle,
  Loader2,
  ExternalLink,
} from 'lucide-react';

interface AdminUserItem {
  userId: string;
  loginId: string;
  displayName: string;
  role: 'reader' | 'admin';
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

interface AdminDocItem {
  docId: string;
  slug: string;
  documentNumber: string;
  normalizedDocNumber: string;
  titleMl: string;
  titleEn: string;
  categorySlugs: string[];
  year: number | null;
  hasTextLayer: boolean;
  isPublished: boolean;
  currentVersion: number;
}

interface AdminCatItem {
  slug: string;
  nameEn: string;
  nameMl?: string;
  parentSlug: string | null;
  pathLabel: string;
  order: number;
  isPublished: boolean;
}

export default function AdminDashboardClient({
  initialTab = 'users',
  stats,
}: {
  initialTab?: string;
  stats: {
    totalUsers: number;
    activeReaders: number;
    totalDocuments: number;
    publishedDocuments: number;
    textPdfs: number;
    scannedPdfs: number;
    totalCategories: number;
  };
}) {
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [bannerMsg, setBannerMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Users pagination state
  const [usersList, setUsersList] = useState<AdminUserItem[]>([]);
  const [usersPage, setUsersPage] = useState(1);
  const [usersTotalPages, setUsersTotalPages] = useState(1);
  const [usersTotal, setUsersTotal] = useState(0);

  // Create user form
  const [newLoginId, setNewLoginId] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newRole, setNewRole] = useState<'reader' | 'admin'>('reader');
  const [newTempPassword, setNewTempPassword] = useState('MudraTemp@2026!');

  // Reset password modal state
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetLoginId, setResetLoginId] = useState<string>('');
  const [resetPasswordVal, setResetPasswordVal] = useState('ResetPass@2026!');

  // Documents pagination state
  const [docsList, setDocsList] = useState<AdminDocItem[]>([]);
  const [docsPage, setDocsPage] = useState(1);
  const [docsTotalPages, setDocsTotalPages] = useState(1);
  const [docsTotal, setDocsTotal] = useState(0);
  const [docsQuery, setDocsQuery] = useState('');

  // Create document form
  const [docNumberInput, setDocNumberInput] = useState('');
  const [docTitleMlInput, setDocTitleMlInput] = useState('');
  const [docTitleEnInput, setDocTitleEnInput] = useState('');
  const [docCategoryInput, setDocCategoryInput] = useState('lrc-orders-sale');
  const [docHasTextInput, setDocHasTextInput] = useState(true);

  // Categories state
  const [categoriesList, setCategoriesList] = useState<AdminCatItem[]>([]);
  const [catSlugInput, setCatSlugInput] = useState('');
  const [catNameEnInput, setCatNameEnInput] = useState('');
  const [catNameMlInput, setCatNameMlInput] = useState('');
  const [catParentInput, setCatParentInput] = useState('lrc-orders');

  // Import state
  const [runningImport, setRunningImport] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [importResult, setImportResult] = useState<any>(null);

  const loadUsers = useCallback(async (page = 1) => {
    const res = await fetch(`/api/admin/users?page=${page}&limit=8`);
    if (res.ok) {
      const data = await res.json();
      setUsersList(data.items || []);
      setUsersPage(data.page || 1);
      setUsersTotalPages(data.totalPages || 1);
      setUsersTotal(data.total || 0);
    }
  }, []);

  const loadDocs = useCallback(async (page = 1, q = '') => {
    const res = await fetch(
      `/api/admin/documents?page=${page}&limit=8&q=${encodeURIComponent(q)}`
    );
    if (res.ok) {
      const data = await res.json();
      setDocsList(data.items || []);
      setDocsPage(data.page || 1);
      setDocsTotalPages(data.totalPages || 1);
      setDocsTotal(data.total || 0);
    }
  }, []);

  const loadCategories = useCallback(async () => {
    const res = await fetch('/api/admin/categories');
    if (res.ok) {
      const data = await res.json();
      setCategoriesList(data.categories || []);
    }
  }, []);

  useEffect(() => {
    loadUsers(1);
    loadDocs(1, '');
    loadCategories();
  }, [loadUsers, loadDocs, loadCategories]);

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setBannerMsg(null);
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        loginId: newLoginId,
        displayName: newDisplayName,
        role: newRole,
        temporaryPassword: newTempPassword,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setBannerMsg({ type: 'err', text: data.error || 'Failed to create account' });
      return;
    }
    setBannerMsg({
      type: 'ok',
      text: `Created account "${data.user.loginId}" with temporary password. User will be required to change password on first login.`,
    });
    setNewLoginId('');
    setNewDisplayName('');
    loadUsers(usersPage);
  }

  async function handleToggleUserActive(u: AdminUserItem) {
    setBannerMsg(null);
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'toggle_active',
        userId: u.userId,
        isActive: !u.isActive,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setBannerMsg({ type: 'err', text: data.error || 'Failed to update account status' });
      return;
    }
    setBannerMsg({ type: 'ok', text: data.message });
    loadUsers(usersPage);
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetUserId) return;
    setBannerMsg(null);
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'reset_password',
        userId: resetUserId,
        temporaryPassword: resetPasswordVal,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setBannerMsg({ type: 'err', text: data.error || 'Failed to reset password' });
      return;
    }
    setBannerMsg({ type: 'ok', text: data.message });
    setResetUserId(null);
    loadUsers(usersPage);
  }

  async function handleToggleDocPublish(doc: AdminDocItem) {
    setBannerMsg(null);
    const res = await fetch('/api/admin/documents', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        docId: doc.docId,
        isPublished: !doc.isPublished,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setBannerMsg({ type: 'err', text: data.error || 'Failed to update publication status' });
      return;
    }
    setBannerMsg({ type: 'ok', text: data.message });
    loadDocs(docsPage, docsQuery);
  }

  async function handleCreateDocument(e: React.FormEvent) {
    e.preventDefault();
    setBannerMsg(null);
    const res = await fetch('/api/admin/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentNumber: docNumberInput,
        titleMl: docTitleMlInput,
        titleEn: docTitleEnInput,
        categorySlugs: [docCategoryInput],
        includeTextLayer: docHasTextInput,
        isPublished: true,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setBannerMsg({ type: 'err', text: data.error || 'Failed to import document' });
      return;
    }
    setBannerMsg({
      type: 'ok',
      text: data.deduplicated
        ? data.message
        : `Imported document ${data.document.docId} (${data.document.documentNumber}) into private storage.`,
    });
    setDocNumberInput('');
    setDocTitleMlInput('');
    setDocTitleEnInput('');
    loadDocs(1, docsQuery);
  }

  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault();
    setBannerMsg(null);
    const res = await fetch('/api/admin/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: catSlugInput,
        nameEn: catNameEnInput,
        nameMl: catNameMlInput,
        parentSlug: catParentInput || null,
        order: 15,
        isPublished: true,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setBannerMsg({ type: 'err', text: data.error || 'Failed to create category' });
      return;
    }
    setBannerMsg({ type: 'ok', text: `Created category "${data.pathLabel}".` });
    setCatSlugInput('');
    setCatNameEnInput('');
    setCatNameMlInput('');
    loadCategories();
  }

  async function handleRunMigration() {
    setRunningImport(true);
    setBannerMsg(null);
    try {
      const res = await fetch('/api/admin/import', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setBannerMsg({ type: 'err', text: data.error || 'Migration failed' });
      } else {
        setImportResult(data);
        setBannerMsg({
          type: 'ok',
          text: `Migration run ${data.runId} completed: ${data.documentsInserted} inserted, ${data.duplicatesSkipped} duplicates skipped.`,
        });
        loadDocs(docsPage, docsQuery);
      }
    } finally {
      setRunningImport(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Top Metrics Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-6">
        <div className="rounded-xl border border-mudra-200 bg-white p-4 shadow-sm">
          <span className="text-xs text-mudra-600">Reader &amp; Admin Accounts</span>
          <p className="mt-1 font-serif text-2xl font-bold text-mudra-950">{stats.totalUsers}</p>
          <span className="text-[11px] text-emerald-700 font-medium">
            {stats.activeReaders} Active Readers
          </span>
        </div>
        <div className="rounded-xl border border-mudra-200 bg-white p-4 shadow-sm">
          <span className="text-xs text-mudra-600">Total Indexed Documents</span>
          <p className="mt-1 font-serif text-2xl font-bold text-mudra-950">
            {stats.totalDocuments}
          </p>
          <span className="text-[11px] text-mudra-700">
            {stats.publishedDocuments} Published
          </span>
        </div>
        <div className="rounded-xl border border-mudra-200 bg-white p-4 shadow-sm">
          <span className="text-xs text-mudra-600">PDF Layer Breakdown</span>
          <p className="mt-1 font-serif text-2xl font-bold text-mudra-950">
            {stats.textPdfs} Text / {stats.scannedPdfs} Scanned
          </p>
          <span className="text-[11px] text-mudra-700">Private Object Storage</span>
        </div>
        <div className="rounded-xl border border-mudra-200 bg-white p-4 shadow-sm">
          <span className="text-xs text-mudra-600">Eaadharam Categories</span>
          <p className="mt-1 font-serif text-2xl font-bold text-mudra-950">
            {stats.totalCategories}
          </p>
          <span className="text-[11px] text-mudra-700">Multi-category linked</span>
        </div>
      </div>

      {/* Status Notification */}
      {bannerMsg && (
        <div
          className={`mb-6 rounded-xl border p-4 text-xs font-medium ${
            bannerMsg.type === 'ok'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
              : 'border-red-300 bg-red-50 text-red-900'
          }`}
        >
          {bannerMsg.text}
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="mb-6 flex flex-wrap gap-2 border-b border-mudra-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition ${
            activeTab === 'users'
              ? 'bg-mudra-800 text-white shadow'
              : 'bg-white text-mudra-800 border border-mudra-200 hover:bg-parchment-100'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Reader &amp; Admin Accounts ({usersTotal})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('documents')}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition ${
            activeTab === 'documents'
              ? 'bg-mudra-800 text-white shadow'
              : 'bg-white text-mudra-800 border border-mudra-200 hover:bg-parchment-100'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>Documents &amp; Publication ({docsTotal})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('categories')}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition ${
            activeTab === 'categories'
              ? 'bg-mudra-800 text-white shadow'
              : 'bg-white text-mudra-800 border border-mudra-200 hover:bg-parchment-100'
          }`}
        >
          <FolderTree className="h-4 w-4" />
          <span>Categories ({categoriesList.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('import')}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition ${
            activeTab === 'import'
              ? 'bg-mudra-800 text-white shadow'
              : 'bg-white text-mudra-800 border border-mudra-200 hover:bg-parchment-100'
          }`}
        >
          <RefreshCw className="h-4 w-4" />
          <span>Eaadharam Migration &amp; Dedup</span>
        </button>
      </div>

      {/* TAB 1: ACCOUNTS MANAGEMENT */}
      {activeTab === 'users' && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Create Account Form */}
          <div className="lg:col-span-4 rounded-2xl border border-mudra-200 bg-white p-6 shadow-sm self-start">
            <h2 className="flex items-center gap-2 font-serif text-base font-bold text-mudra-950 mb-1">
              <UserPlus className="h-4 w-4 text-mudra-700" />
              Create Subscriber Account
            </h2>
            <p className="text-xs text-mudra-600 mb-4">
              Public registration is disabled. Accounts created here require a password change on
              first login.
            </p>

            <form onSubmit={handleCreateUser} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-mudra-800 mb-1">
                  Login ID
                </label>
                <input
                  type="text"
                  required
                  value={newLoginId}
                  onChange={(e) => setNewLoginId(e.target.value)}
                  placeholder="e.g. sro.kozhikode"
                  className="w-full rounded-lg border border-mudra-300 bg-parchment-50 px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-mudra-800 mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  required
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  placeholder="e.g. Sub-Registrar Office Kozhikode"
                  className="w-full rounded-lg border border-mudra-300 bg-parchment-50 px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-mudra-800 mb-1">
                  Role
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as 'reader' | 'admin')}
                  className="w-full rounded-lg border border-mudra-300 bg-parchment-50 px-3 py-2 text-xs"
                >
                  <option value="reader">Reader (Browse, Search &amp; Read PDFs)</option>
                  <option value="admin">Admin (Manage Accounts, Imports &amp; Publication)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-mudra-800 mb-1">
                  Initial Temporary Password
                </label>
                <input
                  type="text"
                  required
                  value={newTempPassword}
                  onChange={(e) => setNewTempPassword(e.target.value)}
                  className="w-full rounded-lg border border-mudra-300 bg-parchment-50 px-3 py-2 text-xs font-mono"
                />
              </div>

              <button
                type="submit"
                className="w-full rounded-lg bg-mudra-800 px-4 py-2.5 text-xs font-bold text-white hover:bg-mudra-700 transition"
              >
                Create Account (Require First-Login Password Change)
              </button>
            </form>

            {resetUserId && (
              <form
                onSubmit={handleResetPassword}
                className="mt-6 border-t border-mudra-200 pt-4 space-y-3"
              >
                <h3 className="text-xs font-bold text-amber-900">
                  Issue Temporary Password Reset for <code>{resetLoginId}</code>
                </h3>
                <input
                  type="text"
                  required
                  value={resetPasswordVal}
                  onChange={(e) => setResetPasswordVal(e.target.value)}
                  className="w-full rounded-lg border border-amber-400 bg-amber-50 px-3 py-2 text-xs font-mono"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white"
                  >
                    Confirm Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => setResetUserId(null)}
                    className="rounded-lg border border-mudra-300 px-3 py-1.5 text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Paginated Accounts List */}
          <div className="lg:col-span-8 rounded-2xl border border-mudra-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-base font-bold text-mudra-950">
                Provisioned Accounts
              </h2>
              <span className="text-xs text-mudra-600">
                Page {usersPage} of {usersTotalPages} ({usersTotal} total)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-mudra-200 text-mudra-600 uppercase">
                    <th className="py-2.5 pr-3">Login ID</th>
                    <th className="py-2.5 px-3">Role</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Password Policy</th>
                    <th className="py-2.5 pl-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-mudra-100">
                  {usersList.map((u) => (
                    <tr key={u.userId}>
                      <td className="py-3 pr-3">
                        <div className="font-mono font-bold text-mudra-950">{u.loginId}</div>
                        <div className="text-[11px] text-mudra-600">{u.displayName}</div>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                            u.role === 'admin'
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-mudra-100 text-mudra-800'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        {u.isActive ? (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-900">
                            <CheckCircle2 className="h-3 w-3" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-900">
                            <Ban className="h-3 w-3" /> Deactivated (Sessions Revoked)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {u.mustChangePassword ? (
                          <span className="rounded bg-amber-50 border border-amber-300 px-2 py-0.5 text-[11px] text-amber-900">
                            Must Change on Login
                          </span>
                        ) : (
                          <span className="text-mudra-600">Personal Password Set</span>
                        )}
                      </td>
                      <td className="py-3 pl-3 text-right space-x-2">
                        <button
                          type="button"
                          onClick={() => {
                            setResetUserId(u.userId);
                            setResetLoginId(u.loginId);
                          }}
                          className="inline-flex items-center gap-1 rounded border border-mudra-300 px-2.5 py-1 text-[11px] font-semibold text-mudra-800 hover:bg-parchment-100"
                        >
                          <KeyRound className="h-3 w-3" /> Reset PW
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleUserActive(u)}
                          className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-[11px] font-semibold ${
                            u.isActive
                              ? 'bg-red-50 text-red-800 border border-red-200 hover:bg-red-100'
                              : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                          }`}
                        >
                          {u.isActive ? 'Deactivate' : 'Reactivate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DOCUMENTS & PUBLICATION */}
      {activeTab === 'documents' && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Import / Add Document Form */}
          <div className="lg:col-span-4 rounded-2xl border border-mudra-200 bg-white p-6 shadow-sm self-start">
            <h2 className="flex items-center gap-2 font-serif text-base font-bold text-mudra-950 mb-1">
              <PlusCircle className="h-4 w-4 text-mudra-700" />
              Import / Publish Document
            </h2>
            <p className="text-xs text-mudra-600 mb-4">
              Automatically normalizes document numbers, deduplicates by source ID &amp; SHA-256
              hash, and stores PDF in private storage under{' '}
              <code>documents/&lt;docId&gt;/v&lt;version&gt;/</code>.
            </p>

            <form onSubmit={handleCreateDocument} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-mudra-800 mb-1">
                  Document / Order Number
                </label>
                <input
                  type="text"
                  required
                  value={docNumberInput}
                  onChange={(e) => setDocNumberInput(e.target.value)}
                  placeholder="e.g. IGR/7210/2025-RR3"
                  className="w-full rounded-lg border border-mudra-300 bg-parchment-50 px-3 py-2 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-mudra-800 mb-1">
                  Malayalam Title (മലയാളം തലക്കെട്ട്)
                </label>
                <input
                  type="text"
                  required
                  value={docTitleMlInput}
                  onChange={(e) => setDocTitleMlInput(e.target.value)}
                  placeholder="e.g. തീറാധാരങ്ങളുടെ മുദ്രവില നിർണ്ണയം സംബന്ധിച്ച ഉത്തരവ്"
                  className="w-full rounded-lg border border-mudra-300 bg-parchment-50 px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-mudra-800 mb-1">
                  English Title
                </label>
                <input
                  type="text"
                  required
                  value={docTitleEnInput}
                  onChange={(e) => setDocTitleEnInput(e.target.value)}
                  placeholder="e.g. Stamp Duty Determination Order on Sale Deeds"
                  className="w-full rounded-lg border border-mudra-300 bg-parchment-50 px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-mudra-800 mb-1">
                  Primary Category
                </label>
                <select
                  value={docCategoryInput}
                  onChange={(e) => setDocCategoryInput(e.target.value)}
                  className="w-full rounded-lg border border-mudra-300 bg-parchment-50 px-3 py-2 text-xs"
                >
                  {categoriesList.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.pathLabel}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <input
                  id="includeTextLayer"
                  type="checkbox"
                  checked={docHasTextInput}
                  onChange={(e) => setDocHasTextInput(e.target.checked)}
                />
                <label htmlFor="includeTextLayer">
                  Include searchable PDF text layer (uncheck to simulate scanned PDF)
                </label>
              </div>

              <button
                type="submit"
                className="w-full rounded-lg bg-mudra-800 px-4 py-2.5 text-xs font-bold text-white hover:bg-mudra-700"
              >
                Import &amp; Publish Document
              </button>
            </form>
          </div>

          {/* Server-Side Paginated Documents List */}
          <div className="lg:col-span-8 rounded-2xl border border-mudra-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h2 className="font-serif text-base font-bold text-mudra-950">
                Library Catalogue ({docsTotal} records)
              </h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={docsQuery}
                  onChange={(e) => setDocsQuery(e.target.value)}
                  placeholder="Filter by order no. or title…"
                  className="rounded-lg border border-mudra-300 bg-parchment-50 px-3 py-1.5 text-xs"
                />
                <button
                  type="button"
                  onClick={() => loadDocs(1, docsQuery)}
                  className="rounded-lg bg-mudra-800 px-3 py-1.5 text-xs font-bold text-white"
                >
                  Filter
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {docsList.map((d) => (
                <div
                  key={d.docId}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-mudra-100 bg-parchment-50/60 p-3.5 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-bold text-mudra-950">
                        {d.documentNumber}
                      </span>
                      <span className="font-mono text-[10px] text-mudra-600">
                        ({d.docId} • Norm: {d.normalizedDocNumber})
                      </span>
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                          d.isPublished
                            ? 'bg-emerald-100 text-emerald-900'
                            : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        {d.isPublished ? 'Published' : 'Unpublished Draft'}
                      </span>
                    </div>
                    <p className="mt-1 font-medium text-mudra-900 truncate">
                      {d.titleMl || d.titleEn}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {d.categorySlugs.map((cs) => (
                        <span
                          key={cs}
                          className="rounded bg-white border border-mudra-200 px-1.5 py-0.5 text-[10px] text-mudra-700"
                        >
                          {cs}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      href={`/library/documents/${d.slug}`}
                      className="inline-flex items-center gap-1 rounded border border-mudra-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-mudra-800 hover:bg-parchment-100"
                    >
                      <ExternalLink className="h-3 w-3" /> Reader
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleToggleDocPublish(d)}
                      className={`inline-flex items-center gap-1 rounded px-2.5 py-1.5 text-[11px] font-semibold ${
                        d.isPublished
                          ? 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                          : 'bg-emerald-600 text-white hover:bg-emerald-500'
                      }`}
                    >
                      {d.isPublished ? (
                        <>
                          <EyeOff className="h-3 w-3" /> Unpublish
                        </>
                      ) : (
                        <>
                          <Eye className="h-3 w-3" /> Publish
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {docsTotalPages > 1 && (
              <div className="mt-5 flex items-center justify-between border-t border-mudra-100 pt-3 text-xs">
                <span>
                  Page {docsPage} of {docsTotalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={docsPage <= 1}
                    onClick={() => loadDocs(docsPage - 1, docsQuery)}
                    className="rounded border border-mudra-300 px-3 py-1 disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={docsPage >= docsTotalPages}
                    onClick={() => loadDocs(docsPage + 1, docsQuery)}
                    className="rounded bg-mudra-800 px-3 py-1 text-white disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: CATEGORIES MANAGEMENT */}
      {activeTab === 'categories' && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="lg:col-span-4 rounded-2xl border border-mudra-200 bg-white p-6 shadow-sm self-start">
            <h2 className="font-serif text-base font-bold text-mudra-950 mb-3">
              Create Category / Subcategory
            </h2>
            <form onSubmit={handleCreateCategory} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-mudra-800 mb-1">
                  Category Slug
                </label>
                <input
                  type="text"
                  required
                  value={catSlugInput}
                  onChange={(e) => setCatSlugInput(e.target.value)}
                  placeholder="e.g. lrc-orders-exchange"
                  className="w-full rounded-lg border border-mudra-300 bg-parchment-50 px-3 py-2 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-mudra-800 mb-1">
                  English Name
                </label>
                <input
                  type="text"
                  required
                  value={catNameEnInput}
                  onChange={(e) => setCatNameEnInput(e.target.value)}
                  placeholder="e.g. Exchange Deeds"
                  className="w-full rounded-lg border border-mudra-300 bg-parchment-50 px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-mudra-800 mb-1">
                  Malayalam Name
                </label>
                <input
                  type="text"
                  value={catNameMlInput}
                  onChange={(e) => setCatNameMlInput(e.target.value)}
                  placeholder="e.g. പരസ്പര കൈമാറ്റ ആധാരം"
                  className="w-full rounded-lg border border-mudra-300 bg-parchment-50 px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-mudra-800 mb-1">
                  Parent Category
                </label>
                <select
                  value={catParentInput}
                  onChange={(e) => setCatParentInput(e.target.value)}
                  className="w-full rounded-lg border border-mudra-300 bg-parchment-50 px-3 py-2 text-xs"
                >
                  <option value="">None (Top-Level Category)</option>
                  {categoriesList
                    .filter((c) => !c.parentSlug)
                    .map((c) => (
                      <option key={c.slug} value={c.slug}>
                        {c.nameEn}
                      </option>
                    ))}
                </select>
              </div>
              <button
                type="submit"
                className="w-full rounded-lg bg-mudra-800 px-4 py-2 text-xs font-bold text-white"
              >
                Save Category
              </button>
            </form>
          </div>

          <div className="lg:col-span-8 rounded-2xl border border-mudra-200 bg-white p-6 shadow-sm">
            <h2 className="font-serif text-base font-bold text-mudra-950 mb-4">
              Category Hierarchy
            </h2>
            <div className="divide-y divide-mudra-100 text-xs">
              {categoriesList.map((c) => (
                <div key={c.slug} className="py-2.5 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-mudra-950">{c.pathLabel}</span>
                    {c.nameMl && <span className="ml-2 text-mudra-600">({c.nameMl})</span>}
                    <span className="ml-2 font-mono text-[10px] text-mudra-500">[{c.slug}]</span>
                  </div>
                  <Link
                    href={`/library/categories/${c.slug}`}
                    className="text-mudra-800 hover:underline font-medium"
                  >
                    Browse →
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: EAADHARAM MIGRATION & DEDUP */}
      {activeTab === 'import' && (
        <div className="rounded-2xl border border-mudra-200 bg-white p-6 shadow-sm">
          <h2 className="font-serif text-lg font-bold text-mudra-950">
            Eaadharam Source Inventory &amp; Repeat-Import Deduplication
          </h2>
          <p className="mt-1 text-xs text-mudra-700 max-w-3xl">
            Triggering a repeat import runs the Eaadharam migration script against{' '}
            <code>https://www.eaadharam.in/2020/07/home-eaadharam_5.html</code>. Existing records
            are matched by <code>sourceId</code>, <code>normalizedDocNumber</code>, and SHA-256{' '}
            <code>latestFileHash</code> so repeat imports never create duplicate records or
            duplicate files.
          </p>

          <div className="mt-5">
            <button
              type="button"
              onClick={handleRunMigration}
              disabled={runningImport}
              className="inline-flex items-center gap-2 rounded-xl bg-mudra-800 px-5 py-3 text-xs font-bold text-white hover:bg-mudra-700 disabled:opacity-50"
            >
              {runningImport ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Running Eaadharam Migration &amp; Deduplication Check…</span>
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  <span>Run Eaadharam Migration Now</span>
                </>
              )}
            </button>
          </div>

          {importResult && (
            <div className="mt-6 rounded-xl border border-mudra-200 bg-parchment-50 p-4 text-xs space-y-1.5">
              <div className="font-bold text-mudra-950">
                Run ID: <code>{importResult.runId}</code>
              </div>
              <div>Categories Processed: {importResult.categoriesProcessed}</div>
              <div>Documents Inspected: {importResult.documentsInspected}</div>
              <div>New Documents Inserted: {importResult.documentsInserted}</div>
              <div>Multi-Category Merges: {importResult.documentsUpdatedCategory}</div>
              <div className="font-semibold text-emerald-800">
                Duplicates Detected &amp; Skipped: {importResult.duplicatesSkipped}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
