"use client";

import { useEffect } from "react";
import { logTrackingEvent } from "@/lib/tracking";
import { DeskScene } from "./DeskScene";

export type SlotAsset = {
  slot: string;
  kind: string;
  name: string;
  url: string;
};

export function PackageView({
  packageId,
  prospectName,
  letterBody,
  slots,
  orgName,
  orgLogoUrl,
}: {
  packageId: string;
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

  const bySlot = (name: string) => slots.find((s) => s.slot === name);
  const video = bySlot("video");
  const audio = bySlot("audio");
  const businessCard = bySlot("business_card");
  const magazine = bySlot("magazine");
  const brochures = slots.filter((s) => s.slot.startsWith("brochure_"));

  return (
    <div className="mx-auto min-h-full max-w-3xl px-4 py-12">
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
          prospectName={prospectName}
          video={video}
          audio={audio}
          businessCard={businessCard}
          magazine={magazine}
          onTrack={track}
        />
      </div>

      {letterBody && (
        <section className="mb-8 whitespace-pre-wrap rounded-lg border border-neutral-200 bg-white p-6 text-neutral-800">
          {letterBody}
        </section>
      )}

      {brochures.length > 0 && (
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
