"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { loadPdf, renderPageToCanvas } from "./pdfjs";

/**
 * One PDF page rendered to a canvas at `targetWidth` CSS px, scaled
 * responsively by CSS from there (same replaced-element behavior as an
 * `<img>`). Shared by the cover thumbnail (page 1) and the full-screen
 * reader (current page) -- both just pick a different targetWidth.
 */
function MagazinePageCanvas({
  pdf,
  pageNumber,
  targetWidth,
  className,
}: {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  targetWidth: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendering, setRendering] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    let task: RenderTask | null = null;
    setRendering(true);

    renderPageToCanvas(pdf, pageNumber, canvas, targetWidth)
      .then((renderTask) => {
        if (cancelled) {
          // Already superseded (e.g. React's dev-mode double-effect-invoke
          // unmounted this before the page/task even resolved) -- cancel it,
          // and catch its own promise right here so cancelling doesn't leave
          // an unhandled rejection dangling (it's not returned/chained below).
          renderTask.cancel();
          renderTask.promise.catch(() => {});
          return;
        }
        task = renderTask;
        return renderTask.promise;
      })
      .then(() => {
        if (!cancelled) setRendering(false);
      })
      .catch(() => {
        // pdf.js rejects with a RenderingCancelledException when task.cancel()
        // is called below -- expected on fast page turns/resizes, not a real error.
        if (!cancelled) setRendering(false);
      });

    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [pdf, pageNumber, targetWidth]);

  return (
    <canvas
      ref={canvasRef}
      className={`${className ?? ""} block transition-opacity ${rendering ? "opacity-0" : "opacity-100"}`}
    />
  );
}

/** Full-screen page-by-page reader: Prev/Next arrow buttons, a page counter,
 * keyboard left/right/Escape, and click-outside-to-close. Reuses the same
 * already-loaded `pdf` the cover thumbnail loaded -- opening the reader
 * never re-fetches the file. */
function MagazineReader({
  pdf,
  pageCount,
  name,
  onClose,
}: {
  pdf: PDFDocumentProxy;
  pageCount: number;
  name: string;
  onClose: () => void;
}) {
  const [page, setPage] = useState(1);
  const [targetWidth, setTargetWidth] = useState(600);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setTargetWidth(Math.max(200, Math.floor(width)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") setPage((p) => Math.min(pageCount, p + 1));
      else if (e.key === "ArrowLeft") setPage((p) => Math.max(1, p - 1));
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, pageCount]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={name}
      className="fixed inset-0 z-50 flex flex-col bg-black/90 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="truncate pr-4 text-sm font-medium text-white">{name}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 rounded-full px-3 py-1.5 text-lg leading-none text-white hover:bg-white/10"
        >
          ✕
        </button>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center gap-2 sm:gap-4">
        <button
          type="button"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          aria-label="Previous page"
          className="shrink-0 rounded-full bg-white/10 px-3 py-4 text-xl text-white hover:bg-white/20 disabled:opacity-30"
        >
          ‹
        </button>

        <div
          ref={containerRef}
          className="flex h-full max-w-3xl flex-1 items-center justify-center overflow-auto"
        >
          <MagazinePageCanvas
            pdf={pdf}
            pageNumber={page}
            targetWidth={Math.min(targetWidth, 900)}
            className="max-h-full w-auto max-w-full"
          />
        </div>

        <button
          type="button"
          onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
          disabled={page >= pageCount}
          aria-label="Next page"
          className="shrink-0 rounded-full bg-white/10 px-3 py-4 text-xl text-white hover:bg-white/20 disabled:opacity-30"
        >
          ›
        </button>
      </div>

      <p className="mt-3 text-center text-sm text-white/70">
        Page {page} of {pageCount}
      </p>
    </div>
  );
}

type LoadState =
  | { status: "loading" }
  | { status: "ready"; pdf: PDFDocumentProxy; pageCount: number }
  | { status: "error" };

/**
 * The magazine's on-desk presence: a page-1 cover thumbnail that opens a
 * full-screen page-by-page reader on click. Renders and positions exactly
 * like the plain-image slots around it (`style` carries the same
 * layout-driven left/top/width/rotate), but the content itself is drawn
 * from a real PDF rather than a static image.
 */
export function MagazineSlot({
  url,
  name,
  style,
  onOpen,
}: {
  url: string;
  name: string;
  style?: CSSProperties;
  onOpen: () => void;
}) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [readerOpen, setReaderOpen] = useState(false);
  const openedOnceRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    // Reset to "loading" whenever `url` itself changes (not just on mount)
    // -- needed for the admin live-preview forms (NewPackageForm.tsx /
    // TemplatesClient.tsx), where re-picking the Magazine slot swaps this
    // same mounted component's url prop without remounting it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ status: "loading" });
    loadPdf(url)
      .then((pdf) => {
        if (!cancelled) setState({ status: "ready", pdf, pageCount: pdf.numPages });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  function handleOpen() {
    if (state.status !== "ready") return;
    if (!openedOnceRef.current) {
      openedOnceRef.current = true;
      onOpen();
    }
    setReaderOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        disabled={state.status !== "ready"}
        style={style}
        aria-label={`Open ${name}`}
        className="overflow-hidden rounded-[0.6cqw] bg-white shadow-2xl ring-1 ring-black/10 transition-transform hover:scale-105 disabled:hover:scale-100"
      >
        {state.status === "ready" && (
          <MagazinePageCanvas pdf={state.pdf} pageNumber={1} targetWidth={480} className="w-full" />
        )}
        {state.status === "loading" && (
          <div className="aspect-[0.77] w-full animate-pulse bg-neutral-200" />
        )}
        {state.status === "error" && (
          <div className="flex aspect-[0.77] w-full items-center justify-center p-[1.5cqw] text-center text-[1.6cqw] text-neutral-500">
            Couldn&apos;t load magazine
          </div>
        )}
      </button>
      {readerOpen && state.status === "ready" && (
        <MagazineReader
          pdf={state.pdf}
          pageCount={state.pageCount}
          name={name}
          onClose={() => setReaderOpen(false)}
        />
      )}
    </>
  );
}
