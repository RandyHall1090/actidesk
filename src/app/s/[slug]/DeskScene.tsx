"use client";

import { toVimeoEmbedUrl } from "@/lib/vimeo";
import { getLayout, type SlotPosition } from "@/lib/packages/layouts";
import type { SlotAsset } from "./PackageView";

// Layout positions come from a per-template config (src/lib/packages/layouts.ts)
// as inline styles rather than Tailwind arbitrary-value classes -- Tailwind v4
// statically scans source for literal class strings, so a class built at
// runtime (e.g. `left-[${pos.left}]`) wouldn't exist in the compiled CSS and
// would silently render unpositioned. Every other class (radius, shadow,
// ring, font-size -- all cqw-based) stays a static literal class exactly as
// before, since none of that varies by layout.
function slotStyle(pos: SlotPosition): React.CSSProperties {
  return {
    position: "absolute",
    left: pos.left,
    top: pos.top,
    width: pos.width,
    transform: pos.rotate ? `rotate(${pos.rotate}deg)` : undefined,
  };
}

/**
 * The photoreal desk-scene hero (T3): a background photo of an empty desk
 * with the compact, inherently visual content — nameplate, video, audio,
 * business card, magazine — placed on top as flat rotated cards with drop
 * shadows, matching how TMT's actual rendered output looks (not the
 * perspective-warped trapezoids shown in TMT's *builder* UI, which turned
 * out to be placement guides, not the real rendering technique — confirmed
 * by comparing against a real TMT output screenshot). The letter and
 * brochures stay as ordinary readable text/list sections below this —
 * cramming paragraph text into a small on-photo box wasn't legible at any
 * reasonable scale.
 *
 * Which background image and slot positions are used depends on
 * `templateId` (the Templates feature) — see getLayout().
 */
export function DeskScene({
  templateId,
  prospectName,
  video,
  audio,
  businessCard,
  magazine,
  onTrack,
}: {
  templateId: string;
  prospectName: string;
  video: SlotAsset | undefined;
  audio: SlotAsset | undefined;
  businessCard: SlotAsset | undefined;
  magazine: SlotAsset | undefined;
  onTrack: (slot: string, kind?: "asset_opened" | "asset_played") => void;
}) {
  const layout = getLayout(templateId);
  return (
    // @container: every size below is in cqw (% of this container's own
    // rendered width), not px/rem, so the whole scene -- text included --
    // scales down together on narrow screens instead of the fixed-size
    // nameplate/audio text overflowing their slots and colliding once the
    // container shrinks faster than fixed px content can.
    <div
      className="@container relative w-full overflow-hidden rounded-lg shadow-2xl"
      style={{ aspectRatio: layout.aspectRatio }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- static public asset used as a full-bleed background, not a content image */}
      <img
        src={layout.backgroundImage}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        style={layout.previewFilter ? { filter: layout.previewFilter } : undefined}
      />

      <div
        style={slotStyle(layout.nameplate)}
        className="rounded-[1.2cqw] bg-neutral-900/95 px-[1.2cqw] py-[1cqw] text-center shadow-xl"
      >
        <p className="text-[1.4cqw] uppercase tracking-wide text-neutral-400">
          Customized for the desk of
        </p>
        <p className="truncate text-[2.2cqw] font-semibold text-white">
          {prospectName}
        </p>
      </div>

      {video && (
        <div
          style={slotStyle(layout.slots.video)}
          className="aspect-video overflow-hidden rounded-[0.8cqw] bg-black shadow-2xl"
        >
          <iframe
            src={toVimeoEmbedUrl(video.url)}
            className="h-full w-full"
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
            onLoad={() => onTrack("video", "asset_opened")}
          />
        </div>
      )}

      {audio && (
        <div
          style={slotStyle(layout.slots.audio)}
          className="rounded-[1cqw] bg-neutral-900 p-[0.6cqw] shadow-xl"
        >
          <audio
            controls
            src={audio.url}
            className="w-full"
            style={{ height: "4.5cqw" }}
            onPlay={() => onTrack("audio", "asset_played")}
          />
        </div>
      )}

      {magazine && (
        <a
          href={magazine.url}
          target="_blank"
          rel="noreferrer"
          onClick={() => onTrack("magazine")}
          style={slotStyle(layout.slots.magazine)}
          className="overflow-hidden rounded-[0.6cqw] shadow-2xl ring-1 ring-black/10 transition-transform hover:scale-105"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- dynamic signed Storage URL, not a static local asset */}
          <img src={magazine.url} alt="Magazine feature" className="w-full" />
        </a>
      )}

      {businessCard && (
        <a
          href={businessCard.url}
          target="_blank"
          rel="noreferrer"
          onClick={() => onTrack("business_card")}
          style={slotStyle(layout.slots.business_card)}
          className="overflow-hidden rounded-[0.6cqw] shadow-2xl ring-1 ring-black/10 transition-transform hover:scale-105"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- dynamic signed Storage URL, not a static local asset */}
          <img
            src={businessCard.url}
            alt="Business card"
            className="w-full"
          />
        </a>
      )}
    </div>
  );
}
