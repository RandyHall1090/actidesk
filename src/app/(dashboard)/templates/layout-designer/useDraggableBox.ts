import { useRef, type RefObject } from "react";
import type { SlotPosition } from "@/lib/packages/layouts";
import { clamp, roundPct } from "./designerState";

type DragMode = "move" | "resize";

type DragState = {
  mode: DragMode;
  startClientX: number;
  startClientY: number;
  startLeftPct: number;
  startTopPct: number;
  startWidthPct: number;
};

function pct(v: string): number {
  return parseFloat(v) || 0;
}

/**
 * One instance per box. Uses setPointerCapture instead of window-level
 * listeners: the browser guarantees the capture (and therefore continued
 * pointermove/pointerup delivery to this same element) is released
 * automatically on pointerup, pointercancel, or unmount -- there's no
 * manual addEventListener/removeEventListener pair that can ever leak a
 * dangling listener if a pointerup is somehow missed, and two boxes can be
 * dragged simultaneously by two touch points with no extra bookkeeping.
 */
export function useDraggableBox({
  containerRef,
  pos,
  onChange,
  minWidthPct = 5,
  maxWidthPct = 60,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  pos: SlotPosition;
  onChange: (next: SlotPosition) => void;
  minWidthPct?: number;
  maxWidthPct?: number;
}) {
  // Kept in a ref, not state -- it doesn't need to trigger a render itself,
  // onChange already causes one on every pointermove.
  const drag = useRef<DragState | null>(null);

  function begin(mode: DragMode, e: React.PointerEvent) {
    if (mode === "resize") e.stopPropagation(); // don't also start a "move" drag on the parent box
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      mode,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startLeftPct: pct(pos.left),
      startTopPct: pct(pos.top),
      startWidthPct: pct(pos.width),
    };
  }

  function move(e: React.PointerEvent) {
    const d = drag.current;
    const container = containerRef.current;
    if (!d || !container) return;
    const rect = container.getBoundingClientRect();
    const dxPct = ((e.clientX - d.startClientX) / rect.width) * 100;
    const dyPct = ((e.clientY - d.startClientY) / rect.height) * 100;

    if (d.mode === "move") {
      onChange({
        ...pos,
        left: roundPct(clamp(d.startLeftPct + dxPct, 0, 95)),
        top: roundPct(clamp(d.startTopPct + dyPct, 0, 95)),
      });
    } else {
      onChange({
        ...pos,
        width: roundPct(clamp(d.startWidthPct + dxPct, minWidthPct, maxWidthPct)),
      });
    }
  }

  function end() {
    drag.current = null; // capture release is automatic on pointerup/pointercancel
  }

  return {
    boxHandlers: {
      onPointerDown: (e: React.PointerEvent) => begin("move", e),
      onPointerMove: move,
      onPointerUp: end,
      onPointerCancel: end,
    },
    handleHandlers: {
      onPointerDown: (e: React.PointerEvent) => begin("resize", e),
      onPointerMove: move,
      onPointerUp: end,
      onPointerCancel: end,
    },
  };
}
