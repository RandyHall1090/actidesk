"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { PACKAGE_SLOTS } from "@/lib/packages/slots";
import { DEFAULT_LAYOUT_ID, type DeskLayout } from "@/lib/packages/layouts";
import type { Asset } from "@/lib/assets/types";
import { usePreviewAssets, type PreviewAsset } from "@/lib/assets/usePreviewAssets";
import { DeskScene } from "@/app/s/[slug]/DeskScene";
import type { SlotAsset } from "@/app/s/[slug]/PackageView";
import { createPackage, type ActionResult } from "./actions";

export type PresetOption = {
  id: string;
  name: string;
  letterBody: string | null;
  slots: Record<string, string>; // slot_name -> asset_id
};

const initialState: ActionResult = { ok: true };
const ORG_LOGO_SLOT = "__org_logo";

function toSlotAsset(slot: string, a: PreviewAsset | undefined): SlotAsset | undefined {
  return a ? { slot, ...a } : undefined;
}

export function NewPackageForm({
  assets,
  presets,
  orgName,
  layouts,
}: {
  assets: Asset[];
  presets: PresetOption[];
  orgName: string;
  // Built-in (DESK_LAYOUTS) + this org's own saved custom ones, resolved
  // server-side (getOrgLayouts) -- see layouts.ts for why this component
  // can't just import DESK_LAYOUTS directly anymore.
  layouts: DeskLayout[];
}) {
  const [state, formAction, pending] = useActionState(
    createPackage,
    initialState,
  );

  // Preset selection just pre-fills these fields client-side (imperatively,
  // via refs) -- deliberately uncontrolled, not React state, per the lesson
  // learned in LibraryClient.tsx: useActionState's post-success form.reset()
  // overwrites even a value-controlled <select>'s DOM value directly, so
  // controlled state alone isn't a safe way to hold a "prefilled" value here.
  const slotRefs = useRef<Partial<Record<string, HTMLSelectElement>>>({});
  const letterBodyRef = useRef<HTMLTextAreaElement>(null);
  const presetSelectRef = useRef<HTMLSelectElement>(null);
  const layoutSelectRef = useRef<HTMLSelectElement>(null);
  const selectedPresetIdRef = useRef<string>("");
  const selectedLayoutIdRef = useRef<string>(DEFAULT_LAYOUT_ID);

  // Live-preview mirror state -- separate from the uncontrolled form above,
  // since nothing here is ever read back into a submitted field. Every
  // place that sets a DOM value imperatively (applyPreset, the post-reset
  // useEffect) must also update this, because el.value = x never fires
  // React's onChange.
  const [templateId, setTemplateId] = useState(DEFAULT_LAYOUT_ID);
  const [prospectName, setProspectName] = useState("");
  const [letterBody, setLetterBody] = useState("");
  const { slotAssets, setSlot } = usePreviewAssets(assets);

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

  function applyPreset(preset: PresetOption | undefined) {
    for (const s of PACKAGE_SLOTS) {
      const el = slotRefs.current[s.slot];
      const assetId = preset?.slots[s.slot] ?? "";
      if (el) el.value = assetId;
      setSlot(s.slot, assetId);
    }
    if (letterBodyRef.current) {
      letterBodyRef.current.value = preset?.letterBody ?? "";
    }
    setLetterBody(preset?.letterBody ?? "");
  }

  function handlePresetChange(id: string) {
    selectedPresetIdRef.current = id;
    applyPreset(presets.find((p) => p.id === id));
  }

  // Confirmed live: useActionState's post-action form.reset() fires on ANY
  // resolved action result, not just a successful one -- a failed {ok:false}
  // validation response (e.g. a blank prospect name) silently snapped the
  // preset pick, the prefilled assets/letter, and the layout choice all back
  // to blank/default, discarding everything the rep had just entered. Same
  // fix as LibraryClient.tsx's scope select: re-assert the real values right
  // after that reset happens -- and also keep the live-preview state in
  // sync, since the native reset blanks the ref-less prospect-name input
  // too (nothing else was watching that before this preview existed).
  useEffect(() => {
    if (presetSelectRef.current) {
      presetSelectRef.current.value = selectedPresetIdRef.current;
    }
    if (layoutSelectRef.current) {
      layoutSelectRef.current.value = selectedLayoutIdRef.current;
    }
    setTemplateId(selectedLayoutIdRef.current);
    setProspectName("");
    applyPreset(presets.find((p) => p.id === selectedPresetIdRef.current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const brochureSlots = [1, 2, 3, 4]
    .map((n) => toSlotAsset(`brochure_${n}`, slotAssets[`brochure_${n}`]))
    .filter((a): a is SlotAsset => !!a);

  const resolvedLayout =
    layouts.find((l) => l.id === templateId) ??
    layouts.find((l) => l.id === DEFAULT_LAYOUT_ID) ??
    layouts[0];

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-start">
      <form action={formAction} className="space-y-6">
        {presets.length > 0 && (
          <fieldset className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4">
            <legend className="px-1 text-sm font-semibold text-neutral-700">
              Start from a template
            </legend>
            <select
              ref={presetSelectRef}
              defaultValue=""
              onChange={(e) => handlePresetChange(e.target.value)}
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
            >
              <option value="">— Blank —</option>
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-neutral-500">
              Pre-fills the assets and letter below — you can still edit
              anything before creating the package.
            </p>
          </fieldset>
        )}

        <fieldset className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4">
          <legend className="px-1 text-sm font-semibold text-neutral-700">
            Layout
          </legend>
          <select
            name="template_id"
            ref={layoutSelectRef}
            defaultValue={DEFAULT_LAYOUT_ID}
            onChange={(e) => {
              selectedLayoutIdRef.current = e.target.value;
              setTemplateId(e.target.value);
            }}
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
          >
            {layouts.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </fieldset>

        <fieldset className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4">
          <legend className="px-1 text-sm font-semibold text-neutral-700">
            Prospect
          </legend>
          <input
            name="prospect_name"
            required
            placeholder="Prospect name"
            onChange={(e) => setProspectName(e.target.value)}
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              name="prospect_company"
              placeholder="Company (optional)"
              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none"
            />
            <input
              name="prospect_email"
              type="email"
              placeholder="Email (optional)"
              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none"
            />
          </div>
        </fieldset>

        <fieldset className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4">
          <legend className="px-1 text-sm font-semibold text-neutral-700">
            Assets
          </legend>
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
                  ref={(el) => {
                    slotRefs.current[s.slot] = el ?? undefined;
                  }}
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
        </fieldset>

        <fieldset className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4">
          <legend className="px-1 text-sm font-semibold text-neutral-700">
            Letter
          </legend>
          <textarea
            name="letter_body"
            ref={letterBodyRef}
            rows={6}
            placeholder="Hi [Name], ..."
            onChange={(e) => setLetterBody(e.target.value)}
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none"
          />
        </fieldset>

        <fieldset className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4">
          <legend className="px-1 text-sm font-semibold text-neutral-700">
            Private note (not shown to the prospect)
          </legend>
          <textarea
            name="private_note"
            rows={2}
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none"
          />
        </fieldset>

        {!state.ok && <p className="text-sm text-red-600">{state.error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create Package"}
        </button>
      </form>

      <div className="lg:sticky lg:top-6">
        <h3 className="mb-2 text-sm font-semibold text-neutral-700">
          Live Preview
        </h3>
        <DeskScene
          layout={resolvedLayout}
          prospectName={prospectName || "Prospect Name"}
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
          Preview only — links shown here are temporary and won&apos;t work
          outside this session.
        </p>
      </div>
    </div>
  );
}
