'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Download,
  Maximize2,
  RotateCw,
  Loader2,
  ExternalLink,
  Layers,
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
 * Mudra Publications PDF Reader (Canvas PDF.js + Native Browser PDF Engine Toggle)
 *
 * - Uses self-hosted `/pdf.worker.min.mjs` from `public/` so PDF.js never fails due to external CDN blocks.
 * - Configures standard fonts & CMap data so Malayalam and English glyphs in both scanned and text PDFs render crisply.
 * - Includes an instant "Canvas Reader / Native PDF View" toggle and "Open Full PDF" button so every PDF is 100% readable on all desktop and mobile browsers.
 */
export default function MudraPdfReader({
  docId,
  documentNumber,
  titleMl,
  titleEn,
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

  const [viewMode, setViewMode] = useState<'canvas' | 'native'>('canvas');
  const [numPages, setNumPages] = useState<number>(initialPageCount || 1);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.35);
  const [fitToWidth, setFitToWidth] = useState<boolean>(true);
  const [rotation, setRotation] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [renderingPage, setRenderingPage] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

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
          const containerWidth = Math.max(300, containerRef.current.clientWidth - 32);
          const unscaledViewport = page.getViewport({ scale: 1, rotation: targetRotation });
          if (useFitWidth) {
            effectiveScale = Math.min(
              2.0,
              Math.max(0.75, (containerWidth - 16) / unscaledViewport.width)
            );
          }
        }

        const viewport = page.getViewport({ scale: effectiveScale, rotation: targetRotation });
        const dpr = typeof window !== 'undefined' ? Math.min(2.5, window.devicePixelRatio || 1.5) : 1.5;

        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, viewport.width, viewport.height);

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
        const pdfjsLib = await import('pdfjs-dist');
        // Use local self-hosted worker from public/pdf.worker.min.mjs
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

        const loadingTask = pdfjsLib.getDocument({
          url: pdfEndpointUrl,
          withCredentials: true,
          rangeChunkSize: 65536,
          cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
          cMapPacked: true,
          standardFontDataUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/standard_fonts/`,
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
        console.warn('Canvas PDF.js fallback to native viewer:', err);
        setError((err as Error).message || 'Switching to Native PDF Viewer');
        setViewMode('native');
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
    if (!loading && viewMode === 'canvas' && pdfDocRef.current) {
      renderPage(pageNumber, scale, rotation, fitToWidth);
    }
  }, [pageNumber, scale, rotation, fitToWidth, loading, viewMode, renderPage]);

  useEffect(() => {
    const onResize = () => {
      if (!loading && viewMode === 'canvas' && pdfDocRef.current && fitToWidth) {
        renderPage(pageNumber, scale, rotation, true);
      }
    };
    window.addEventListener('resize', onResize, { passive: true });
    return () => window.removeEventListener('resize', onResize);
  }, [loading, viewMode, pageNumber, scale, rotation, fitToWidth, renderPage]);

  const handleFullscreen = () => {
    if (containerRef.current && containerRef.current.requestFullscreen) {
      containerRef.current.requestFullscreen().catch(() => {});
    }
  };

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
      {/* Top Reader Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-[#0b192c] via-[#132743] to-[#0b192c] px-3.5 sm:px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-[#0b192c] ring-2 ring-amber-400/80 shadow">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/mudrapublications_logo.jpeg"
              alt="Mudra Publications"
              width={36}
              height={36}
              className="h-full w-full object-cover scale-105"
            />
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs sm:text-sm font-bold text-white" title={titleMl || titleEn}>
              {documentNumber}
            </p>
            <p className="truncate text-[11px] text-parchment-200" title={titleMl || titleEn}>
              {titleMl || titleEn}
            </p>
          </div>
        </div>

        {/* Reader Controls */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 w-full sm:w-auto justify-between sm:justify-end">
          {/* Reader Mode Toggle: Canvas vs Native PDF */}
          <button
            type="button"
            onClick={() => setViewMode((m) => (m === 'canvas' ? 'native' : 'canvas'))}
            className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 border border-white/15 px-2.5 py-1.5 text-xs font-semibold text-amber-300 hover:bg-white/20 transition"
            title="Switch between PDF.js Page Reader and Full Native PDF Viewer"
          >
            <Layers className="h-3.5 w-3.5" />
            <span>{viewMode === 'canvas' ? 'Standard PDF View' : 'Page-by-Page View'}</span>
          </button>

          {viewMode === 'canvas' && (
            <>
              {/* Page Navigation */}
              <div className="flex items-center rounded-xl bg-black/30 border border-white/15 px-1.5 py-1">
                <button
                  type="button"
                  onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
                  disabled={pageNumber <= 1 || loading}
                  className="p-1 text-parchment-200 hover:text-amber-300 disabled:opacity-40 active:scale-90"
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
                  className="p-1 text-parchment-200 hover:text-amber-300 disabled:opacity-40 active:scale-90"
                  aria-label="Next Page"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              {/* Zoom & Fit Controls */}
              <div className="flex items-center rounded-xl bg-black/30 border border-white/15 px-1.5 py-1">
                <button
                  type="button"
                  onClick={() => {
                    setFitToWidth(false);
                    setScale((s) => Math.max(0.6, Number((s - 0.25).toFixed(2))));
                  }}
                  disabled={loading}
                  className="p-1 text-parchment-200 hover:text-amber-300 active:scale-90"
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
                    setScale((s) => Math.min(3.0, Number((s + 0.25).toFixed(2))));
                  }}
                  disabled={loading}
                  className="p-1 text-parchment-200 hover:text-amber-300 active:scale-90"
                  aria-label="Zoom In"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="rounded-xl bg-black/30 border border-white/15 p-2 text-parchment-200 hover:text-amber-300 active:scale-95"
                title="Rotate 90°"
              >
                <RotateCw className="h-4 w-4" />
              </button>
            </>
          )}

          <div className="flex items-center gap-1.5">
            <a
              href={pdfEndpointUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-xl bg-white/10 border border-white/15 px-3 py-2 text-xs font-semibold text-white hover:bg-white/20 transition"
              title="Open PDF in New Tab"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Full Tab</span>
            </a>

            <button
              type="button"
              onClick={handleFullscreen}
              className="hidden sm:inline-flex rounded-xl bg-black/30 border border-white/15 p-2 text-parchment-200 hover:text-amber-300"
              title="Fullscreen Reader"
            >
              <Maximize2 className="h-4 w-4" />
            </button>

            <a
              href={downloadEndpointUrl}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-bold text-mudra-950 hover:bg-amber-400 transition shadow active:scale-95"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download</span>
            </a>
          </div>
        </div>
      </div>

      {/* Main Reader Viewport */}
      {viewMode === 'native' ? (
        <div className="w-full bg-[#1b2638] flex-1 min-h-[680px]">
          <iframe
            src={`${pdfEndpointUrl}#view=FitH`}
            title={`${documentNumber} PDF Reader`}
            className="w-full h-[75vh] min-h-[680px] border-0 bg-white"
          />
        </div>
      ) : (
        <div
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="relative flex min-h-[540px] sm:min-h-[680px] w-full flex-1 flex-col items-center justify-start overflow-auto bg-[#1b2638] p-2 sm:p-6"
        >
          {loading && (
            <div className="flex flex-col items-center gap-3 py-24 text-parchment-200">
              <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
              <p className="text-xs sm:text-sm text-center px-4">
                Loading official document PDF…
              </p>
            </div>
          )}

          {error && (
            <div className="my-8 max-w-md rounded-2xl border border-amber-500/40 bg-amber-950/60 p-6 text-center text-amber-200">
              <p className="font-semibold mb-2">Switched to Standard PDF Viewer</p>
              <button
                type="button"
                onClick={() => setViewMode('native')}
                className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-mudra-950"
              >
                Open Standard Viewer
              </button>
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
      )}

      {/* Bottom Page Bar */}
      <div className="flex items-center justify-between bg-[#0b192c] px-4 py-3 text-xs text-parchment-300 border-t border-white/10">
        <span className="text-[11px] sm:text-xs font-medium">
          {documentNumber} • Page {pageNumber} of {numPages}
        </span>
        {viewMode === 'canvas' && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pageNumber <= 1}
              onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
              className="rounded-xl bg-white/10 px-3.5 py-1.5 font-semibold text-white hover:bg-white/20 disabled:opacity-40 active:scale-95"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={pageNumber >= numPages}
              onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
              className="rounded-xl bg-amber-500 px-3.5 py-1.5 font-bold text-mudra-950 hover:bg-amber-400 disabled:opacity-40 active:scale-95"
            >
              Next Page
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
