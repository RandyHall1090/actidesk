"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { PACKAGE_SLOTS } from "@/lib/packages/slots";
import { DEFAULT_LAYOUT_ID, pickDefaultLayoutId, type DeskLayout } from "@/lib/packages/layouts";
import type { Asset } from "@/lib/assets/types";
import { usePreviewAssets, type PreviewAsset } from "@/lib/assets/usePreviewAssets";
import { DeskScene } from "@/app/s/[slug]/DeskScene";
import type { SlotAsset } from "@/app/s/[slug]/PackageView";
import { savePackage, setDefaultPreset, type ActionResult } from "./actions";

export type PresetOption = {
  id: string;
  name: string;
  letterBody: string | null;
  slots: Record<string, string>; // slot_name -> asset_id
};

// Passed only when editing an already-sent package (packages/[slug]/edit) --
// its presence is what switches this form from create to edit mode.
export type InitialPackage = {
  id: string;
  slug: string;
  prospectName: string;
  prospectCompany: string;
  prospectEmail: string;
  letterBody: string;
  privateNote: string;
  templateId: string;
  slots: Record<string, string>; // slot_name -> asset_id
};

const initialState: ActionResult = { ok: true };
const ORG_LOGO_SLOT = "__org_logo";

function toSlotAsset(slot: string, a: PreviewAsset | undefined): SlotAsset | undefined {
  return a ? { slot, ...a } : undefined;
}

// Prospect fields prefilled from outside the app (currently: a HubSpot
// contact-record link) on an otherwise-blank create form -- distinct from
// initialPackage, whose mere presence switches the whole form into edit
// mode (hidden package_id, different button label, etc.). This never does
// that; it only seeds prospectName/Company/Email on a genuinely new package.
export type InitialProspect = {
  name: string;
  company: string;
  email: string;
};

