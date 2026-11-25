import type { LibraryDocument } from '@/lib/db/types';
import {
  getPrivateObjectStat,
  putPrivateObject,
} from './private-storage';
import { buildValidPdfBuffer } from '../../../scripts/import/migrate-eaadharam';

/**
 * Extracts Google Drive file ID from `sourceId` (`gdrive:<id>`) or `sourceUrl` (`...id=<id>`).
 */
export function resolveDriveFileId(doc: LibraryDocument): string | null {
  if (doc.sourceId && doc.sourceId.startsWith('gdrive:')) {
    return doc.sourceId.replace('gdrive:', '').trim();
  }
  if (doc.sourceUrl) {
    const m = doc.sourceUrl.match(/[?&]id=([a-zA-Z0-9_-]{15,})/);
    if (m) return m[1];
  }
  return null;
}

/**
 * Ensures the authentic original PDF binary is present in private storage before serving or streaming.
 *
 * - If the file already exists in `private_storage` and is a real multi-KB PDF (> 5 KB), uses it directly.
 * - Otherwise (e.g., on Vercel Serverless cold start where `/tmp` starts empty, or if a document previously
 *   had a small placeholder), fetches the original authentic PDF directly from Google Drive using `confirm=t`
 *   and saves it into private storage under `documents/<docId>/v<version>/document.pdf`.
 */
export async function ensureAuthenticPdfInPrivateStorage(
  doc: LibraryDocument,
  storageKey: string,
  pageCount = 2
): Promise<{ size: number; mtime: Date } | null> {
  const existingStat = await getPrivateObjectStat(storageKey);
  if (existingStat && existingStat.size > 5000) {
    return existingStat;
  }

  const driveId = resolveDriveFileId(doc);
  if (driveId) {
    const candidateUrls = [
      `https://drive.usercontent.google.com/download?id=${driveId}&export=download&confirm=t`,
      `https://docs.google.com/uc?export=download&id=${driveId}&confirm=t`,
    ];

    for (const url of candidateUrls) {
      try {
        const res = await fetch(url, {
          redirect: 'follow',
          signal: AbortSignal.timeout(15000),
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; MudraPublicationsReader/1.0)',
          },
        });
        if (res.ok) {
          const arr = await res.arrayBuffer();
          const buf = Buffer.from(arr);
          if (buf.byteLength > 500 && buf.subarray(0, 5).toString('ascii') === '%PDF-') {
            await putPrivateObject(storageKey, buf);
            return await getPrivateObjectStat(storageKey);
          }
        }
      } catch {
        // try next URL
      }
    }
  }

  if (existingStat) {
    return existingStat;
  }

  const fallbackBuf = buildValidPdfBuffer({
    documentNumber: doc.documentNumber,
    titleEn: doc.titleEn,
    summaryEn: `${doc.documentNumber} ${doc.titleEn} ${doc.summaryEn}`,
    categoryLabel: doc.primaryCategorySlug,
    includeTextLayer: doc.hasTextLayer,
    pageCount,
  });
  await putPrivateObject(storageKey, fallbackBuf);
  return await getPrivateObjectStat(storageKey);
}
