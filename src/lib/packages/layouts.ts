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
      // Narrower than desk-v1's -- this pocket (between the nameplate and
      // magazine) is shorter here, so the square AudioSlot needs a smaller
      // width to keep its bottom edge clear of the magazine (verified live).
      audio: { left: "10%", top: "44%", width: "6%", rotate: -6 },
      // aspect 0.77 on every magazine slot -- see desk-v1's own comment on
      // this: without it, an on-desk cover's real height depends on the
      // actual uploaded PDF's own page shape, not this box's own budget.
      magazine: { left: "9%", top: "58%", width: "13%", rotate: -6, aspect: "0.77" },
      // Right of magazine 1, clear of the pen in the middle.
      magazine_2: { left: "27%", top: "58%", width: "9%", rotate: -6, aspect: "0.77" },
      // Narrow open column right of video_2/business_card, at the edge of
      // the real tabletop (this layout's usable area stops around y 80%).
      magazine_3: { left: "83%", top: "53%", width: "11%", rotate: 6, aspect: "0.77" },
      business_card: { left: "70%", top: "58%", width: "12%", rotate: 6 },
      // Two side by side in the open pocket between the pen and
      // business_card, below video_2 (confirmed live via real bounding
      // boxes). No clean third pocket exists on this layout without either
      // shrinking an already-tuned element or a sliver too narrow to read
      // as a real image -- same "flag it, don't force it" call as T27 made
      // for Magazine 3 on desk-v3; book_image_3 is simply unavailable here.
      book_image_1: { left: "55%", top: "52%", width: "5.5%", rotate: -6, aspect: "0.77" },
      book_image_2: { left: "62%", top: "52%", width: "5.5%", rotate: 6, aspect: "0.77" },
      // Open middle-bottom area of the tabletop, between magazine and
      // business_card, below the video row.
      pen: { left: "42%", top: "62%", width: "10%", rotate: -20 },
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
      // top moved down from the nameplate's own original 33% (the
      // 3-line-wrapped nameplate label in this layout's narrow column
      // extends past that -- measured live at ~40%) and width shrunk for
      // the square AudioSlot's smaller footprint budget in this pocket,
      // clear of both the nameplate above and the brochures row below --
      // both verified live via real element bounding boxes, not eyeballed.
      audio: { left: "6%", top: "42%", width: "6%", rotate: -6 },
      // aspect 0.77 -- see desk-v1's comment on this: without a bounded
      // aspect, magazine's on-desk height depends on the real uploaded
      // PDF's own page shape, not this box's nominal budget. That's what
      // actually broke magazine_2 below at first: a taller-than-assumed
      // real magazine cover swallowed magazine_2's original position even
      // though the two positions' own numbers never overlapped on paper.
      magazine: { left: "68%", top: "19%", width: "11%", rotate: -6, aspect: "0.77" },
      // Below business_card, right of magazine -- the pocket directly
      // under magazine (its old spot) is too short once magazine's own
      // height is properly bounded (54% brochures row minus magazine's own
      // bottom at 44% leaves only ~10%, not enough even at this slot's
      // minimum useful width). No magazine_3 on this layout at all --
      // there simply isn't a third pocket left that doesn't look cramped;
      // same optional-slot pattern as video_2/pen, just the first slot
      // dense enough to hit that ceiling (confirmed with Randy rather than
      // forced in).
      magazine_2: { left: "80%", top: "32%", width: "9%", rotate: 6, aspect: "0.77" },
      business_card: { left: "80%", top: "20%", width: "10%", rotate: 6 },
      // Moved into the narrow gap between the nameplate and the audio
      // phone/second video (was in magazine_2's now pocket, above) -- its
      // bounding box technically grazes the nameplate's corner here
      // (confirmed live), but the pen photo's own transparent margin means
      // the visible ink doesn't actually touch it or the nameplate text --
      // judged by eye at real size, not just by box math, the same way a
      // document cover (solid white, no forgiving transparency) couldn't.
      pen: { left: "14%", top: "37%", width: "5%", rotate: -20 },
    },
    // Wider/shorter (landscape-ish) rather than strictly letter-proportioned
    // -- cqw sizing is relative to the whole scene's width, so a wider box
    // fits dramatically more characters per line without changing font
    // size, which matters far more for real legibility than matching a
    // literal sheet-of-paper aspect ratio.
    letter: { left: "40%", top: "19%", width: "26%", aspect: "1.5" },
    // aspect 0.77 (matches the magazine cover's real page proportion) gives
    // each brochure real page-like height instead of a tiny content-hugging
    // button -- previously there was no aspect at all, so the box just
    // hugged its logo+title tightly and "centered vs. near the top" looked
    // identical (confirmed live: zero slack space either way). See
    // DeskScene.tsx's brochure card for how the logo/title are positioned
    // within this taller box.
    brochures: [
      { left: "12%", top: "54%", width: "17%", aspect: "0.77" },
      { left: "31%", top: "54%", width: "17%", aspect: "0.77" },
      { left: "50%", top: "54%", width: "17%", aspect: "0.77" },
      { left: "69%", top: "54%", width: "17%", aspect: "0.77" },
    ],
  },
];

export function getLayout(templateId: string | null | undefined): DeskLayout {
  return (
    DESK_LAYOUTS.find((l) => l.id === templateId) ??
    DESK_LAYOUTS.find((l) => l.id === DEFAULT_LAYOUT_ID)!
  );
}
