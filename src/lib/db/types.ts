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