export function NewPackageForm({
  assets,
  presets,
  orgName,
  layouts,
  initialPackage,
  initialProspect,
  defaultPresetId,
}: {
  assets: Asset[];
  presets: PresetOption[];
  orgName: string;
  // Built-in (DESK_LAYOUTS) + this org's own saved custom ones, resolved
  // server-side (getOrgLayouts) -- see layouts.ts for why this component
  // can't just import DESK_LAYOUTS directly anymore.
  layouts: DeskLayout[];
  initialPackage?: InitialPackage;
  initialProspect?: InitialProspect;
  // The rep's saved default template -- only ever applied to a new package.
  defaultPresetId?: string | null;
}) {
  const [state, formAction, pending] = useActionState(
    savePackage,
    initialState,
  );

  const defaultLayoutId = pickDefaultLayoutId(layouts);

  // A new package starts from the rep's default template, if they've set
  // one; an edit always starts from the package itself.
  const defaultPreset = initialPackage ? undefined : presets.find((p) => p.id === defaultPresetId);
  const startingLetter = initialPackage?.letterBody ?? defaultPreset?.letterBody ?? "";
  const startingSlots = initialPackage?.slots ?? defaultPreset?.slots ?? {};
  const [selectedPresetId, setSelectedPresetId] = useState(defaultPreset?.id ?? "");
  const [savedDefaultId, setSavedDefaultId] = useState<string | null>(defaultPreset?.id ?? null);
  const [defaultError, setDefaultError] = useState<string | null>(null);

  async function saveDefault(presetId: string | null) {
    setDefaultError(null);
    const result = await setDefaultPreset(presetId);
    if (result.ok) setSavedDefaultId(presetId);
    else setDefaultError(result.error);
  }

  // Preset selection, editing an already-picked slot, typing the letter,
  // etc. all pre-fill/update these fields client-side (imperatively, via
  // refs) -- deliberately uncontrolled, not React state, per the lesson
  // learned in LibraryClient.tsx: useActionState's post-action form.reset()
  // overwrites even a value-controlled <select>'s DOM value directly, so
  // controlled state alone isn't a safe way to hold any of this.
  const slotRefs = useRef<Partial<Record<string, HTMLSelectElement>>>({});
  const prospectNameRef = useRef<HTMLInputElement>(null);
  const prospectCompanyRef = useRef<HTMLInputElement>(null);
  const prospectEmailRef = useRef<HTMLInputElement>(null);
  const letterBodyRef = useRef<HTMLTextAreaElement>(null);
  const privateNoteRef = useRef<HTMLTextAreaElement>(null);
  const presetSelectRef = useRef<HTMLSelectElement>(null);
  const layoutSelectRef = useRef<HTMLSelectElement>(null);
  const selectedPresetIdRef = useRef<string>(defaultPreset?.id ?? "");

  // The single source of truth for "what does this form currently hold,"
  // independent of where a given value came from (typed, a preset pick, or
  // the initial edit prefill) -- re-asserted onto every field after any
  // action result (see the effect below), so a failed save never loses
  // work back to blank/original. Editing a package this way (rather than
  // only re-deriving from the selected preset, as this form did for
  // create-only) matters much more here: silently discarding an in-
  // progress *edit* back to blank on a failed save would be a much worse
  // surprise than a blank create-form.
  const currentRef = useRef({
    prospectName: initialPackage?.prospectName ?? initialProspect?.name ?? "",
    prospectCompany: initialPackage?.prospectCompany ?? initialProspect?.company ?? "",
    prospectEmail: initialPackage?.prospectEmail ?? initialProspect?.email ?? "",
    letterBody: startingLetter,
    privateNote: initialPackage?.privateNote ?? "",
    templateId: initialPackage?.templateId ?? defaultLayoutId,
    slots: { ...startingSlots } as Record<string, string>,
  });

  // Live-preview mirror state -- separate from the uncontrolled form above,
  // since nothing here is ever read back into a submitted field. Every
  // place that sets a DOM value imperatively (applyPreset, reassertCurrent)
  // must also update this, because el.value = x never fires React's onChange.
  const [templateId, setTemplateId] = useState(
    () => initialPackage?.templateId ?? defaultLayoutId,
  );
  const [prospectName, setProspectName] = useState(
    () => initialPackage?.prospectName ?? initialProspect?.name ?? "",
  );
  const [letterBody, setLetterBody] = useState(() => startingLetter);
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

  // Seed the live preview from the package being edited, or the rep's
  // default template on a new one -- setSlot itself only drives preview
  // state, it's independent of (and runs once before) the reset-safety
  // effect below. Deliberately mount-only: the starting values never change
  // for a given form session.
  useEffect(() => {
    for (const [slot, assetId] of Object.entries(startingSlots)) {
      setSlot(slot, assetId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyPreset(preset: PresetOption | undefined) {
    for (const s of PACKAGE_SLOTS) {
      const el = slotRefs.current[s.slot];
      const assetId = preset?.slots[s.slot] ?? "";
      if (el) el.value = assetId;
      currentRef.current.slots[s.slot] = assetId;
      setSlot(s.slot, assetId);
    }
    const letter = preset?.letterBody ?? "";
    if (letterBodyRef.current) letterBodyRef.current.value = letter;
    currentRef.current.letterBody = letter;
    setLetterBody(letter);
  }

  function handlePresetChange(id: string) {
    selectedPresetIdRef.current = id;
    setSelectedPresetId(id);
    applyPreset(presets.find((p) => p.id === id));
  }

  // Re-applies currentRef onto every DOM field + the preview mirror state --
  // shared by the post-action reset effect below.
  function reassertCurrent() {
    if (prospectNameRef.current) prospectNameRef.current.value = currentRef.current.prospectName;
    if (prospectCompanyRef.current) prospectCompanyRef.current.value = currentRef.current.prospectCompany;
    if (prospectEmailRef.current) prospectEmailRef.current.value = currentRef.current.prospectEmail;
    if (letterBodyRef.current) letterBodyRef.current.value = currentRef.current.letterBody;
    if (privateNoteRef.current) privateNoteRef.current.value = currentRef.current.privateNote;
    if (layoutSelectRef.current) layoutSelectRef.current.value = currentRef.current.templateId;
    for (const s of PACKAGE_SLOTS) {
      const el = slotRefs.current[s.slot];
      const assetId = currentRef.current.slots[s.slot] ?? "";
      if (el) el.value = assetId;
      setSlot(s.slot, assetId);
    }
    setTemplateId(currentRef.current.templateId);
    setProspectName(currentRef.current.prospectName);
    setLetterBody(currentRef.current.letterBody);
  }

  // Confirmed live (T10/T11, re-confirmed here): useActionState's
  // post-action form.reset() fires on ANY resolved action result, not just
  // a successful one -- a failed {ok:false} validation response would
  // otherwise silently snap every field back to blank, discarding whatever
  // the rep had just typed/picked (on an edit, that includes the fields
  // that were already correct before they started editing). Re-assert the
  // real current values right after that reset happens, every time.
  useEffect(() => {
    if (presetSelectRef.current) {
      presetSelectRef.current.value = selectedPresetIdRef.current;
    }
    reassertCurrent();
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
        {initialPackage && (
          <input type="hidden" name="package_id" value={initialPackage.id} />
        )}

        {presets.length > 0 && (
          <fieldset className="space-y-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-4">
            <legend className="px-1 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
              Start from a template
            </legend>
            <select
              ref={presetSelectRef}
              defaultValue={defaultPreset?.id ?? ""}
              onChange={(e) => handlePresetChange(e.target.value)}
              className="w-full rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
            >
              <option value="">— Blank —</option>
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Pre-fills the assets and letter below — you can still edit
              anything before saving.
            </p>
            {!initialPackage && selectedPresetId && (
              <p className="text-xs text-neutral-600 dark:text-neutral-400">
                {selectedPresetId === savedDefaultId ? (
                  <>
                    ★ Your default — new packages start from it.{" "}
                    <button type="button" onClick={() => saveDefault(null)} className="underline">
                      Remove default
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => saveDefault(selectedPresetId)}
                    className="font-medium text-blue-600 underline dark:text-blue-400"
                  >
                    Make this my default
                  </button>
                )}
              </p>
            )}
            {defaultError && <p className="text-xs text-red-600 dark:text-red-400">{defaultError}</p>}
          </fieldset>
        )}

        <fieldset className="space-y-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-4">
          <legend className="px-1 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
            Layout
          </legend>
          <select
            name="template_id"
            ref={layoutSelectRef}
            defaultValue={initialPackage?.templateId ?? defaultLayoutId}
            onChange={(e) => {
              currentRef.current.templateId = e.target.value;
              setTemplateId(e.target.value);
            }}
            className="w-full rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
          >
            {layouts.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </fieldset>

        <fieldset className="space-y-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-4">
          <legend className="px-1 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
            Prospect
          </legend>
          <input
            ref={prospectNameRef}
            name="prospect_name"
            required
            defaultValue={initialPackage?.prospectName ?? initialProspect?.name ?? ""}
            placeholder="Prospect name"
            onChange={(e) => {
              currentRef.current.prospectName = e.target.value;
              setProspectName(e.target.value);
            }}
            className="w-full rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 focus:border-neutral-500 dark:border-neutral-400 focus:outline-none"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              ref={prospectCompanyRef}
              name="prospect_company"
              defaultValue={initialPackage?.prospectCompany ?? initialProspect?.company ?? ""}
              placeholder="Company (optional)"
              onChange={(e) => {
                currentRef.current.prospectCompany = e.target.value;
              }}
              className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 focus:border-neutral-500 dark:border-neutral-400 focus:outline-none"
            />
            <input
              ref={prospectEmailRef}
              name="prospect_email"
              type="email"
              defaultValue={initialPackage?.prospectEmail ?? initialProspect?.email ?? ""}
              placeholder="Email (optional)"
              onChange={(e) => {
                currentRef.current.prospectEmail = e.target.value;
              }}
              className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 focus:border-neutral-500 dark:border-neutral-400 focus:outline-none"
            />
          </div>
        </fieldset>

        <fieldset className="space-y-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-4">
          <legend className="px-1 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
            Assets
          </legend>
          {PACKAGE_SLOTS.map((s) => {
            const options = assets.filter((a) => a.kind === s.kind);
            return (
              <label key={s.slot} className="block text-sm">
                <span className="mb-1 block font-medium text-neutral-700 dark:text-neutral-300">
                  {s.label}
                </span>
                <select
                  name={`slot_${s.slot}`}
                  defaultValue={startingSlots[s.slot] ?? ""}
                  ref={(el) => {
                    slotRefs.current[s.slot] = el ?? undefined;
                  }}
                  onChange={(e) => {
                    currentRef.current.slots[s.slot] = e.target.value;
                    setSlot(s.slot, e.target.value);
                  }}
                  className="w-full rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
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

        <fieldset className="space-y-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-4">
          <legend className="px-1 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
            Letter
          </legend>
          <textarea
            name="letter_body"
            ref={letterBodyRef}
            rows={6}
            defaultValue={startingLetter}
            placeholder="Hi [Name], ..."
            onChange={(e) => {
              currentRef.current.letterBody = e.target.value;
              setLetterBody(e.target.value);
            }}
            className="w-full rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 focus:border-neutral-500 dark:border-neutral-400 focus:outline-none"
          />
        </fieldset>

        <fieldset className="space-y-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-4">
          <legend className="px-1 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
            Private note (not shown to the prospect)
          </legend>
          <textarea
            name="private_note"
            ref={privateNoteRef}
            rows={2}
            defaultValue={initialPackage?.privateNote ?? ""}
            onChange={(e) => {
              currentRef.current.privateNote = e.target.value;
            }}
            className="w-full rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 focus:border-neutral-500 dark:border-neutral-400 focus:outline-none"
          />
        </fieldset>

        {!state.ok && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-neutral-900 dark:bg-neutral-100 px-4 py-2 text-sm font-medium text-white dark:text-neutral-900 transition-opacity disabled:opacity-50"
          >
            {pending
              ? initialPackage
                ? "Saving…"
                : "Creating…"
              : initialPackage
                ? "Save changes"
                : "Create Package"}
          </button>
          {initialPackage && (
            <a
              href={`/packages/${initialPackage.slug}`}
              className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
            >
              Cancel
            </a>
          )}
        </div>
      </form>

      <div className="lg:sticky lg:top-6">
        <h3 className="mb-2 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
          Live Preview
        </h3>
        <DeskScene
          layout={resolvedLayout}
          prospectName={prospectName || "Prospect Name"}
          video={toSlotAsset("video", slotAssets.video)}
          video2={toSlotAsset("video_2", slotAssets.video_2)}
          audio={toSlotAsset("audio", slotAssets.audio)}
          pen={toSlotAsset("pen", slotAssets.pen)}
          businessCard={toSlotAsset("business_card", slotAssets.business_card)}
          magazine={toSlotAsset("magazine", slotAssets.magazine)}
          magazine2={toSlotAsset("magazine_2", slotAssets.magazine_2)}
          magazine3={toSlotAsset("magazine_3", slotAssets.magazine_3)}
          magazine4={toSlotAsset("magazine_4", slotAssets.magazine_4)}
          bookImage1={toSlotAsset("book_image_1", slotAssets.book_image_1)}
          bookImage2={toSlotAsset("book_image_2", slotAssets.book_image_2)}
          bookImage3={toSlotAsset("book_image_3", slotAssets.book_image_3)}
          letterBody={letterBody || null}
          brochures={brochureSlots}
          orgName={orgName}
          orgLogoUrl={slotAssets[ORG_LOGO_SLOT]?.url ?? null}
          onTrack={() => {}}
        />
        <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-500">
          Preview only — links shown here are temporary and won&apos;t work
          outside this session.
        </p>
      </div>
    </div>
  );
}
