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
    // Optional decorative prop (a pen resting on the desk) -- same
    // optional-slot pattern as video_2, an older layout simply doesn't
    // define a position for it and DeskScene won't render one.
    pen?: SlotPosition;
    // A second, third, and fourth magazine/feature cover, same
    // optional-slot pattern as video_2/pen -- not every layout has room
    // for all of them (desk-v3 already tops out at Magazine 2), smaller
    // than the primary magazine where a layout's remaining open pockets
    // demand it (see DeskScene.tsx for the shared rendering).
    magazine_2?: SlotPosition;
    magazine_3?: SlotPosition;
    magazine_4?: SlotPosition;
    // Three plain clickable book photos -- same optional-slot pattern as
    // video_2/pen/magazine_2-4. No built-in layout below defines a
    // position for these yet (no real desk photo has been checked for a
    // clear pocket); an org's own admin positions them per layout via the
    // Layout Designer, or a developer adds a real position to DESK_LAYOUTS
    // below, once there's room.
    book_image_1?: SlotPosition;
    book_image_2?: SlotPosition;
    book_image_3?: SlotPosition;
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
      // Width kept smaller than the old plain-audio-bar slot (was 17%) --
      // the iPhone-graphic AudioSlot is a square crop, and 17% would push
      // its bottom edge into the magazine slot below (verified live).
      audio: { left: "6%", top: "26%", width: "13%", rotate: -6 },
      // aspect 0.77 on every magazine slot (real page proportion, matches
      // MagazineSlot's own loading/error placeholder) -- without it, the
      // on-desk cover's height comes from whatever the *actual* uploaded
      // PDF's own page shape is (a real one found live: "MSP Success
      // Magazine" rendered tall enough to swallow magazine_2's position
      // entirely, even though the two boxes' own nominal positions never
      // overlapped). Bounding every magazine box the same way brochures
      // already are makes the footprint predictable regardless of which
      // real document a rep picks.
      magazine: { left: "2%", top: "54%", width: "17%", rotate: -6, aspect: "0.77" },
      // Between the pen and business_card, clear of video_2 above.
      magazine_2: { left: "53%", top: "44%", width: "12%", rotate: 6, aspect: "0.77" },
      // Below business_card, right of the pen.
      magazine_3: { left: "70%", top: "74%", width: "10%", rotate: -6, aspect: "0.77" },
      // Far right column, clear of magazine_3 and business_card's own
      // x-ranges entirely (found live via real bounding boxes -- neither
      // slot reaches past ~83% left).
      magazine_4: { left: "85%", top: "46%", width: "14%", rotate: 6, aspect: "0.77" },
      business_card: { left: "68%", top: "57%", width: "15%", rotate: 6 },
      // Three side-by-side in the open pocket below video and right of
      // audio, above the pen -- real bounding boxes confirmed live via a
      // fully-populated test package (first attempt at top:"27%" looked
      // clear by eye but real boxes showed it overlapping video's own
      // footprint, which extends to x:63%/y:38.5%; corrected to start
      // below video's bottom edge instead).
      book_image_1: { left: "22%", top: "41%", width: "8%", rotate: -6, aspect: "0.77" },
      book_image_2: { left: "32%", top: "41%", width: "8%", rotate: 6, aspect: "0.77" },
      book_image_3: { left: "42%", top: "41%", width: "8%", rotate: -6, aspect: "0.77" },
      // Open middle-bottom area, clear of every other slot.
      pen: { left: "38%", top: "68%", width: "12%", rotate: -20 },
    },
  },
  {
    id: "desk-oak",
    label: "Light Oak Desk",
    // Real Recraft-generated background, full-bleed like desk-v1 (no floor,
    // legs, or other objects visible -- fills the entire frame edge to
    // edge), per the request for more full-bleed layout options. Same
    // canvas shape as desk-v1 (1344x768), so its slot positions are reused
    // here as a starting point rather than re-derived from scratch --
    // refine live via the Layout Designer if any slot needs nudging against
    // this specific wood grain (e.g. a highlight streak behind a slot).
    backgroundImage: "/desk-scene/desk-background-oak.webp",
    aspectRatio: "1344 / 768",
    nameplate: { left: "3%", top: "6%", width: "23%", rotate: -3 },
    slots: {
      video: { left: "29%", top: "5%", width: "34%" },
      video_2: { left: "64%", top: "5%", width: "34%" },
      audio: { left: "6%", top: "26%", width: "13%", rotate: -6 },
      magazine: { left: "2%", top: "54%", width: "17%", rotate: -6, aspect: "0.77" },
      magazine_2: { left: "53%", top: "44%", width: "12%", rotate: 6, aspect: "0.77" },
      magazine_3: { left: "70%", top: "74%", width: "10%", rotate: -6, aspect: "0.77" },
      magazine_4: { left: "85%", top: "46%", width: "14%", rotate: 6, aspect: "0.77" },
      business_card: { left: "68%", top: "57%", width: "15%", rotate: 6 },
      book_image_1: { left: "22%", top: "41%", width: "8%", rotate: -6, aspect: "0.77" },
      book_image_2: { left: "32%", top: "41%", width: "8%", rotate: 6, aspect: "0.77" },
      book_image_3: { left: "42%", top: "41%", width: "8%", rotate: -6, aspect: "0.77" },
      pen: { left: "38%", top: "68%", width: "12%", rotate: -20 },
    },
  },
];

export function getLayout(templateId: string | null | undefined): DeskLayout {
  return (
    DESK_LAYOUTS.find((l) => l.id === templateId) ??
    DESK_LAYOUTS.find((l) => l.id === DEFAULT_LAYOUT_ID)!
  );
}
