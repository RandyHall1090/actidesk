"use client";

import type { CSSProperties, RefObject } from "react";
import type { SlotPosition } from "@/lib/packages/layouts";
import { DEFAULT_PREVIEW_ASPECT, type DesignerSlotState } from "./designerState";
import { useDraggableBox } from "./useDraggableBox";

// Local duplicate of DeskScene.tsx's slotStyle() -- that helper is
// unexported there and out of scope to change for this tool; it's ~8
// lines, fine to duplicate (KISS over DRY for something this small and
// this stable).
function slotStyle(pos: SlotPosition): CSSProperties {
  const id = (pos as DesignerSlotState).id;
  const rotate = pos.rotate ? `rotate(${pos.rotate}deg)` : "";
  return {
    position: "absolute",
    left: pos.left,
    top: pos.top,
    width: pos.width,
    aspectRatio: pos.aspect ?? DEFAULT_PREVIEW_ASPECT[id],
    // The pen graphic is mirrored at the real render site (DeskScene.tsx)
    // to point the opposite way from how the source photo naturally
    // reads -- without matching that here, this box's rotation reads
    // backwards from how the real page actually renders it, exactly
    // the mismatch reported live: a positive rotate here looks like the
    // mirror-image angle once flipped, not the angle actually shown.
    transform: id === "pen" ? `scaleX(-1) ${rotate}`.trim() : rotate || undefined,
  };
}

export function DesignerBox({
  slot,
  containerRef,
  isActive,
  onChange,
  onActivate,
}: {
  slot: DesignerSlotState;
  containerRef: RefObject<HTMLDivElement | null>;
  isActive: boolean;
  onChange: (next: DesignerSlotState) => void;
  onActivate: () => void;
}) {
  const { boxHandlers, handleHandlers } = useDraggableBox({
    containerRef,
    pos: slot,
    onChange: (next) => onChange({ ...slot, ...next }),
  });

  return (
    <div
      {...boxHandlers}
      onPointerDown={(e) => {
        onActivate();
        boxHandlers.onPointerDown(e);
      }}
      style={{ ...slotStyle(slot), zIndex: isActive ? 20 : 10 }}
      className="touch-none cursor-move select-none rounded border-2 border-dashed border-blue-500 dark:border-blue-400 bg-blue-500/20 dark:bg-blue-600/20 px-1 py-0.5 text-center shadow"
    >
      {/* An opaque chip, not plain text on the translucent box fill --
          slots sit on top of real (often dark) desk photos, and dark-blue
          text over a 20%-opacity tint had no reliable contrast against
          whatever photo pixels happened to be underneath. */}
      <span className="inline-block rounded bg-white dark:bg-neutral-900 px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap text-blue-900 dark:text-blue-200 shadow-sm">
        {slot.label}
      </span>
      <div
        {...handleHandlers}
        className="absolute -bottom-1.5 -right-1.5 h-3 w-3 cursor-nwse-resize touch-none rounded-sm border border-blue-700 dark:border-blue-400 bg-white dark:bg-neutral-900"
      />
    </div>
  );
}
