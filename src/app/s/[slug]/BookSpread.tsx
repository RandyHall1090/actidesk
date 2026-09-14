"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { PdfPageCanvas, ChevronLeftIcon, ChevronRightIcon } from "./DocumentViewer";

/**
 * Real book page-pairing: page 1 (the cover) is always shown alone, then
 * pages pair up (2,3), (4,5), (6,7)... A trailing unpaired page (an even
 * total page count) ends up alone too -- e.g. a 12-page PDF pairs as
 * cover, (2,3), (4,5), (6,7), (8,9), (10,11), then page 12 alone as a
 * back cover. This isn't arbitrary: it's exactly the layout a real
 * printed booklet/magazine already uses (confirmed against the actual
 * "21 Questions" PDF used to verify this feature -- page 12 is its real,
 * standalone back-cover artwork).
 */
export function getSpreadCount(pageCount: number): number {
  if (pageCount <= 1) return pageCount;
  return Math.ceil((pageCount - 1) / 2) + 1;
}

export function getSpread(
  pageCount: number,
  index: number,
): { left: number | null; right: number | null } {
  if (index <= 0) {
    return { left: null, right: pageCount >= 1 ? 1 : null };
  }
  const left = 2 * index;
  const right = left + 1;
  return {
    left: left <= pageCount ? left : null,
    right: right <= pageCount ? right : null,
  };
}

/** Which spread index a given page number falls in -- the inverse of getSpread. */
function indexForPage(page: number): number {
  if (page <= 1) return 0;
  return Math.floor((page - 2) / 2) + 1;
}

type Turn = { direction: "forward" | "backward"; toIndex: number };

function PageBox({
  pdf,
  pageNumber,
  width,
  height,
  left,
}: {
  pdf: PDFDocumentProxy;
  pageNumber: number | null;
  width: number;
  height: number;
  left: number;
}) {
  return (
    <div
      className="absolute top-0 overflow-hidden rounded bg-white shadow-2xl"
      style={{ left, width, height }}
    >
      {pageNumber !== null && (
        <PdfPageCanvas
          pdf={pdf}
          pageNumber={pageNumber}
          targetWidth={width}
          className="h-full w-full object-contain"
        />
      )}
    </div>
  );
}

/**
 * The single animated "leaf" mid-turn: a two-sided panel (front/back faces,
 * each `backface-visibility: hidden`) that rotates around its spine edge --
 * the left edge for a forward turn (it starts flat over the right page and
 * swings left), the right edge for a backward turn (starts flat over the
 * left page and swings right). Its parent sets `perspective` so the
 * rotation actually reads as a fold in 3D space rather than a flat mirror.
 */
function TurningLeaf({
  pdf,
  direction,
  frontPage,
  backPage,
  width,
  height,
  left,
  rotated,
  onTransitionEnd,
}: {
  pdf: PDFDocumentProxy;
  direction: "forward" | "backward";
  frontPage: number | null;
  backPage: number | null;
  width: number;
  height: number;
  left: number;
  rotated: boolean;
  onTransitionEnd: () => void;
}) {
  const isForward = direction === "forward";
  const targetRotation = isForward ? -180 : 180;

  return (
    <div
      className="absolute top-0"
      style={{
        left,
        width,
        height,
        zIndex: 10,
        transformStyle: "preserve-3d",
        transformOrigin: isForward ? "left center" : "right center",
        transform: `rotateY(${rotated ? targetRotation : 0}deg)`,
        transition: "transform 700ms ease-in-out",
      }}
      onTransitionEnd={(e) => {
        // transitionend bubbles: PdfPageCanvas fades in via its own
        // "opacity" transition, and without this check that child event
        // reaching this handler ended the whole turn almost instantly --
        // confirmed live, the rotation was still under 1 degree into its
        // intended 700ms/180deg sweep when it fired. Only react to this
        // leaf's own transform transition finishing.
        if (e.target === e.currentTarget && e.propertyName === "transform") {
          onTransitionEnd();
        }
      }}
    >
      <div
        className="absolute inset-0 overflow-hidden rounded bg-white shadow-2xl"
        style={{ backfaceVisibility: "hidden" }}
      >
        {frontPage !== null && (
          <PdfPageCanvas
            pdf={pdf}
            pageNumber={frontPage}
            targetWidth={width}
            className="h-full w-full object-contain"
          />
        )}
      </div>
      {/* Pre-rotated 180deg so that once the whole leaf has rotated to
          targetRotation, this face's NET rotation is 0 -- reading right-side
          up rather than mirror-reversed, the standard CSS flip-card trick. */}
      <div
        className="absolute inset-0 overflow-hidden rounded bg-white shadow-2xl"
        style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
      >
        {backPage !== null && (
          <PdfPageCanvas
            pdf={pdf}
            pageNumber={backPage}
            targetWidth={width}
            className="h-full w-full object-contain"
          />
        )}
      </div>
    </div>
  );
}

export type BookSpreadHandle = {
  goNext: () => void;
  goPrev: () => void;
};

/**
 * The two-page "open book" reader: a real page-turn animation (one leaf
 * rotating around the spine, revealing the next/previous spread
 * underneath), used by PdfReaderModal in place of the plain single-page
 * view once the container is wide enough for two pages to actually be
 * readable side by side. Owns its own Next/Prev arrows (styled to match
 * the single-page reader's) since they're positioned relative to the
 * spread, not the modal as a whole; exposes goNext/goPrev via `ref` so
 * the modal's shared keyboard handler and thumbnail-strip clicks
 * (`jumpTo`) can still drive it from outside.
 */
export const BookSpread = forwardRef<
  BookSpreadHandle,
  {
    pdf: PDFDocumentProxy;
    pageCount: number;
    containerWidth: number;
    containerHeight: number;
    jumpTo: { page: number; nonce: number } | null;
    onPagesChange: (pages: number[]) => void;
  }
