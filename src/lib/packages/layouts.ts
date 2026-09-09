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
  previewFilter?: string; // optional CSS filter applied to the background (e.g. for a not-yet-art-finished placeholder layout)
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
    label: "Light Oak Desk",
    // Real Recraft-generated background (light natural oak, true top-down
    // shot), produced live with Randy. Unlike desk-v1's full-bleed texture,
    // this image shows a distinct rectangular tabletop with rounded corners
    // and legs visible at the edges, floor visible around it -- so every
    // slot position here is constrained to the actual tabletop area
    // (roughly x: 7-93%, y: 21-80% of the frame), not the full canvas.
    backgroundImage: "/desk-scene/desk-background-v2.webp",
    aspectRatio: "1344 / 768",
    nameplate: { left: "9%", top: "24%", width: "18%", rotate: -3 },
    slots: {
      video: { left: "33%", top: "23%", width: "28%" },
      audio: { left: "10%", top: "44%", width: "14%", rotate: -6 },
      magazine: { left: "9%", top: "58%", width: "13%", rotate: -6 },
      business_card: { left: "70%", top: "58%", width: "12%", rotate: 6 },
    },
  },
];

export function getLayout(templateId: string | null | undefined): DeskLayout {
  return (
    DESK_LAYOUTS.find((l) => l.id === templateId) ??
    DESK_LAYOUTS.find((l) => l.id === DEFAULT_LAYOUT_ID)!
  );
}
