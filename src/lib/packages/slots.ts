import type { AssetKind } from "@/lib/assets/types";

export type PackageSlot = {
  slot: string;
  label: string;
  kind: AssetKind;
};

// The v1 desk-scene template's fixed set of content slots (see PRD.md /
// spec/plan.md — "desk-v1" template). Adding a slot here means also adding
// its overlay position in the public renderer (T5/T3).
export const PACKAGE_SLOTS: PackageSlot[] = [
  { slot: "video", label: "Video", kind: "video" },
  { slot: "video_2", label: "Video 2", kind: "video" },
  { slot: "audio", label: "Audio Message", kind: "audio" },
  { slot: "business_card", label: "Business Card", kind: "business_card" },
  // Purely decorative desk dressing -- no click behavior (DeskScene.tsx
  // renders it as a plain image, unlike every other slot here). "Show/hide
  // per package" falls out of the existing optional-slot mechanism: picking
  // one shows it, leaving it blank doesn't -- no separate boolean needed.
  { slot: "pen", label: "Pen", kind: "pen" },
  // "document" (a PDF), not "image" -- the magazine is a real page-by-page
  // flip-reader (see DeskScene.tsx's MagazineSlot), not a single cover
  // photo. A pre-existing image-kind magazine asset already attached to a
  // real package still renders (DeskScene branches on the asset's own
  // .kind, not this registry), it's just no longer offered when picking a
  // *new* one. The slot key stays "magazine" (not "magazine_1") even
  // though its label is now "Magazine 1" -- every already-sent package's
  // package_assets row already uses this key, and renaming the key itself
  // would require a data migration for zero real benefit (the label is
  // display-only).
  { slot: "magazine", label: "Magazine 1", kind: "document" },
  { slot: "magazine_2", label: "Magazine 2", kind: "document" },
  { slot: "magazine_3", label: "Magazine 3", kind: "document" },
  { slot: "magazine_4", label: "Magazine 4", kind: "document" },
  { slot: "brochure_1", label: "Brochure 1", kind: "document" },
  { slot: "brochure_2", label: "Brochure 2", kind: "document" },
  { slot: "brochure_3", label: "Brochure 3", kind: "document" },
  { slot: "brochure_4", label: "Brochure 4", kind: "document" },
  // Plain photos of a physical book (kind "image", not "document" -- a
  // single picture, not a page-by-page PDF like magazine/brochure).
  // Clickable like business_card: opens the full image in a new tab, no
  // PDF reader involved.
  { slot: "book_image_1", label: "Book Image 1", kind: "image" },
  { slot: "book_image_2", label: "Book Image 2", kind: "image" },
  { slot: "book_image_3", label: "Book Image 3", kind: "image" },
];
