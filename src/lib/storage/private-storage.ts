import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * Private Object Storage Service
 *
 * Stores PDFs and generated thumbnails in a private root outside Next.js `public/`
 * directory (or an S3-compatible bucket when configured).
 *
 * Storage keys are strictly grouped by immutable document ID (`docId`) and file version (`version`):
 *   `documents/${docId}/v${version}/document.pdf`
 *   `documents/${docId}/v${version}/thumbnail.svg`
 */

const PRIVATE_STORAGE_ROOT = path.resolve(
  process.cwd(),
  process.env.PRIVATE_STORAGE_ROOT || './private_storage'
);

// Hoist static logo read to module level (per Vercel React Best Practice `server-hoist-static-io`)
let cachedLogoDataUri: string | null = null;
function getOfficialLogoDataUri(): string | null {
  if (cachedLogoDataUri !== null) return cachedLogoDataUri;
  const candidates = [
    path.resolve(process.cwd(), 'public/mudrapublications_logo.jpeg'),
    path.resolve(process.cwd(), 'mudrapublications_logo.jpeg'),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const b64 = fs.readFileSync(p).toString('base64');
        cachedLogoDataUri = `data:image/jpeg;base64,${b64}`;
        return cachedLogoDataUri;
      }
    } catch {
      // ignore
    }
  }
  return null;
}

export function getPrivateStorageRoot(): string {
  if (!fs.existsSync(PRIVATE_STORAGE_ROOT)) {
    fs.mkdirSync(PRIVATE_STORAGE_ROOT, { recursive: true });
  }
  return PRIVATE_STORAGE_ROOT;
}

export function buildDocumentStorageKey(docId: string, version: number): string {
  const safeDocId = docId.replace(/[^a-zA-Z0-9_-]/g, '');
  const safeVersion = Math.max(1, Math.floor(version));
  return `documents/${safeDocId}/v${safeVersion}/document.pdf`;
}

export function buildThumbnailStorageKey(docId: string, version: number): string {
  const safeDocId = docId.replace(/[^a-zA-Z0-9_-]/g, '');
  const safeVersion = Math.max(1, Math.floor(version));
  return `documents/${safeDocId}/v${safeVersion}/thumbnail.svg`;
}

export function resolveStoragePath(storageKey: string): string {
  const root = getPrivateStorageRoot();
  const normalizedKey = path.normalize(storageKey).replace(/^(\.\.(\/|\\|$))+/, '');
  const fullPath = path.resolve(root, normalizedKey);
  if (!fullPath.startsWith(root)) {
    throw new Error('Invalid storage key traversal attempt blocked');
  }
  return fullPath;
}

export async function putPrivateObject(
  storageKey: string,
  buffer: Buffer
): Promise<{ storageKey: string; fileSize: number; fileHash: string }> {
  const fullPath = resolveStoragePath(storageKey);
  const dir = path.dirname(fullPath);
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(fullPath, buffer);

  const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');
  return {
    storageKey,
    fileSize: buffer.byteLength,
    fileHash,
  };
}

