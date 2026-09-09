"use client";

import { toVimeoEmbedUrl } from "@/lib/vimeo";
import type { SlotAsset } from "./PackageView";

/**
 * The photoreal desk-scene hero (T3): a background photo of an empty desk
 * (public/desk-scene/desk-background.jpg) with the compact, inherently
 * visual content — nameplate, video, audio, business card, magazine —
 * placed on top as flat rotated cards with drop shadows, matching how
 * TMT's actual rendered output looks (not the perspective-warped trapezoids
 * shown in TMT's *builder* UI, which turned out to be placement guides, not
 * the real rendering technique — confirmed by comparing against a real TMT
 * output screenshot). The letter and brochures stay as ordinary readable
 * text/list sections below this — cramming paragraph text into a small
 * on-photo box wasn't legible at any reasonable scale.
 */
export function DeskScene({
  prospectName,
  video,
  audio,
  businessCard,
  magazine,
  onTrack,
}: {
  prospectName: string;
  video: SlotAsset | undefined;
  audio: SlotAsset | undefined;
  businessCard: SlotAsset | undefined;
  magazine: SlotAsset | undefined;
  onTrack: (slot: string, kind?: "asset_opened" | "asset_played") => void;
}) {
  return (
    // @container: every size below is in cqw (% of this container's own
    // rendered width), not px/rem, so the whole scene -- text included --
    // scales down together on narrow screens instead of the fixed-size
    // nameplate/audio text overflowing their slots and colliding once the
    // container shrinks faster than fixed px content can.
    <div
      className="@container relative w-full overflow-hidden rounded-lg shadow-2xl"
      style={{ aspectRatio: "1344 / 768" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- static public asset used as a full-bleed background, not a content image */}
      <img
        src="/desk-scene/desk-background.webp"
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
      />

      <div className="absolute left-[3%] top-[6%] w-[23%] -rotate-3 rounded-[1.2cqw] bg-neutral-900/95 px-[1.2cqw] py-[1cqw] text-center shadow-xl">
        <p className="text-[1.4cqw] uppercase tracking-wide text-neutral-400">
          Customized for the desk of
        </p>
        <p className="truncate text-[2.2cqw] font-semibold text-white">
          {prospectName}
        </p>
      </div>

      {video && (
        <div className="absolute left-[29%] top-[5%] aspect-video w-[34%] overflow-hidden rounded-[0.8cqw] bg-black shadow-2xl">
          <iframe
            src={toVimeoEmbedUrl(video.url)}
            className="h-full w-full"
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
            onLoad={() => onTrack("video", "asset_opened")}
          />
        </div>
      )}

      {audio && (
        <div className="absolute left-[6%] top-[26%] w-[17%] -rotate-6 rounded-[1cqw] bg-neutral-900 p-[0.6cqw] shadow-xl">
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
          className="absolute left-[2%] top-[54%] w-[17%] -rotate-6 overflow-hidden rounded-[0.6cqw] shadow-2xl ring-1 ring-black/10 transition-transform hover:scale-105"
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
          className="absolute left-[68%] top-[57%] w-[15%] rotate-6 overflow-hidden rounded-[0.6cqw] shadow-2xl ring-1 ring-black/10 transition-transform hover:scale-105"
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
