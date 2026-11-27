import { ObjectId } from 'mongodb';

export type UserRole = 'reader' | 'admin';

export interface UserDocument {
  _id?: ObjectId;
  loginId: string; // lowercased unique login ID
  displayName: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
  sessionVersion: number; // incremented on password reset or deactivation
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  createdBy?: string;
}

export interface SessionDocument {
  _id?: ObjectId;
  tokenHash: string;
  userId: ObjectId;
  loginId: string;
  role: UserRole;
  sessionVersion: number;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
  expiresAt: Date;
  revokedAt?: Date;
}

export interface RateLimitDocument {
  _id?: ObjectId;
  key: string; // e.g., "login:ip:127.0.0.1" or "login:id:reader.kerala"
  attempts: number;
  firstAttemptAt: Date;
  lockedUntil?: Date;
  updatedAt: Date;
}

export interface CategoryDocument {
  _id?: ObjectId;
  slug: string; // unique e.g. "lrc-orders-sale"
  nameEn: string;
  nameMl?: string;
  description?: string;
  parentSlug: string | null; // null for top-level e.g. "lrc-orders"
  ancestors: string[]; // e.g. ["lrc-orders"]
  pathLabel: string; // e.g. "LRC Orders → Sale"
  order: number;
  sourceUrl?: string;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentFileVersion {
  version: number;
  storageKey: string; // documents/<docId>/v<version>/document.pdf
  thumbnailKey?: string; // documents/<docId>/v<version>/thumb.svg
  fileHash: string; // SHA-256 hex
  fileSize: number;
  mimeType: string;
  pageCount: number;
  hasTextLayer: boolean;
  uploadedAt: Date;
  uploadedBy: string;
}

export interface LibraryDocument {
  _id?: ObjectId;
  docId: string; // Immutable public/internal UUID or short ID e.g. "DOC-2025-0001"
  slug: string; // Unique URL slug e.g. "igr-5897-2024-rr2-2025"
  documentNumber: string; // Original document number e.g. "IGR/5897/2024-RR2"
  normalizedDocNumber: string; // Strict alphanumeric uppercase: "IGR58972024RR2"
  spacedDocNumber: string; // Tokenized uppercase: "IGR 5897 2024 RR2"
  titleEn: string;
  titleMl: string;
  summaryEn: string;
  summaryMl: string;
  keywords: string[];
  categorySlugs: string[]; // Supports multiple categories & subcategories while keeping 1 record
  primaryCategorySlug: string;
  documentDate?: Date | null;
  documentDateText?: string;
  year: number | null;
  extractedText: string; // PDF text layer if available
  hasTextLayer: boolean; // True for text PDFs, false for scanned image PDFs
  isScanned: boolean;
  currentVersion: number;
  versions: DocumentFileVersion[];
  // Deduplication fields at top level for fast indexed lookup
  sourceId: string; // e.g. "gdrive:1O4svhKUNJ6IQRisopgIhDipXdMHmogz0" or "manual:<hash>"
  sourceUrl?: string;
  sourcePageUrl?: string;
  latestFileHash: string; // SHA-256 of current version PDF
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ImportLogDocument {
  _id?: ObjectId;
  runId: string;
  startedAt: Date;
  completedAt?: Date;
  sourceSite: string;
  categoriesProcessed: number;
  documentsInspected: number;
  documentsInserted: number;
  documentsUpdatedCategory: number;
  duplicatesSkipped: number;
  textPdfsCount: number;
  scannedPdfsCount: number;
  failures: Array<{ sourceId: string; reason: string }>;
  details: Array<{
    docId: string;
    documentNumber: string;
    titleMl: string;
    categorySlugs: string[];
    action: 'inserted' | 'merged_category' | 'skipped_duplicate' | 'failed';
    hasTextLayer: boolean;
    fileSize: number;
    fileHash: string;
  }>;
}

// ============================================================================
// MUDRA QUIZ MODULE TYPES
// ============================================================================

export type QuizStatus = 'draft' | 'published' | 'archived';
export type QuizQuestionType = 'single_choice' | 'true_false';
export type QuizPlayMode = 'auto_live' | 'host_live' | 'self_paced';
export type QuizRoomStatus = 'lobby' | 'question_open' | 'question_revealed' | 'completed';

export interface QuizOptionItem {
  optionId: string; // Stable option ID across Malayalam and English translations ('A', 'B', 'C', 'D' or 'TRUE', 'FALSE')
  textEn: string;
  textMl: string;
}

export interface LinkedDocumentRef {
  docId: string;
  slug: string;
  documentNumber: string;
  titleEn: string;
  titleMl: string;
}

export interface QuizQuestionItem {
  questionId: string;
  order: number;
  type: QuizQuestionType;
  sectionEn?: string;
  sectionMl?: string;
  reference?: string;
  promptEn: string;
  promptMl: string;
  options: QuizOptionItem[];
  correctOptionId: string; // Matches one of options[].optionId
  explanationEn?: string;
  explanationMl?: string;
  timeLimitSeconds: number; // Per-question answer time (defaults to quiz.defaultTimeSeconds)
  linkedDocId?: string | null; // Optional link to an existing Mudra PDF
  linkedDocSnapshot?: LinkedDocumentRef | null;
}

export interface QuizScoringRules {
  basePoints: number; // Default 1000
  speedBonusMax: number; // Default 500 (linearly decreasing across question duration)
  speedBonusEnabled: boolean; // Editable per quiz/session
  streakBonusPoints: number; // Default 100
  streakThreshold: number; // Default 3 (3rd consecutive correct answer onward)
  streakBonusEnabled: boolean; // Editable per quiz/session
}

export interface QuizDocument {
  _id?: ObjectId;
  quizId: string; // e.g., "QUIZ-2026-0001"
  slug: string; // e.g., "kerala-registration-stamp-act-mastery"
  categorySlug?: string; // e.g., "aadharam-ezhuthu-exam"
  categoryNameEn?: string; // e.g., "Aadharam Ezhuthu Exam (Deed Writing)"
  categoryNameMl?: string; // e.g., "ആധാരമെഴുത്ത് പരീക്ഷ"
  topicEn?: string; // e.g., "Registration Act, 1908"
  topicMl?: string; // e.g., "രജിസ്ട്രേഷൻ നിയമം, 1908"
  titleEn: string;
  titleMl: string;
  descriptionEn?: string;
  descriptionMl?: string;
  status: QuizStatus;
  defaultTimeSeconds: number; // Quiz-level default timer (e.g. 20s)
  defaultRevealSeconds: number; // Default reveal duration for automatic live mode (e.g. 6s)
  scoringRules: QuizScoringRules;
  enabledModes: QuizPlayMode[];
  questions: QuizQuestionItem[];
  currentVersion: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuizVersionDocument {
  _id?: ObjectId;
  versionId: string; // e.g., "QUIZ-2026-0001-v1"
  quizId: string;
  version: number;
  categorySlug?: string;
  categoryNameEn?: string;
  categoryNameMl?: string;
  topicEn?: string;
  topicMl?: string;
  titleEn: string;
  titleMl: string;
  descriptionEn?: string;
  descriptionMl?: string;
  defaultTimeSeconds: number;
  defaultRevealSeconds: number;
  scoringRules: QuizScoringRules;
  questions: QuizQuestionItem[];
  createdAt: Date;
}

export interface QuizRoomDocument {
  _id?: ObjectId;
  roomId: string;
  roomCode: string; // Unique 6-character alphanumeric code e.g. "MUD207"
  quizId: string;
  versionId: string;
  version: number;
  mode: 'auto_live' | 'host_live';
  status: QuizRoomStatus;
  hostUserId: string;
  hostLoginId: string;
  capacity: number; // Configurable room capacity (supports 100+ concurrent players)
  joinLocked: boolean;
  revealDurationSeconds: number; // Configurable reveal duration in auto_live mode
  scoringRules: QuizScoringRules;
  currentQuestionIndex: number; // -1 in lobby, 0..N-1 during play
  questionOpenedAt?: Date | null;
  questionDeadlineAt?: Date | null;
  revealStartedAt?: Date | null;
  revealEndsAt?: Date | null;
  transitionVersion: number; // Optimistic concurrency lock protecting transitions against duplicate execution
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date | null;
}

export interface QuizParticipantDocument {
  _id?: ObjectId;
  participantId: string;
  participantToken: string; // Secret reconnection token for browser/session storage
  roomCode: string;
  roomId: string;
  quizId: string;
  versionId: string;
  userId?: string | null; // Linked reader/admin userId if signed in
  loginId?: string | null;
  displayName: string;
  isGuest: boolean;
  preferredLanguage: 'en' | 'ml';
  removed: boolean;
  totalPoints: number;
  correctCount: number;
  answeredCount: number;
  cumulativeCorrectTimeMs: number; // Tie-breaker: lowest cumulative response time across correct answers
  currentStreak: number;
  maxStreak: number;
  joinedAt: Date;
  lastSeenAt: Date;
}

export interface QuizSubmissionDocument {
  _id?: ObjectId;
  submissionId: string;
  roomCode: string; // Or attemptId for self-paced
  sessionType: 'live' | 'self_paced';
  quizId: string;
  versionId: string;
  participantId: string;
  userId?: string | null;
  questionIndex: number;
  questionId: string;
  selectedOptionId: string;
  isCorrect: boolean;
  responseTimeMs: number;
  basePointsEarned: number;
  speedBonusEarned: number;
  streakBonusEarned: number;
  totalPointsEarned: number;
  streakAfterAnswer: number;
  submittedAt: Date;
}

export interface SelfPacedAttemptAnswer {
  questionIndex: number;
  questionId: string;
  selectedOptionId: string;
  isCorrect: boolean;
  responseTimeMs: number;
  basePointsEarned: number;
  speedBonusEarned: number;
  streakBonusEarned: number;
  totalPointsEarned: number;
  streakAfterAnswer: number;
  questionStartedAt: Date;
  submittedAt: Date;
}

export interface QuizAttemptDocument {
  _id?: ObjectId;
  attemptId: string;
  attemptToken: string; // Allows guest or signed-in reader to view/resume their own attempt
  mode: QuizPlayMode; // 'self_paced' or finalized record of 'auto_live' / 'host_live'
  roomCode?: string | null;
  participantId?: string | null;
  quizId: string;
  versionId: string;
  version: number;
  quizTitleEn: string;
  quizTitleMl: string;
  userId?: string | null;
  loginId?: string | null;
  displayName: string;
  isGuest: boolean;
  preferredLanguage: 'en' | 'ml';
  status: 'in_progress' | 'completed';
  scoringRules: QuizScoringRules;
  currentQuestionIndex: number;
  currentQuestionStartedAt: Date;
  totalQuestions: number;
  totalPoints: number;
  correctCount: number;
  answeredCount: number;
  accuracyPercent: number;
  cumulativeCorrectTimeMs: number;
  currentStreak: number;
  maxStreak: number;
  rank?: number | null;
  totalParticipantsInRoom?: number | null;
  answers: SelfPacedAttemptAnswer[];
  startedAt: Date;
  completedAt?: Date | null;
}
