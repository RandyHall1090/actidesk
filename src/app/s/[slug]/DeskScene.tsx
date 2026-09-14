"use client";

import { useRef, useState } from "react";
import { toVimeoEmbedUrl } from "@/lib/vimeo";
import type { DeskLayout, SlotPosition } from "@/lib/packages/layouts";
import type { SlotAsset } from "./PackageView";
import { MagazineSlot, DocumentLink } from "./DocumentViewer";

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-[1.6cqw] w-[1.6cqw]">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-[1.6cqw] w-[1.6cqw]">
      <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
    </svg>
  );
}

/**
 * The audio slot: a photoreal "iPhone playing a voice memo" graphic (a
 * built-in app asset, public/desk-scene/audio-phone.webp -- not a
 * per-tenant uploadable asset, since it's the audio slot's own visual
 * treatment, not content someone picks; every tenant's real audio content
 * still comes from `audio.url` same as before). The graphic's own
 * waveform/play-button/progress bar are a fixed illustration, not live --
 * real playback state is a small corner badge instead of trying to align
 * custom controls on top of specific pixels in an AI-generated image,
 * which would be fragile and image-generation-dependent.
 */
function AudioSlot({
  url,
  style,
  onPlay,
}: {
  url: string;
  style?: React.CSSProperties;
  onPlay: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const playedOnceRef = useRef(false);

  function toggle() {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) el.play();
    else el.pause();
  }

  return (
    <div style={style}>
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause audio message" : "Play audio message"}
        className="relative block aspect-square w-full overflow-hidden rounded-[1cqw] shadow-2xl transition-transform hover:scale-105"
      >
        {/* The source graphic's own canvas is a tall, generously-padded
            product shot (896x1216, lots of surrounding white); cropped to
            square via object-cover instead of shown at its native aspect
            so the slot's on-desk footprint doesn't balloon far past what
            every layout budgeted for this position (verified live against
            all 3 layouts -- an uncropped tall render collided with the
            nameplate/magazine in every one of them). Center crop keeps the
            whole tilted phone in frame; only the excess white margin above
            and below it is trimmed. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- static public asset, not a content image */}
        <img
          src="/desk-scene/audio-phone.webp"
          alt=""
          className="h-full w-full object-cover"
        />
        <span className="absolute right-[6%] bottom-[6%] flex h-[3cqw] w-[3cqw] items-center justify-center rounded-full bg-black/60 text-white">
          {playing ? <PauseIcon /> : <PlayIcon />}
        </span>
      </button>
      <audio
        ref={audioRef}
        src={url}
        className="hidden"
        onPlay={() => {
          setPlaying(true);
          if (!playedOnceRef.current) {
            playedOnceRef.current = true;
            onPlay();
          }
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
    </div>
  );
}

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
    aspectRatio: pos.aspect,
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
 * by comparing against a real TMT output screenshot).
 *
 * On desk-v1/desk-v2, the letter and brochures stay as ordinary readable
 * text/list sections below this photo -- those layouts' desks have no
 * room budgeted for a full page or a row of brochure cards. desk-v3 (and
 * any layout that defines layout.letter/layout.brochures) instead renders
 * them directly on the desk, matching a real TMT reference page that
 * proved this is legible when given proportional space (a full sheet of
 * paper, and a dedicated darker "blotter pad" zone for the brochures) --
 * see PackageView.tsx for the below-fold fallback used when a layout
 * doesn't define these.
 *
 * Which background image and slot positions are used depends on the
 * caller-resolved `layout` (built-in code array, or an org's own saved
 * custom one -- see getOrgLayouts.ts). This component never resolves a
 * template_id itself, so it doesn't care which source a layout came from.
 */
export function DeskScene({
  layout,
  prospectName,
  video,
  video2,
  audio,
  pen,
  businessCard,
  magazine,
  letterBody,
  brochures,
  orgName,
  orgLogoUrl,
  onTrack,
}: {
  layout: DeskLayout;
  prospectName: string;
  video: SlotAsset | undefined;
  video2: SlotAsset | undefined;
  audio: SlotAsset | undefined;
  pen: SlotAsset | undefined;
  businessCard: SlotAsset | undefined;
  magazine: SlotAsset | undefined;
  letterBody: string | null;
  brochures: SlotAsset[];
  orgName: string;
  orgLogoUrl: string | null;
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

      {video2 && layout.slots.video_2 && (
        <div
          style={slotStyle(layout.slots.video_2)}
          className="aspect-video overflow-hidden rounded-[0.8cqw] bg-black shadow-2xl"
        >
          <iframe
            src={toVimeoEmbedUrl(video2.url)}
            className="h-full w-full"
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
            onLoad={() => onTrack("video_2", "asset_opened")}
          />
        </div>
      )}

      {audio && (
        <AudioSlot
          url={audio.url}
          style={slotStyle(layout.slots.audio)}
          onPlay={() => onTrack("audio", "asset_played")}
        />
      )}

      {/* Purely decorative desk prop -- no click handler, matches
          PACKAGE_SLOTS' "pen" comment. Optional like video_2: an older
          layout that doesn't define layout.slots.pen simply renders none. */}
      {pen && layout.slots.pen && (
        // eslint-disable-next-line @next/next/no-img-element -- dynamic signed Storage URL, not a static local asset
        <img
          src={pen.url}
          alt=""
          style={{
            ...slotStyle(layout.slots.pen),
            // Mirrored -- the source photo points the opposite way from
            // how it reads naturally on the desk; flipped once here at the
            // render site rather than re-editing the source asset, so the
            // rotate value from layouts.ts still applies on top of it.
            transform: `scaleX(-1) ${slotStyle(layout.slots.pen).transform ?? ""}`,
          }}
          className="pointer-events-none drop-shadow-2xl"
        />
      )}

      {magazine && magazine.kind === "document" && (
        <MagazineSlot
          url={magazine.url}
          name={magazine.name}
          style={slotStyle(layout.slots.magazine)}
          onOpen={() => onTrack("magazine")}
        />
      )}

      {/* Legacy path for any magazine slot still pointing at a plain image
          asset (kind "image", how this slot used to work before the PDF
          flip-reader) -- kept so an already-sent package with an
          image-based magazine keeps rendering exactly as it always has. */}
      {magazine && magazine.kind !== "document" && (
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

      {layout.letter && letterBody && (
        <div
          style={slotStyle(layout.letter)}
          className="flex flex-col overflow-hidden rounded-[0.4cqw] bg-white p-[1.6cqw] shadow-2xl"
        >
          <div className="mb-[0.8cqw] flex items-center gap-[0.6cqw] border-b border-neutral-200 pb-[0.6cqw]">
            {orgLogoUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- dynamic signed Storage URL, not a static local asset
              <img
                src={orgLogoUrl}
                alt=""
                className="h-[1.8cqw] w-auto object-contain"
              />
            )}
            <span className="text-[0.9cqw] font-semibold text-neutral-700">
              {orgName}
            </span>
          </div>
          {/* Fallback for a letter longer than the paper's fixed space --
              cheapest safety net, not the primary plan (the paper is sized
              generously against the real desk-v3 art first). */}
          <div className="relative flex-1 overflow-y-auto">
            <p className="whitespace-pre-wrap text-[0.85cqw] leading-snug text-neutral-800">
              {letterBody}
            </p>
          </div>
        </div>
      )}

      {layout.brochures &&
        brochures.length > 0 &&
        layout.brochures.map((pos, i) => {
          const slotName = `brochure_${i + 1}`;
          const b = brochures.find((x) => x.slot === slotName);
          if (!b) return null;
          return (
            <DocumentLink
              key={slotName}
              url={b.url}
              name={b.name}
              onOpen={() => onTrack(slotName)}
              style={slotStyle(pos)}
              className="flex flex-col items-center justify-center gap-[0.6cqw] rounded-[0.6cqw] bg-white p-[1.2cqw] text-center shadow-xl ring-1 ring-black/10 transition-transform hover:scale-105"
            >
              {orgLogoUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- dynamic signed Storage URL, not a static local asset
                <img src={orgLogoUrl} alt="" className="h-[2.2cqw] w-auto object-contain" />
              )}
              <span className="line-clamp-2 text-[1.1cqw] font-semibold text-neutral-800">
                {b.name}
              </span>
            </DocumentLink>
          );
        })}
    </div>
  );
}
