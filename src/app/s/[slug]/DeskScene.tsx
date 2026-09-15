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
        className="relative block h-full w-full overflow-hidden rounded-[1cqw] shadow-2xl transition-transform hover:scale-105"
      >
        {/* The source graphic's own canvas is a tall, generously-padded
            product shot (896x1216, lots of surrounding white); cropped via
            object-cover to whatever aspect this slot is given (layouts.ts,
            or the Layout Designer's own Aspect field -- square by default,
            same as every layout shipped before this fix, but adjustable
            now, unlike before when this was hardcoded to aspect-square
            regardless of what the Designer's Aspect field said). Center
            crop keeps the whole tilted phone in frame at any reasonable
            aspect; only the excess white margin above and below it is
            trimmed first. */}
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

// A brochure's own content (logo + title) should start about a third of
// the way down its now page-shaped box (aspect set in layouts.ts), not be
// vertically centered. Percentage padding always resolves against the
// containing block's width (the whole scene here), never the padded
// element's own width, so a plain Tailwind `pt-[N%]` class can't express
// "a third of *this slot's* height" -- it has to be computed per slot from
// that slot's own width/aspect, same as slotStyle does for everything else.
function brochureTopPadding(pos: SlotPosition): string | undefined {
  if (!pos.aspect) return undefined;
  const widthPct = parseFloat(pos.width);
  const aspect = parseFloat(pos.aspect);
  if (!widthPct || !aspect) return undefined;
  return `${((widthPct / aspect) * (1 / 3)).toFixed(2)}%`;
}

// The audio slot's button fills its wrapper with h-full/w-full (so any
// aspect actually takes effect -- see AudioSlot below), which only works
// if the wrapper resolves to a real height. A non-numeric aspect value --
// "auto" is a real one someone might type into the Layout Designer,
// expecting "size itself naturally" -- sets no height at all here (there's
// no intrinsic image directly establishing one, unlike e.g. the business
// card's plain <img>), collapsing the box to nothing. Falls back to a
// square, the same default every layout had before aspect was adjustable.
function resolveAudioAspect(aspect: string | undefined): string {
  const parsed = aspect ? parseFloat(aspect) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? aspect! : "1";
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
  magazine2,
  magazine3,
  magazine4,
  bookImage1,
  bookImage2,
  bookImage3,
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
  magazine2: SlotAsset | undefined;
  magazine3: SlotAsset | undefined;
  magazine4: SlotAsset | undefined;
  bookImage1: SlotAsset | undefined;
  bookImage2: SlotAsset | undefined;
  bookImage3: SlotAsset | undefined;
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
          // Square by default (every layout shipped before this fix has no
          // aspect set for audio and relied on that default), but a real,
          // adjustable value now -- previously the button underneath this
          // ignored pos.aspect entirely and always forced a square crop, so
          // the Layout Designer's Aspect field for this slot did nothing.
          style={{ ...slotStyle(layout.slots.audio), aspectRatio: resolveAudioAspect(layout.slots.audio.aspect) }}
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

      {/* Magazine 2/3 -- same optional-slot pattern as video_2/pen, and no
          legacy image-kind branch needed (unlike Magazine 1): these slots
          never existed before "document" was the only kind offered for
          them, so there's no pre-existing image-based asset to stay
          backward-compatible with. */}
      {magazine2 && layout.slots.magazine_2 && (
        <MagazineSlot
          url={magazine2.url}
          name={magazine2.name}
          style={slotStyle(layout.slots.magazine_2)}
          onOpen={() => onTrack("magazine_2")}
        />
      )}

      {magazine3 && layout.slots.magazine_3 && (
        <MagazineSlot
          url={magazine3.url}
          name={magazine3.name}
          style={slotStyle(layout.slots.magazine_3)}
          onOpen={() => onTrack("magazine_3")}
        />
      )}

      {magazine4 && layout.slots.magazine_4 && (
        <MagazineSlot
          url={magazine4.url}
          name={magazine4.name}
          style={slotStyle(layout.slots.magazine_4)}
          onOpen={() => onTrack("magazine_4")}
        />
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

      {/* Plain clickable book photos -- optional, like magazine_2/3/4: only
          rendered once a layout actually defines a position for them. */}
      {bookImage1 && layout.slots.book_image_1 && (
        <a
          href={bookImage1.url}
          target="_blank"
          rel="noreferrer"
          onClick={() => onTrack("book_image_1")}
          style={slotStyle(layout.slots.book_image_1)}
          className="overflow-hidden rounded-[0.6cqw] shadow-2xl ring-1 ring-black/10 transition-transform hover:scale-105"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- dynamic signed Storage URL, not a static local asset */}
          <img src={bookImage1.url} alt="Book image 1" className="w-full" />
        </a>
      )}

      {bookImage2 && layout.slots.book_image_2 && (
        <a
          href={bookImage2.url}
          target="_blank"
          rel="noreferrer"
          onClick={() => onTrack("book_image_2")}
          style={slotStyle(layout.slots.book_image_2)}
          className="overflow-hidden rounded-[0.6cqw] shadow-2xl ring-1 ring-black/10 transition-transform hover:scale-105"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- dynamic signed Storage URL, not a static local asset */}
          <img src={bookImage2.url} alt="Book image 2" className="w-full" />
        </a>
      )}

      {bookImage3 && layout.slots.book_image_3 && (
        <a
          href={bookImage3.url}
          target="_blank"
          rel="noreferrer"
          onClick={() => onTrack("book_image_3")}
          style={slotStyle(layout.slots.book_image_3)}
          className="overflow-hidden rounded-[0.6cqw] shadow-2xl ring-1 ring-black/10 transition-transform hover:scale-105"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- dynamic signed Storage URL, not a static local asset */}
          <img src={bookImage3.url} alt="Book image 3" className="w-full" />
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
              // A computed inline paddingTop (not justify-center, and not a
              // Tailwind pt-[N%] class) puts the logo/title about a third
              // of the way down this page-shaped box, not dead center --
              // CSS resolves percentage padding against the CONTAINING
              // BLOCK's width (the whole desk scene here), never the
              // element's own width, even for padding-top. A static class
              // can't get this right for an arbitrary slot width, so it's
              // computed the same way slotStyle derives everything else:
              // relative to this specific slot's own width and aspect.
              style={{ ...slotStyle(pos), paddingTop: brochureTopPadding(pos) }}
              className="flex flex-col items-center gap-[0.6cqw] rounded-[0.6cqw] bg-white px-[1.2cqw] pb-[1.2cqw] text-center shadow-xl ring-1 ring-black/10 transition-transform hover:scale-105"
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
