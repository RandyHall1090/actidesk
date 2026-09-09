export type SlotPosition = {
  left: string; // e.g. "29%"
  top: string;
  width: string;
  rotate?: number; // degrees; sign matches the original Tailwind rotate-N / -rotate-N
};

export type DeskLayout = {
  id: string; // matches packages.template_id
  label: string; // shown in the layout picker
  backgroundImage: string;
  aspectRatio: string;
  previewFilter?: string; // CSS filter applied to the background; desk-v2 placeholder only
  nameplate: SlotPosition;
  slots: {
    video: SlotPosition;
    audio: SlotPosition;
    business_card: SlotPosition;
    magazine: SlotPosition;
  };
};

export const DEFAULT_LAYOUT_ID = "desk-v1";

// The set of selectable desk-scene layouts (T3 + Templates feature). Kept
// as a plain code array, not a DB table -- every layout is inseparable from
// a committed static image and hand-tuned positions, so adding one always
// requires a code change + deploy regardless of who's "admin" in the app.
export const DESK_LAYOUTS: DeskLayout[] = [
  {
    id: "desk-v1",
    label: "Classic Desk",
    backgroundImage: "/desk-scene/desk-background.webp",
    aspectRatio: "1344 / 768",
    nameplate: { left: "3%", top: "6%", width: "23%", rotate: -3 },
    slots: {
      video: { left: "29%", top: "5%", width: "34%" },
      audio: { left: "6%", top: "26%", width: "17%", rotate: -6 },
      magazine: { left: "2%", top: "54%", width: "17%", rotate: -6 },
      business_card: { left: "68%", top: "57%", width: "15%", rotate: 6 },
    },
  },
  {
    id: "desk-v2",
    label: "Desk v2 (Preview — art pending)",
    // Reuses desk-v1's background + geometry with a visible filter so the
    // layout-selection mechanism is genuinely exercised end-to-end without
    // fabricating art. Real next step: a live Recraft-generation session
    // with Randy (same iterative process documented in spec/plan.md under
    // "T3 desk-scene art") to produce the actual background, then replace
    // backgroundImage/previewFilter/slots below with the real values.
    backgroundImage: "/desk-scene/desk-background.webp",
    previewFilter: "grayscale(0.5) sepia(0.3)",
    aspectRatio: "1344 / 768",
    nameplate: { left: "3%", top: "6%", width: "23%", rotate: -3 },
    slots: {
      video: { left: "29%", top: "5%", width: "34%" },
      audio: { left: "6%", top: "26%", width: "17%", rotate: -6 },
      magazine: { left: "2%", top: "54%", width: "17%", rotate: -6 },
      business_card: { left: "68%", top: "57%", width: "15%", rotate: 6 },
    },
  },
];

export function getLayout(templateId: string | null | undefined): DeskLayout {
  return (
    DESK_LAYOUTS.find((l) => l.id === templateId) ??
    DESK_LAYOUTS.find((l) => l.id === DEFAULT_LAYOUT_ID)!
  );
}
