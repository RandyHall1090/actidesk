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
  // "document" (a PDF), not "image" -- the magazine is a real page-by-page
  // flip-reader (see DeskScene.tsx's MagazineSlot), not a single cover
  // photo. A pre-existing image-kind magazine asset already attached to a
  // real package still renders (DeskScene branches on the asset's own
  // .kind, not this registry), it's just no longer offered when picking a
  // *new* one.
  { slot: "magazine", label: "Magazine / Feature", kind: "document" },
  { slot: "brochure_1", label: "Brochure 1", kind: "document" },
  { slot: "brochure_2", label: "Brochure 2", kind: "document" },
  { slot: "brochure_3", label: "Brochure 3", kind: "document" },
  { slot: "brochure_4", label: "Brochure 4", kind: "document" },
];
