/**
 * Document Number & Malayalam/English Text Normalization Utilities
 *
 * Ensures variants like:
 * - "IGR/5897/2024-RR2"
 * - "IGR 5897 2024 RR2"
 * - "igr-5897-2024/rr2"
 * - "No.RR.2-6164/2021" vs "RR2 6164 2021"
 * resolve to the same normalized lookup representation and rank exact matches first.
 */

export function normalizeDocNumber(raw: string): {
  original: string;
  normalized: string;
  spaced: string;
  coreNormalized: string;
} {
  const original = (raw || '').trim();
  // Remove leading "No." or "No:" if present for core comparison, while keeping full tokens
  const withoutPrefix = original.replace(/^(no\.?|order\s*no\.?)\s*[:.-]?\s*/i, '').trim();

  // Replace all non-alphanumeric Unicode/ASCII separators with a single space
  const spaced = withoutPrefix
    .toUpperCase()
    .replace(/[^A-Z0-9\u0D00-\u0D7F]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

  // Strict alphanumeric concatenation: "IGR/5897/2024-RR2" === "IGR 5897 2024 RR2" -> "IGR58972024RR2"
  const normalized = spaced.replace(/\s+/g, '');

  // Also strip leading "NO" if someone typed "No. IGR/5897/2024-RR2"
  const coreNormalized = normalized.replace(/^NO/, '');

  return {
    original,
    normalized,
    spaced,
    coreNormalized,
  };
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
