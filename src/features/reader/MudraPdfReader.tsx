'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Download,
  Maximize2,
  FileText,
  ScanLine,
  RotateCw,
  ShieldCheck,
  Loader2,
  Smartphone,
} from 'lucide-react';

interface MudraPdfReaderProps {
  docId: string;
  slug: string;
  documentNumber: string;
  titleMl: string;
  titleEn: string;
  hasTextLayer: boolean;
  initialPageCount: number;
  currentVersion: number;
}

/**
 * Mudra-Branded PDF.js Reader Component (Mobile App & Desktop Optimized)
 *
 * - Displays the official Mudra Publications circular emblem in the reader app bar.
 * - Streams PDF progressively via the authenticated byte-range endpoint `/api/documents/[docId]/pdf`
 *   using `rangeChunkSize: 65536` and `withCredentials: true`.
 * - Responsive mobile & desktop canvas rendering with devicePixelRatio sharpness.
 * - Supports mobile swipe left/right gestures, Fit-Width button, zoom controls, rotation, and authenticated download.
 * - Gracefully informs the reader when viewing a scanned archival PDF (`hasTextLayer: false`).
 */
export default function MudraPdfReader({
  docId,
  documentNumber,
  titleMl,
  titleEn,
  hasTextLayer,
  initialPageCount,
  currentVersion,
}: MudraPdfReaderProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfDocRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderTaskRef = useRef<any>(null);

  const [numPages, setNumPages] = useState<number>(initialPageCount || 1);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.2);
  const [fitToWidth, setFitToWidth] = useState<boolean>(true);
  const [rotation, setRotation] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [renderingPage, setRenderingPage] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [byteRangeVerified, setByteRangeVerified] = useState<boolean>(false);

  const pdfEndpointUrl = `/api/documents/${encodeURIComponent(docId)}/pdf?v=${currentVersion}`;
  const downloadEndpointUrl = `/api/documents/${encodeURIComponent(docId)}/download`;

  const renderPage = useCallback(
    async (pageNum: number, targetScale: number, targetRotation: number, useFitWidth: boolean) => {
      const pdfDoc = pdfDocRef.current;
      const canvas = canvasRef.current;
      if (!pdfDoc || !canvas) return;

      try {
        setRenderingPage(true);
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch {
            // ignore cancellation
          }
        }

        const page = await pdfDoc.getPage(pageNum);

        let effectiveScale = targetScale;
        if (containerRef.current) {
          const containerWidth = containerRef.current.clientWidth - 24;
          const unscaledViewport = page.getViewport({ scale: 1, rotation: targetRotation });
          if (
            useFitWidth ||
            (containerWidth > 200 && containerWidth < unscaledViewport.width * targetScale)
          ) {
            effectiveScale = Math.min(
              1.6,
              Math.max(0.55, containerWidth / unscaledViewport.width)
            );
          }
        }

        const viewport = page.getViewport({ scale: effectiveScale, rotation: targetRotation });
        const dpr = typeof window !== 'undefined' ? Math.min(2.5, window.devicePixelRatio || 1) : 1;

        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const renderTask = page.render({
          canvasContext: ctx,
          viewport,
        });
        renderTaskRef.current = renderTask;
        await renderTask.promise;
      } catch (err) {
        const msg = (err as Error)?.name;
        if (msg !== 'RenderingCancelledException') {
          console.warn('PDF page render warning:', err);
        }
      } finally {
        setRenderingPage(false);
      }
    },
    []
  );

  useEffect(() => {
    let active = true;

    async function loadPdf() {
      setLoading(true);
      setError(null);

      try {
        const rangeProbe = await fetch(pdfEndpointUrl, {
          headers: { Range: 'bytes=0-1023' },
          credentials: 'same-origin',
          cache: 'no-store',
        });

        if (rangeProbe.status === 401 || rangeProbe.status === 403) {
          throw new Error('Your session has expired or lacks permission to view this document.');
        }

        if (rangeProbe.status === 206) {
          setByteRangeVerified(true);
        }

        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

        const loadingTask = pdfjsLib.getDocument({
          url: pdfEndpointUrl,
          withCredentials: true,
          rangeChunkSize: 65536,
          disableAutoFetch: false,
          disableStream: false,
        });

        const pdfDoc = await loadingTask.promise;
        if (!active) return;

        pdfDocRef.current = pdfDoc;
        setNumPages(pdfDoc.numPages || 1);
        setPageNumber(1);
        setLoading(false);
        await renderPage(1, scale, rotation, fitToWidth);
      } catch (err) {
        if (!active) return;
        setError((err as Error).message || 'Could not load PDF document.');
        setLoading(false);
      }
    }

    loadPdf();

    return () => {
      active = false;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfEndpointUrl]);

  useEffect(() => {
    if (!loading && pdfDocRef.current) {
      renderPage(pageNumber, scale, rotation, fitToWidth);
    }
  }, [pageNumber, scale, rotation, fitToWidth, loading, renderPage]);

  // Passive window resize listener for responsive mobile rotation
  useEffect(() => {
    const onResize = () => {
      if (!loading && pdfDocRef.current && fitToWidth) {
        renderPage(pageNumber, scale, rotation, true);
      }
    };
    window.addEventListener('resize', onResize, { passive: true });
    return () => window.removeEventListener('resize', onResize);
  }, [loading, pageNumber, scale, rotation, fitToWidth, renderPage]);

  const handleFullscreen = () => {
    if (containerRef.current && containerRef.current.requestFullscreen) {
      containerRef.current.requestFullscreen().catch(() => {});
    }
  };

  // Touch swipe left / right page turning for mobile app feel
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartXRef.current = e.touches[0].clientX;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || e.changedTouches.length === 0) return;
    const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
    touchStartXRef.current = null;
    if (Math.abs(deltaX) > 65) {
      if (deltaX < 0 && pageNumber < numPages) {
        setPageNumber((p) => Math.min(numPages, p + 1));
      } else if (deltaX > 0 && pageNumber > 1) {
        setPageNumber((p) => Math.max(1, p - 1));
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className="flex flex-col rounded-2xl border-2 border-mudra-800/30 bg-[#0b192c] text-parchment-50 shadow-2xl overflow-hidden"
      data-testid="mudra-pdf-reader"
    >
      {/* Top Mudra-Branded Reader Toolbar with Official Mudra Publications Emblem */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-[#0b192c] via-[#132743] to-[#0b192c] px-3.5 sm:px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[#0b192c] ring-2 ring-amber-400/80 shadow">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/mudrapublications_logo.jpeg"
              alt="Mudra Publications Official Logo"
              width={40}
              height={40}
              className="h-full w-full object-cover scale-105"
            />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                Mudra Archival Reader
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950/90 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                <ShieldCheck className="h-3 w-3" />
                {byteRangeVerified ? 'Byte-Range 206' : 'Private Stream'}
              </span>
            </div>
            <p className="truncate text-xs sm:text-sm font-medium text-parchment-100" title={titleMl || titleEn}>
              {documentNumber} — {titleMl || titleEn}
            </p>
          </div>
        </div>

        {/* Page & Zoom Controls */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 w-full sm:w-auto justify-between sm:justify-end">
          {/* Page Navigation */}
          <div className="flex items-center rounded-xl bg-black/30 border border-white/15 px-1.5 py-1">
            <button
              type="button"
              onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
              disabled={pageNumber <= 1 || loading}
              className="p-1.5 text-parchment-200 hover:text-amber-300 disabled:opacity-40 active:scale-90"
              aria-label="Previous Page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2 text-xs font-mono text-parchment-100">
              <strong>{pageNumber}</strong> / {numPages}
            </span>
            <button
              type="button"
              onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
              disabled={pageNumber >= numPages || loading}
              className="p-1.5 text-parchment-200 hover:text-amber-300 disabled:opacity-40 active:scale-90"
              aria-label="Next Page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Zoom & Fit Width Controls */}
          <div className="flex items-center rounded-xl bg-black/30 border border-white/15 px-1.5 py-1">
            <button
              type="button"
              onClick={() => {
                setFitToWidth(false);
                setScale((s) => Math.max(0.6, Number((s - 0.2).toFixed(2))));
              }}
              disabled={loading}
              className="p-1.5 text-parchment-200 hover:text-amber-300 active:scale-90"
              aria-label="Zoom Out"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setFitToWidth((f) => !f)}
              className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold transition ${
                fitToWidth ? 'bg-amber-500/20 text-amber-300' : 'text-parchment-100'
              }`}
              title="Toggle Fit to Screen Width"
            >
              {fitToWidth ? 'Fit' : `${Math.round(scale * 100)}%`}
            </button>
            <button
              type="button"
              onClick={() => {
                setFitToWidth(false);
                setScale((s) => Math.min(2.6, Number((s + 0.2).toFixed(2))));
              }}
              disabled={loading}
              className="p-1.5 text-parchment-200 hover:text-amber-300 active:scale-90"
              aria-label="Zoom In"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
          </div>

          {/* Rotate & Fullscreen */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setRotation((r) => (r + 90) % 360)}
              className="rounded-xl bg-black/30 border border-white/15 p-2 text-parchment-200 hover:text-amber-300 active:scale-95"
              title="Rotate 90°"
            >
              <RotateCw className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleFullscreen}
              className="hidden sm:inline-flex rounded-xl bg-black/30 border border-white/15 p-2 text-parchment-200 hover:text-amber-300"
              title="Fullscreen Reader"
            >
              <Maximize2 className="h-4 w-4" />
            </button>

            {/* Authenticated Private Download */}
            <a
              href={downloadEndpointUrl}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-bold text-mudra-950 hover:bg-amber-400 transition shadow active:scale-95"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden xs:inline">Download</span>
              <span className="xs:hidden">PDF</span>
            </a>
          </div>
        </div>
      </div>

      {/* Text Layer vs Scanned PDF Indicator Banner */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#10223b] px-4 py-2 text-xs border-b border-white/10">
        <div className="flex items-center gap-2">
          {hasTextLayer ? (
            <>
              <FileText className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span className="text-parchment-200 text-[11px] sm:text-xs">
                <strong>Text-Layer PDF:</strong> Full PDF text &amp; Malayalam/English catalogue metadata indexed.
              </span>
            </>
          ) : (
            <>
              <ScanLine className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              <span className="text-amber-200 text-[11px] sm:text-xs">
                <strong>Scanned Archival PDF:</strong> Indexed via Mudra Malayalam &amp; English catalogue metadata.
              </span>
            </>
          )}
        </div>
        <span className="hidden sm:inline-flex items-center gap-1 font-mono text-[11px] text-parchment-300">
          <Smartphone className="h-3 w-3 text-amber-400" />
          Swipe or tap to turn pages • {docId} (v{currentVersion})
        </span>
      </div>

      {/* Main Canvas Viewport with Mobile Swipe Support */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="relative flex min-h-[460px] sm:min-h-[560px] w-full flex-1 flex-col items-center justify-center overflow-auto bg-[#1b2638] p-2 sm:p-6"
      >
        {loading && (
          <div className="flex flex-col items-center gap-3 py-16 text-parchment-200">
            <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
            <p className="text-xs sm:text-sm text-center px-4">
              Streaming private document via authenticated byte-range reader…
            </p>
          </div>
        )}

        {error && (
          <div className="max-w-md rounded-2xl border border-red-500/40 bg-red-950/60 p-6 text-center text-red-200">
            <p className="font-semibold mb-1">Unable to load private PDF stream</p>
            <p className="text-xs text-red-300">{error}</p>
          </div>
        )}

        <div className={`relative transition-opacity ${loading || error ? 'hidden' : 'block'}`}>
          {renderingPage && (
            <div className="absolute right-3 top-3 z-10 rounded-lg bg-[#0b192c]/90 px-2.5 py-1 text-[11px] text-amber-300 shadow">
              Rendering page {pageNumber}…
            </div>
          )}
          <canvas
            ref={canvasRef}
            className="mx-auto rounded-lg bg-white shadow-2xl ring-1 ring-black/20 max-w-full"
          />
        </div>
      </div>

      {/* Bottom Mobile-App Friendly Page Strip */}
      <div className="flex items-center justify-between bg-[#0b192c] px-4 py-3 text-xs text-parchment-300 border-t border-white/10">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 overflow-hidden rounded-full ring-1 ring-amber-400/60">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/mudrapublications_logo.jpeg"
              alt="Mudra"
              className="h-full w-full object-cover"
            />
          </div>
          <span className="text-[11px] sm:text-xs">
            Mudra Protected Reader • Page {pageNumber} of {numPages}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={pageNumber <= 1}
            onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
            className="rounded-xl bg-white/10 px-3.5 py-1.5 font-semibold text-white hover:bg-white/20 disabled:opacity-40 active:scale-95"
          >
            Prev
          </button>
          <button
            type="button"
            disabled={pageNumber >= numPages}
            onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
            className="rounded-xl bg-amber-500 px-3.5 py-1.5 font-bold text-mudra-950 hover:bg-amber-400 disabled:opacity-40 active:scale-95"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
