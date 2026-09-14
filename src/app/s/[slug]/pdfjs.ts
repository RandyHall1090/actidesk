"use client";

import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";

let pdfjsLibPromise: Promise<typeof import("pdfjs-dist")> | null = null;

// Lazy singleton: pdfjs-dist is a fairly heavy module (WASM-adjacent, its own
// worker script) and most public packages have no magazine slot at all, so
// it's only ever imported the first time a real PDF magazine is rendered.
function getPdfjsLib() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import("pdfjs-dist").then((lib) => {
      // Self-hosted as a plain static file, not resolved through the
      // bundler: public/pdf.worker.min.mjs is a manual copy of
      // node_modules/pdfjs-dist/build/pdf.worker.min.mjs, matching the
      // exact version pinned in package.json. This sidesteps any
      // bundler-specific (webpack vs. Turbopack) worker-asset resolution
      // question entirely -- it's just a normal public/ file. Re-copy it
      // after any pdfjs-dist version bump, or page rendering will fail.
      lib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      return lib;
    });
  }
  return pdfjsLibPromise;
}

export async function loadPdf(url: string): Promise<PDFDocumentProxy> {
  const pdfjsLib = await getPdfjsLib();
  return pdfjsLib.getDocument({ url }).promise;
}

/**
 * Renders one page to a caller-owned canvas at `targetWidth` CSS px
 * (multiplied by devicePixelRatio for a crisp raster). Only the canvas's
 * width/height *attributes* (its intrinsic resolution) are set here --
 * deliberately no inline `style.width`/`style.height`, so each caller's own
 * CSS classes fully control how it's displayed. That matters for the
 * reader's main page view, which needs `max-h-full` (fit inside whichever
 * of width/height is more restrictive, exactly like `object-fit: contain`)
 * rather than the cover/thumbnail uses' simple `w-full` -- an inline style
 * set here would win over those classes (inline style always beats a
 * stylesheet rule) and silently break that per-caller sizing.
 *
 * Returns the real pdf.js RenderTask (not just its promise) so a caller can
 * `.cancel()` an in-flight render -- required because pdf.js throws if a
 * second render starts on the same canvas before the first finishes, which
 * happens routinely here on fast page-turns or a resize mid-render.
 */
export async function renderPageToCanvas(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  targetWidth: number,
): Promise<RenderTask> {
  const page = await pdf.getPage(pageNumber);
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = (targetWidth * dpr) / baseViewport.width;
  const viewport = page.getViewport({ scale });

  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  return page.render({ canvasContext: ctx, viewport, canvas });
}
