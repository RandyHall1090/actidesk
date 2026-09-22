"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { loadPdf, renderPageToCanvas } from "./pdfjs";
import { BookSpread, type BookSpreadHandle } from "./BookSpread";

// Below this the two pages of a real book spread would render too small to
// read comfortably (~380px per page) -- narrower viewports (and any single-
// page document) get the plain single-page view instead.
const BOOK_SPREAD_MIN_WIDTH = 800;

export function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

export function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M4 19h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M5 5l14 14M19 5L5 19" />
    </svg>
  );
}

/**
 * One PDF page rendered to a canvas at `targetWidth` CSS px, scaled
 * responsively by CSS from there (same replaced-element behavior as an
 * `<img>`). Shared by the on-desk magazine cover (page 1), the reader's
 * current page, every thumbnail in its page strip, and BookSpread.tsx's
 * two-page view (exported for that reuse).
 */
export function PdfPageCanvas({
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
          // unmounted this before the task even resolved) -- cancel it,
          // and catch its own promise right here so cancelling doesn't
          // leave an unhandled rejection dangling (it's not
          // returned/chained below).
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

type LoadState =
  | { status: "loading" }
  | { status: "ready"; pdf: PDFDocumentProxy; pageCount: number }
  | { status: "error" };

/**
 * Full-screen page-by-page reader: a translucent backdrop (the desk scene
 * stays dimly visible behind it, matching the TMT reference this whole
 * template is modeled on -- see spec/plan.md T19/T20), Prev/Next arrow
 * buttons that only appear when there's somewhere to go, a Download
 * button, a Close button, and a thumbnail filmstrip across the bottom
 * (click a thumbnail to jump straight to that page) instead of a plain
 * page counter.
 *
 * Pass `preloadedPdf` when the caller already loaded the document itself
 * (the magazine cover does, so it can show page 1 without opening the
 * reader first) -- otherwise this loads `url` itself on mount, showing a
 * brief loading state (the common case for brochures, which have no cover
 * thumbnail and load lazily on click).
 */
function PdfReaderModal({
  url,
  name,
  preloadedPdf,
  onClose,
}: {
  url: string;
  name: string;
  preloadedPdf?: PDFDocumentProxy;
  onClose: () => void;
}) {
  const [state, setState] = useState<LoadState>(
    preloadedPdf
      ? { status: "ready", pdf: preloadedPdf, pageCount: preloadedPdf.numPages }
      : { status: "loading" },
  );
  const [page, setPage] = useState(1);
  const [targetWidth, setTargetWidth] = useState(600);
  const [containerHeight, setContainerHeight] = useState(400);
  const containerRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<BookSpreadHandle>(null);
  const [spreadPages, setSpreadPages] = useState<number[]>([]);
  const [jumpSignal, setJumpSignal] = useState<{ page: number; nonce: number } | null>(null);

  useEffect(() => {
    if (preloadedPdf) return;
    let cancelled = false;
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
    // preloadedPdf is only read once above (a fresh reader mounts per open) --
    // it deliberately isn't a dependency here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      if (rect.width) setTargetWidth(Math.max(200, Math.floor(rect.width)));
      if (rect.height) setContainerHeight(Math.max(150, Math.floor(rect.height)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const ready = state.status === "ready";
  // A real two-page spread only once there's room to actually read two
  // pages side by side, and only when there's more than one page to pair up.
  const mode: "single" | "spread" =
    ready && state.pageCount > 1 && targetWidth >= BOOK_SPREAD_MIN_WIDTH
      ? "spread"
      : "single";

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (mode === "spread") {
        if (e.key === "ArrowRight") bookRef.current?.goNext();
        else if (e.key === "ArrowLeft") bookRef.current?.goPrev();
        return;
      }
      if (state.status === "ready" && e.key === "ArrowRight") {
        setPage((p) => Math.min(state.pageCount, p + 1));
      } else if (state.status === "ready" && e.key === "ArrowLeft") {
        setPage((p) => Math.max(1, p - 1));
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, state, mode]);

  const hasPrev = ready && page > 1;
  const hasNext = ready && page < state.pageCount;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={name}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/70 p-3 sm:p-8"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* min-h-0 is required, not redundant with flex-1: a flex item's
          default min-height is "auto" (its content's natural size), so
          without this a tall/portrait PDF page's intrinsic canvas height
          forced this whole column taller than the viewport instead of
          being capped by it -- confirmed live, it pushed the header and
          thumbnail strip off-screen entirely for a 4-page portrait PDF. */}
      {/* Always max-w-6xl, not conditional on `mode` -- mode itself is
          computed from this container's *measured* width (via
          containerRef below), so capping it narrower specifically while
          in "single" mode created a circular dependency: the container
          could never measure wide enough to switch to "spread" in the
          first place, since it started single (targetWidth defaults to
          600) and a narrower cap kept it there permanently. Confirmed
          live: a 1440px viewport still measured only 784px available and
          never left single-page mode until this was fixed. A lone single
          page just centers within the extra width harmlessly. */}
      <div className="flex min-h-0 w-full max-w-6xl flex-1 flex-col items-stretch">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="truncate rounded-full bg-black/40 px-3 py-1 text-xs font-medium text-white">
            {name}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            {ready && (
              <a
                href={url}
                download
                onClick={(e) => e.stopPropagation()}
                aria-label="Download"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
              >
                <DownloadIcon />
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center gap-2 sm:gap-4">
          {mode === "single" &&
            (hasPrev ? (
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="Previous page"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
              >
                <ChevronLeftIcon />
              </button>
            ) : (
              <div className="w-10 shrink-0" />
            ))}

          <div
            ref={containerRef}
            className="flex h-full min-w-0 flex-1 items-center justify-center overflow-hidden"
          >
            {state.status === "ready" && mode === "single" && (
              <PdfPageCanvas
                pdf={state.pdf}
                pageNumber={page}
                targetWidth={Math.min(targetWidth, 900)}
                className="max-h-full w-auto max-w-full rounded shadow-2xl"
              />
            )}
            {state.status === "ready" && mode === "spread" && (
              <BookSpread
                ref={bookRef}
                pdf={state.pdf}
                pageCount={state.pageCount}
                containerWidth={targetWidth}
                containerHeight={containerHeight}
                jumpTo={jumpSignal}
                onPagesChange={setSpreadPages}
              />
            )}
            {state.status === "loading" && (
              <p className="text-sm text-white/70">Loading…</p>
            )}
            {state.status === "error" && (
              <div className="max-w-sm rounded-lg bg-white p-6 text-center text-sm text-neutral-600">
                Couldn&apos;t load this document.{" "}
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-blue-600 underline"
                >
                  Open it directly
                </a>{" "}
                instead.
              </div>
            )}
          </div>

          {mode === "single" &&
            (hasNext ? (
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(state.pageCount, p + 1))}
                aria-label="Next page"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
              >
                <ChevronRightIcon />
              </button>
            ) : (
              <div className="w-10 shrink-0" />
            ))}
        </div>

        {ready && state.pageCount > 1 && (
          <div
            role="tablist"
            aria-label="Pages"
            className="mt-3 flex justify-center gap-2 overflow-x-auto px-1 py-1"
          >
            {Array.from({ length: state.pageCount }, (_, i) => i + 1).map((n) => {
              const active = mode === "spread" ? spreadPages.includes(n) : n === page;
              return (
                <button
                  key={n}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-label={`Page ${n}`}
                  onClick={() =>
                    mode === "spread"
                      ? setJumpSignal({ page: n, nonce: Date.now() })
                      : setPage(n)
                  }
                  className={`shrink-0 overflow-hidden rounded transition-opacity ${
                    active
                      ? "opacity-100 ring-2 ring-white"
                      : "opacity-50 ring-1 ring-white/30 hover:opacity-90"
                  }`}
                >
                  <PdfPageCanvas pdf={state.pdf} pageNumber={n} targetWidth={64} className="w-16" />
                </button>
              );
            })}
          </div>
        )}

        <p className="sr-only" aria-live="polite">
          {ready
            ? mode === "spread"
              ? `Pages ${spreadPages.join(", ")} of ${state.pageCount}`
              : `Page ${page} of ${state.pageCount}`
            : ""}
        </p>
      </div>
    </div>
  );
}

/**
 * The magazine's on-desk presence: a page-1 cover thumbnail that opens the
 * full-screen reader on click. Positions exactly like the plain-image
 * slots around it (`style` carries the layout-driven left/top/width/
 * rotate), but the content is drawn from a real PDF rather than a static
 * image. Preloads the PDF for the cover, then hands that same already-
 * loaded document to the reader -- opening it never re-fetches the file.
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
          <PdfPageCanvas pdf={state.pdf} pageNumber={1} targetWidth={480} className="w-full" />
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
        <PdfReaderModal
          url={url}
          name={name}
          preloadedPdf={state.pdf}
          onClose={() => setReaderOpen(false)}
        />
      )}
    </>
  );
}

/**
 * A generic clickable trigger that opens the full-screen PDF reader --
 * used for every brochure/document slot, both on-desk (DeskScene.tsx) and
 * in the below-fold fallback list (PackageView.tsx). Renders `children`
 * exactly as each call site already did (a branded card, or a plain link
 * row) inside a plain `<button>` instead of an `<a target="_blank">`, so
 * the visual is untouched but the click opens the in-page reader instead
 * of a new browser tab. Unlike the magazine cover, nothing is preloaded --
 * the reader loads the PDF itself, lazily, only once actually opened.
 */
export function DocumentLink({
  url,
  name,
  style,
  className,
  onOpen,
  children,
}: {
  url: string;
  name: string;
  style?: CSSProperties;
  className?: string;
  onOpen?: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const openedOnceRef = useRef(false);

  function handleClick() {
    if (!openedOnceRef.current) {
      openedOnceRef.current = true;
      onOpen?.();
    }
    setOpen(true);
  }

  return (
    <>
      <button type="button" onClick={handleClick} style={style} className={className}>
        {children}
      </button>
      {open && <PdfReaderModal url={url} name={name} onClose={() => setOpen(false)} />}
    </>
  );
}

/**
 * The letter's full-screen view -- everything else on the desk (magazine,
 * brochures, book photos, business card) opens larger on click; the
 * letter alone rendered as small, fixed on-desk text with no way to
 * enlarge it. Same dialog shell as PdfReaderModal (dim backdrop,
 * click-outside or Escape to close, a Close button) since the letter
 * isn't a PDF, just plain text, so it gets its own lightweight modal
 * instead of reusing the PDF reader.
 */
function LetterModal({
  body,
  orgName,
  orgLogoUrl,
  onClose,
}: {
  body: string;
  orgName: string;
  orgLogoUrl: string | null;
  onClose: () => void;
}) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Letter"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-8"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-neutral-200 px-6 py-4">
          {orgLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- dynamic signed Storage URL, not a static local asset
            <img src={orgLogoUrl} alt={orgName} className="h-6 w-auto object-contain" />
          ) : (
            <span className="text-sm font-semibold text-neutral-700">{orgName}</span>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-6 sm:px-10 sm:py-8">
          <p className="whitespace-pre-wrap text-base leading-relaxed text-neutral-800">
            {body}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * The letter's on-desk presence: the same small preview it always
 * rendered as, now a click target that opens LetterModal above for a
 * legible full-size read -- matching how every other on-desk asset
 * (magazine, brochures, book photos, business card) already behaves.
 */
export function LetterSlot({
  body,
  orgName,
  orgLogoUrl,
  style,
  className,
  onOpen,
  children,
}: {
  body: string;
  orgName: string;
  orgLogoUrl: string | null;
  style?: CSSProperties;
  className?: string;
  onOpen?: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const openedOnceRef = useRef(false);

  function handleClick() {
    if (!openedOnceRef.current) {
      openedOnceRef.current = true;
      onOpen?.();
    }
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        aria-label="Open letter"
        style={style}
        className={className}
      >
        {children}
      </button>
      {open && (
        <LetterModal
          body={body}
          orgName={orgName}
          orgLogoUrl={orgLogoUrl}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