export async function privateObjectExists(storageKey: string): Promise<boolean> {
  try {
    const fullPath = resolveStoragePath(storageKey);
    await fs.promises.access(fullPath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

export async function getPrivateObjectStat(
  storageKey: string
): Promise<{ size: number; mtime: Date } | null> {
  try {
    const fullPath = resolveStoragePath(storageKey);
    const stat = await fs.promises.stat(fullPath);
    if (!stat.isFile()) return null;
    return { size: stat.size, mtime: stat.mtime };
  } catch {
    return null;
  }
}

export async function readPrivateObjectSlice(
  storageKey: string,
  start: number,
  end: number
): Promise<Buffer> {
  const fullPath = resolveStoragePath(storageKey);
  const length = end - start + 1;
  const handle = await fs.promises.open(fullPath, 'r');
  try {
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buffer, 0, length, start);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

export async function readPrivateObjectFull(storageKey: string): Promise<Buffer> {
  const fullPath = resolveStoragePath(storageKey);
  return fs.promises.readFile(fullPath);
}

/**
 * Generates a Mudra-branded SVG cover thumbnail embedding the official Mudra Publications logo.
 */
export function generateMudraCoverSvg(params: {
  documentNumber: string;
  titleMl: string;
  titleEn: string;
  categoryLabel: string;
  year: number | null;
  pageCount: number;
  hasTextLayer: boolean;
}): Buffer {
  const esc = (s: string) =>
    (s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const docNo = esc(params.documentNumber.slice(0, 34));
  const cat = esc(params.categoryLabel.slice(0, 38));
  const title1 = esc((params.titleMl || params.titleEn).slice(0, 38));
  const title2 = esc((params.titleMl || params.titleEn).slice(38, 76));
  const title3 = esc(params.titleEn.slice(0, 44));
  const badge = params.hasTextLayer ? 'TEXT LAYER PDF' : 'SCANNED ARCHIVE PDF';
  const yearStr = params.year ? String(params.year) : 'ARCHIVE';
  const logoUri = getOfficialLogoDataUri();

  const logoElement = logoUri
    ? `<clipPath id="logoClip"><circle cx="42" cy="40" r="22"/></clipPath>
       <circle cx="42" cy="40" r="23" fill="#0b192c" stroke="#f59e0b" stroke-width="2"/>
       <image href="${logoUri}" x="20" y="18" width="44" height="44" clip-path="url(#logoClip)" preserveAspectRatio="xMidYMid slice"/>`
    : `<circle cx="42" cy="40" r="22" fill="#0b192c" stroke="#f59e0b" stroke-width="2"/>`;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 480" width="360" height="480">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fbfaf6"/>
      <stop offset="100%" stop-color="#f4dac1"/>
    </linearGradient>
    <linearGradient id="hdr" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#0b192c"/>
      <stop offset="100%" stop-color="#1b3358"/>
    </linearGradient>
  </defs>
  <rect width="360" height="480" rx="12" fill="url(#bg)" stroke="#cd6836" stroke-width="3"/>
  <rect x="16" y="16" width="328" height="448" rx="8" fill="none" stroke="#db8044" stroke-width="1" stroke-dasharray="4 3"/>
  <rect x="0" y="0" width="360" height="80" rx="12" fill="url(#hdr)"/>
  <rect x="0" y="64" width="360" height="16" fill="url(#hdr)"/>
  ${logoElement}
  <text x="74" y="36" fill="#ffffff" font-family="Georgia, serif" font-size="13" font-weight="bold" letter-spacing="1.2">MUDRA PUBLICATIONS</text>
  <text x="74" y="56" fill="#f59e0b" font-family="sans-serif" font-size="10.5">${cat}</text>
  <rect x="282" y="25" width="56" height="24" rx="4" fill="#132743" stroke="#f59e0b" stroke-width="1"/>
  <text x="310" y="41" fill="#f59e0b" font-family="monospace" font-size="11" font-weight="bold" text-anchor="middle">${esc(yearStr)}</text>

  <rect x="24" y="96" width="312" height="46" rx="6" fill="#ffffff" stroke="#e29c66" stroke-width="1.5"/>
  <text x="36" y="114" fill="#89422b" font-family="sans-serif" font-size="10" font-weight="bold">DOCUMENT NUMBER</text>
  <text x="36" y="132" fill="#0b192c" font-family="monospace" font-size="13" font-weight="bold">${docNo}</text>

  <line x1="24" y1="162" x2="336" y2="162" stroke="#e29c66" stroke-width="1"/>
  <text x="24" y="196" fill="#0b192c" font-family="sans-serif" font-size="15" font-weight="bold">${title1}</text>
  <text x="24" y="222" fill="#0b192c" font-family="sans-serif" font-size="14">${title2}</text>
  <text x="24" y="264" fill="#6f3825" font-family="Georgia, serif" font-size="12" font-style="italic">${title3}</text>

  <g transform="translate(24, 300)">
    <rect width="312" height="86" rx="6" fill="#faeee2" opacity="0.7"/>
    <line x1="16" y1="22" x2="296" y2="22" stroke="#d6b89c" stroke-width="2"/>
    <line x1="16" y1="40" x2="270" y2="40" stroke="#d6b89c" stroke-width="2"/>
    <line x1="16" y1="58" x2="284" y2="58" stroke="#d6b89c" stroke-width="2"/>
    <line x1="16" y1="72" x2="190" y2="72" stroke="#d6b89c" stroke-width="2"/>
  </g>

  <rect x="24" y="414" width="165" height="28" rx="5" fill="#0b192c"/>
  <text x="106" y="432" fill="#f59e0b" font-family="sans-serif" font-size="10" font-weight="bold" text-anchor="middle">${badge}</text>

  <rect x="250" y="414" width="86" height="28" rx="5" fill="#faeee2" stroke="#cd6836" stroke-width="1"/>
  <text x="293" y="432" fill="#0b192c" font-family="sans-serif" font-size="11" font-weight="bold" text-anchor="middle">${params.pageCount} ${params.pageCount === 1 ? 'Page' : 'Pages'}</text>
</svg>`;

  return Buffer.from(svg, 'utf-8');
}