>(function BookSpread(
  { pdf, pageCount, containerWidth, containerHeight, jumpTo, onPagesChange },
  ref,
) {
  const [spreadIndex, setSpreadIndex] = useState(() => 0);
  const [turn, setTurn] = useState<Turn | null>(null);
  const [rotated, setRotated] = useState(false);
  const [aspect, setAspect] = useState<number | null>(null);

  const spreadCount = getSpreadCount(pageCount);
  const current = getSpread(pageCount, spreadIndex);
  const target = turn ? getSpread(pageCount, turn.toIndex) : null;

  // A ref, not a dependency, so a new inline onPagesChange prop each render
  // (the common case for a caller that doesn't bother memoizing it) can't
  // re-trigger the settle-effect below and loop.
  const onPagesChangeRef = useRef(onPagesChange);
  useEffect(() => {
    onPagesChangeRef.current = onPagesChange;
  });

  useEffect(() => {
    let cancelled = false;
    pdf.getPage(1).then((page) => {
      if (cancelled) return;
      const viewport = page.getViewport({ scale: 1 });
      setAspect(viewport.width / viewport.height);
    });
    return () => {
      cancelled = true;
    };
  }, [pdf]);

  // Report the settled (not mid-turn) visible pages for the thumbnail strip.
  useEffect(() => {
    if (turn) return;
    const pages = [current.left, current.right].filter(
      (n): n is number => n !== null,
    );
    onPagesChangeRef.current(pages);
    // current is derived fresh from spreadIndex/pageCount each render --
    // depending on spreadIndex/pageCount directly is equivalent and avoids
    // an object-identity dependency-array footgun.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spreadIndex, pageCount, turn]);

  const lastJumpNonceRef = useRef<number | null>(null);
  useEffect(() => {
    if (!jumpTo || jumpTo.nonce === lastJumpNonceRef.current) return;
    lastJumpNonceRef.current = jumpTo.nonce;
    setTurn(null);
    setRotated(false);
    setSpreadIndex(indexForPage(jumpTo.page));
  }, [jumpTo]);

  // Trigger the CSS transition a couple of frames after the turn's resting
  // state first paints -- setting the target transform in the very same
  // render that mounts it can get coalesced by the browser into no
  // transition at all.
  useEffect(() => {
    if (!turn) return;
    // Reset to the resting (unrotated) transform whenever a *new* turn
    // starts, before the double-rAF below flips it to the target rotation
    // -- this is what makes the transition actually animate rather than
    // snapping straight to the end state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRotated(false);
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setRotated(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [turn]);

  function handleTurnEnd() {
    if (!turn) return;
    setSpreadIndex(turn.toIndex);
    setTurn(null);
    setRotated(false);
  }

  const goNext = useCallback(() => {
    if (turn) return;
    if (spreadIndex + 1 >= spreadCount) return;
    setTurn({ direction: "forward", toIndex: spreadIndex + 1 });
  }, [turn, spreadIndex, spreadCount]);

  const goPrev = useCallback(() => {
    if (turn) return;
    if (spreadIndex - 1 < 0) return;
    setTurn({ direction: "backward", toIndex: spreadIndex - 1 });
  }, [turn, spreadIndex]);

  useImperativeHandle(ref, () => ({ goNext, goPrev }), [goNext, goPrev]);

  if (aspect === null) {
    return <p className="text-sm text-white/70">Loading…</p>;
  }

  const gap = 6;
  const maxPerPageWidthFromWidth = (containerWidth - gap) / 2;
  const maxPerPageWidthFromHeight = containerHeight * aspect;
  const perPageWidth = Math.max(
    80,
    Math.floor(Math.min(maxPerPageWidthFromWidth, maxPerPageWidthFromHeight)),
  );
  const perPageHeight = Math.floor(perPageWidth / aspect);

  const leftSlotPage = turn?.direction === "backward" ? target!.left : current.left;
  const rightSlotPage = turn?.direction === "forward" ? target!.right : current.right;

  return (
    <div className="flex h-full w-full items-center justify-center gap-2 sm:gap-4">
      {spreadIndex > 0 ? (
        <button
          type="button"
          onClick={goPrev}
          disabled={!!turn}
          aria-label="Previous page"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 disabled:opacity-40"
        >
          <ChevronLeftIcon />
        </button>
      ) : (
        <div className="w-10 shrink-0" />
      )}

      <div
        className="relative shrink-0"
        style={{ width: perPageWidth * 2 + gap, height: perPageHeight, perspective: 2200 }}
      >
        <PageBox pdf={pdf} pageNumber={leftSlotPage} width={perPageWidth} height={perPageHeight} left={0} />
        <PageBox
          pdf={pdf}
          pageNumber={rightSlotPage}
          width={perPageWidth}
          height={perPageHeight}
          left={perPageWidth + gap}
        />
        {turn && (
          <TurningLeaf
            pdf={pdf}
            direction={turn.direction}
            frontPage={turn.direction === "forward" ? current.right : current.left}
            backPage={turn.direction === "forward" ? target!.left : target!.right}
            width={perPageWidth}
            height={perPageHeight}
            left={turn.direction === "forward" ? perPageWidth + gap : 0}
            rotated={rotated}
            onTransitionEnd={handleTurnEnd}
          />
        )}
      </div>

      {spreadIndex < spreadCount - 1 ? (
        <button
          type="button"
          onClick={goNext}
          disabled={!!turn}
          aria-label="Next page"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 disabled:opacity-40"
        >
          <ChevronRightIcon />
        </button>
      ) : (
        <div className="w-10 shrink-0" />
      )}
    </div>
  );
});
