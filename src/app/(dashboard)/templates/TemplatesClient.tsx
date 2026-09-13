"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { PACKAGE_SLOTS } from "@/lib/packages/slots";
import { DESK_LAYOUTS, DEFAULT_LAYOUT_ID } from "@/lib/packages/layouts";
import type { Asset } from "@/lib/assets/types";
import { usePreviewAssets, type PreviewAsset } from "@/lib/assets/usePreviewAssets";
import { DeskScene } from "@/app/s/[slug]/DeskScene";
import type { SlotAsset } from "@/app/s/[slug]/PackageView";
import { createPreset, deletePresetFormAction, type ActionResult } from "./actions";

export type Preset = {
  id: string;
  name: string;
  letter_body: string | null;
  created_at: string;
  preset_assets: { slot_name: string; asset_id: string | null }[];
};

const initialState: ActionResult = { ok: true };
const ORG_LOGO_SLOT = "__org_logo";
// Presets have no layout concept of their own -- a layout is picked
// per-package, not per-preset. Preview against whichever layout actually
// renders a letter/brochures on the desk (desk-v3 today) rather than the
// bare default -- otherwise an admin could never see their letter text or
// brochure picks in the preview at all, since desk-v1/v2 push those below
// the photo (outside what this DeskScene-only preview renders). A
// from-scratch "preview against a different layout" toggle would be a
// nicety, not something asked for here.
const PREVIEW_TEMPLATE_ID =
  DESK_LAYOUTS.find((l) => l.letter && l.brochures)?.id ?? DEFAULT_LAYOUT_ID;
const PREVIEW_PROSPECT_NAME = "Sample Prospect";

function toSlotAsset(slot: string, a: PreviewAsset | undefined): SlotAsset | undefined {
  return a ? { slot, ...a } : undefined;
}

export function TemplatesClient({
  assets,
  presets,
  orgName,
}: {
  assets: Asset[];
  presets: Preset[];
  orgName: string;
}) {
  const [state, formAction, pending] = useActionState(
    createPreset,
    initialState,
  );

  const [letterBody, setLetterBody] = useState("");
  const { slotAssets, setSlot, clearAll } = usePreviewAssets(assets);

  const orgLogoAsset = useMemo(
    () =>
      assets
        .filter((a) => a.kind === "logo" && a.scope === "company")
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0],
    [assets],
  );
  useEffect(() => {
    if (orgLogoAsset) setSlot(ORG_LOGO_SLOT, orgLogoAsset.id);
  }, [orgLogoAsset, setSlot]);

  // createPreset doesn't redirect on success -- it clears the form so the
  // admin can add another -- so every action resolution (success or
  // failure) means the native form.reset() just blanked the DOM, and the
  // preview needs to match: reset fully, then re-resolve the org logo
  // since clearAll() just wiped that slot too. This is synchronizing local
  // state with an external signal (the native reset a resolved action just
  // triggered), not state derivable during render -- the lint rule's
  // "setState looks unconditional" heuristic doesn't fit this case.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLetterBody("");
    clearAll();
    if (orgLogoAsset) setSlot(ORG_LOGO_SLOT, orgLogoAsset.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const brochureSlots = [1, 2, 3, 4]
    .map((n) => toSlotAsset(`brochure_${n}`, slotAssets[`brochure_${n}`]))
    .filter((a): a is SlotAsset => !!a);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-start">
        <form
          action={formAction}
          className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4"
        >
          <input
            name="name"
            required
            placeholder="Template name (e.g. Enterprise pitch)"
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none"
          />

          {PACKAGE_SLOTS.map((s) => {
            const options = assets.filter((a) => a.kind === s.kind);
            return (
              <label key={s.slot} className="block text-sm">
                <span className="mb-1 block font-medium text-neutral-700">
                  {s.label}
                </span>
                <select
                  name={`slot_${s.slot}`}
                  defaultValue=""
                  onChange={(e) => setSlot(s.slot, e.target.value)}
                  className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
                >
                  <option value="">— None —</option>
                  {options.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                      {a.scope === "company" ? " (Company)" : ""}
                    </option>
                  ))}
                </select>
              </label>
            );
          })}

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-neutral-700">
              Letter
            </span>
            <textarea
              name="letter_body"
              rows={5}
              placeholder="Hi [Name], ..."
              onChange={(e) => setLetterBody(e.target.value)}
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none"
            />
          </label>

          {!state.ok && <p className="text-sm text-red-600">{state.error}</p>}

          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save Template"}
          </button>
        </form>

        <div className="lg:sticky lg:top-6">
          <h3 className="mb-2 text-sm font-semibold text-neutral-700">
            Live Preview
          </h3>
          <DeskScene
            templateId={PREVIEW_TEMPLATE_ID}
            prospectName={PREVIEW_PROSPECT_NAME}
            video={toSlotAsset("video", slotAssets.video)}
            video2={toSlotAsset("video_2", slotAssets.video_2)}
            audio={toSlotAsset("audio", slotAssets.audio)}
            businessCard={toSlotAsset("business_card", slotAssets.business_card)}
            magazine={toSlotAsset("magazine", slotAssets.magazine)}
            letterBody={letterBody || null}
            brochures={brochureSlots}
            orgName={orgName}
            orgLogoUrl={slotAssets[ORG_LOGO_SLOT]?.url ?? null}
            onTrack={() => {}}
          />
          <p className="mt-2 text-xs text-neutral-400">
            Preview only — a rep can pick a different layout when they
            actually create a package from this template.
          </p>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-neutral-700">
          Existing Templates
        </h3>
        {presets.length === 0 ? (
          <p className="text-sm text-neutral-400">No templates yet.</p>
        ) : (
          <ul className="space-y-2">
            {presets.map((preset) => {
              const filledSlots = preset.preset_assets.filter(
                (pa) => pa.asset_id,
              );
              return (
                <li
                  key={preset.id}
                  className="flex items-start justify-between gap-3 rounded-md border border-neutral-200 bg-white px-4 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-neutral-900">
                      {preset.name}
                    </p>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {filledSlots.length > 0
                        ? `${filledSlots.length} asset${filledSlots.length === 1 ? "" : "s"} selected`
                        : "No assets selected"}
                      {preset.letter_body ? " · has letter text" : ""}
                    </p>
                  </div>
                  <form action={deletePresetFormAction.bind(null, preset.id)}>
                    <button
                      type="submit"
                      className="shrink-0 text-xs text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
