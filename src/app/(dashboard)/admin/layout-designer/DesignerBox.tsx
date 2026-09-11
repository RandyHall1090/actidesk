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
  return {
    position: "absolute",
    left: pos.left,
    top: pos.top,
    width: pos.width,
    aspectRatio: pos.aspect ?? DEFAULT_PREVIEW_ASPECT[(pos as DesignerSlotState).id],
    transform: pos.rotate ? `rotate(${pos.rotate}deg)` : undefined,
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
      className="touch-none cursor-move select-none rounded border-2 border-dashed border-blue-500 bg-blue-500/20 px-1 py-0.5 text-center text-[11px] font-medium text-blue-900 shadow"
    >
      {slot.label}
      <div
        {...handleHandlers}
        className="absolute -bottom-1.5 -right-1.5 h-3 w-3 cursor-nwse-resize touch-none rounded-sm border border-blue-700 bg-white"
      />
    </div>
  );
}
