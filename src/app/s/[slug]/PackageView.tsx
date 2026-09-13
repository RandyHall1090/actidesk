"use client";

import { useEffect } from "react";
import { logTrackingEvent } from "@/lib/tracking";
import { getLayout } from "@/lib/packages/layouts";
import { DeskScene } from "./DeskScene";

export type SlotAsset = {
  slot: string;
  kind: string;
  name: string;
  url: string;
};

export function PackageView({
  packageId,
  templateId,
  prospectName,
  letterBody,
  slots,
  orgName,
  orgLogoUrl,
}: {
  packageId: string;
  templateId: string;
  prospectName: string;
  letterBody: string | null;
  slots: SlotAsset[];
  orgName: string;
  orgLogoUrl: string | null;
}) {
  useEffect(() => {
    logTrackingEvent(packageId, "page_view");
    // Only log once per page load, regardless of packageId identity churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function track(
    slot: string,
    kind: "asset_opened" | "asset_played" = "asset_opened",
  ) {
    logTrackingEvent(packageId, kind, slot);
  }

  const layout = getLayout(templateId);
  const bySlot = (name: string) => slots.find((s) => s.slot === name);
  const video = bySlot("video");
  const video2 = bySlot("video_2");
  const audio = bySlot("audio");
  const businessCard = bySlot("business_card");
  const magazine = bySlot("magazine");
  const brochures = slots.filter((s) => s.slot.startsWith("brochure_"));

  return (
    // w-full is required, not redundant with max-w-3xl: body is a column
    // flex container (layout.tsx), and this container's real content is
    // sparse on packages with few slots filled (e.g. video only, no
    // letter/brochures) -- without an explicit width, it was sized by
    // shrink-to-fit against that sparse content instead of stretching to
    // fill the flex cross-axis, rendering the whole page at a fraction of
    // its intended size. Confirmed live: a package with only a video slot
    // rendered at 87px wide instead of 768px.
    <div className="mx-auto w-full min-h-full max-w-3xl px-4 py-12">
      <div className="mb-8 flex items-center gap-3">
        {orgLogoUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- dynamic signed Storage URL, not a static local asset
          <img
            src={orgLogoUrl}
            alt={orgName}
            className="h-10 w-auto object-contain"
          />
        )}
        <p className="text-sm font-medium text-neutral-500">{orgName}</p>
      </div>
      <div className="mb-8">
        <DeskScene
          templateId={templateId}
          prospectName={prospectName}
          video={video}
          video2={video2}
          audio={audio}
          businessCard={businessCard}
          magazine={magazine}
          letterBody={letterBody}
          brochures={brochures}
          orgName={orgName}
          orgLogoUrl={orgLogoUrl}
          onTrack={track}
        />
      </div>

      {!layout.letter && letterBody && (
        <section className="mb-8 whitespace-pre-wrap rounded-lg border border-neutral-200 bg-white p-6 text-neutral-800">
          {letterBody}
        </section>
      )}

      {!layout.brochures && brochures.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-neutral-500">
            Documents
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {brochures.map((b) => (
              <li key={b.slot}>
                <a
                  href={b.url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => track(b.slot)}
                  className="block rounded-md border border-neutral-200 bg-white px-4 py-3 text-sm font-medium text-neutral-800 hover:border-neutral-400"
                >
                  {b.name}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
