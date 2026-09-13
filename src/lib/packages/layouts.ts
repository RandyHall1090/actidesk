export type SlotPosition = {
  left: string; // e.g. "29%"
  top: string;
  width: string;
  rotate?: number; // degrees; sign matches the original Tailwind rotate-N / -rotate-N
  aspect?: string; // CSS aspect-ratio (e.g. "0.77" for a letter-proportioned paper); undefined = auto height, unchanged for every slot that doesn't set it
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
    // Optional -- like letter/brochures, an older or space-constrained
    // layout can omit it and DeskScene simply won't render a second video
    // (see DeskScene.tsx). Every layout as of this writing (desk-v1/v2/v3)
    // defines one, matching the primary video's width where the desk photo
    // has room for it (desk-v1, desk-v2); desk-v3 is already the most
    // content-dense layout (9 items on the desk before this one), so its
    // video_2 is deliberately smaller, sized to the one open pocket left
    // rather than forced to match at the cost of overlapping something.
    video_2?: SlotPosition;
    audio: SlotPosition;
    business_card: SlotPosition;
    magazine: SlotPosition;
  };
  // Only a layout with real estate for these (desk-v3+) sets them -- when
  // absent, PackageView falls back to rendering the letter/brochures as
  // plain sections below the photo instead, exactly as desk-v1/desk-v2 do
  // today.
  letter?: SlotPosition;
  brochures?: SlotPosition[]; // length 4, index i <-> brochure_{i+1}
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
      video_2: { left: "64%", top: "5%", width: "34%" },
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
      video_2: { left: "64%", top: "23%", width: "28%" },
      audio: { left: "10%", top: "44%", width: "14%", rotate: -6 },
      magazine: { left: "9%", top: "58%", width: "13%", rotate: -6 },
      business_card: { left: "70%", top: "58%", width: "12%", rotate: 6 },
    },
  },
  {
    id: "desk-v3",
    label: "Executive Desk (Letter + Brochures)",
    // Real Recraft-generated background: the whole desk in frame (legs
    // visible at the corners, floor around it), with a flat dark-leather
    // blotter-pad strip inlaid across the lower ~20% of the desk -- a
    // distinct, flush, non-embossed zone for the 4 brochure cards, leaving
    // the open wood above it (~y 17%-50%) for nameplate/video/audio/
    // magazine/business_card plus the letter. That open band is shorter
    // than desk-v1's, so the letter is sized to fit it directly rather
    // than assumed to be full-page-sized -- its overflow-y-auto fallback
    // (DeskScene.tsx) is the expected path for a longer letter, not just a
    // theoretical safety net.
    backgroundImage: "/desk-scene/desk-background-v3.webp",
    aspectRatio: "1344 / 768",
    nameplate: { left: "6%", top: "19%", width: "13%", rotate: -3 },
    slots: {
      video: { left: "20%", top: "19%", width: "18%" },
      // Smaller than the primary video -- desk-v3 is already the fullest
      // layout (9 items before this one); this is the one open pocket left
      // (below Audio, above the brochures' blotter row), found and verified
      // live via the Layout Designer, not a guessed value.
      video_2: { left: "17%", top: "43%", width: "10%" },
      audio: { left: "6%", top: "33%", width: "10%", rotate: -6 },
      magazine: { left: "68%", top: "19%", width: "11%", rotate: -6 },
      business_card: { left: "80%", top: "20%", width: "10%", rotate: 6 },
    },
    // Wider/shorter (landscape-ish) rather than strictly letter-proportioned
    // -- cqw sizing is relative to the whole scene's width, so a wider box
    // fits dramatically more characters per line without changing font
    // size, which matters far more for real legibility than matching a
    // literal sheet-of-paper aspect ratio.
    letter: { left: "40%", top: "19%", width: "26%", aspect: "1.5" },
    brochures: [
      { left: "12%", top: "54%", width: "17%" },
      { left: "31%", top: "54%", width: "17%" },
      { left: "50%", top: "54%", width: "17%" },
      { left: "69%", top: "54%", width: "17%" },
    ],
  },
];

export function getLayout(templateId: string | null | undefined): DeskLayout {
  return (
    DESK_LAYOUTS.find((l) => l.id === templateId) ??
    DESK_LAYOUTS.find((l) => l.id === DEFAULT_LAYOUT_ID)!
  );
}
