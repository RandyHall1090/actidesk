import type { DeskLayout, SlotPosition } from "@/lib/packages/layouts";

export type SlotId =
  | "nameplate"
  | "video"
  | "video_2"
  | "audio"
  | "pen"
  | "business_card"
  | "magazine"
  | "magazine_2"
  | "magazine_3"
  | "letter"
  | "brochure_1"
  | "brochure_2"
  | "brochure_3"
  | "brochure_4";

export type DesignerSlotState = SlotPosition & {
  id: SlotId;
  label: string;
  optional: boolean;
};

type SlotDef = { id: SlotId; label: string; optional: boolean };

const SLOT_DEFS: SlotDef[] = [
  { id: "nameplate", label: "Nameplate", optional: false },
  { id: "video", label: "Video", optional: false },
  { id: "video_2", label: "Video 2", optional: true },
  { id: "audio", label: "Audio", optional: false },
  { id: "pen", label: "Pen", optional: true },
  { id: "magazine", label: "Magazine 1", optional: false },
  { id: "magazine_2", label: "Magazine 2", optional: true },
  { id: "magazine_3", label: "Magazine 3", optional: true },
  { id: "business_card", label: "Business Card", optional: false },
  { id: "letter", label: "Letter", optional: true },
  { id: "brochure_1", label: "Brochure 1", optional: true },
  { id: "brochure_2", label: "Brochure 2", optional: true },
  { id: "brochure_3", label: "Brochure 3", optional: true },
  { id: "brochure_4", label: "Brochure 4", optional: true },
];

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function roundPct(n: number): string {
  return `${Math.round(n)}%`;
}

/**
 * Cosmetic-only box proportions for the canvas -- SlotPosition has no real
 * height field for any slot (height is either aspect-driven or
 * content-auto in the real DeskScene render), so these are just
 * approximations to make the placeholder boxes look roughly right while
 * dragging. Never exported as part of the layout data.
 */
export const DEFAULT_PREVIEW_ASPECT: Partial<Record<SlotId, number>> = {
  video: 16 / 9,
  video_2: 16 / 9,
  business_card: 1.6,
  letter: 1.5,
  // Matches MagazineSlot's real aspect-[0.77] (DocumentViewer.tsx) -- a
  // book/magazine-cover proportion, not a video/card shape.
  magazine: 0.77,
  magazine_2: 0.77,
  magazine_3: 0.77,
};

/** A blank starting layout: cascades the 10 boxes so they don't all spawn stacked and unreachable. */
export function blankSlots(): DesignerSlotState[] {
  return SLOT_DEFS.map((def, i) => ({
    ...def,
    left: `${5 + (i % 5) * 18}%`,
    top: `${10 + Math.floor(i / 5) * 40}%`,
    width: "15%",
    ...(def.id === "letter" ? { aspect: "1.5" } : {}),
  }));
}

/** Loads an existing DeskLayout's real positions into the flat 10-slot array, for refining. */
export function fromDeskLayout(layout: DeskLayout): DesignerSlotState[] {
  const fallback = blankSlots();
  const brochures = layout.brochures ?? [];
  return SLOT_DEFS.map((def, i) => {
    let pos: SlotPosition | undefined;
    if (def.id === "nameplate") pos = layout.nameplate;
    else if (def.id === "letter") pos = layout.letter;
    else if (def.id.startsWith("brochure_")) {
      const n = Number(def.id.split("_")[1]);
      pos = brochures[n - 1];
    } else {
      pos = layout.slots[def.id as keyof DeskLayout["slots"]];
    }
    return pos ? { ...pos, ...def } : fallback[i];
  });
}
