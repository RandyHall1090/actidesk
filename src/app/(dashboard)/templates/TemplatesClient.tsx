"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { PACKAGE_SLOTS } from "@/lib/packages/slots";
import { DEFAULT_LAYOUT_ID, type DeskLayout } from "@/lib/packages/layouts";
import type { Asset } from "@/lib/assets/types";
import { usePreviewAssets, type PreviewAsset } from "@/lib/assets/usePreviewAssets";
import { DeskScene } from "@/app/s/[slug]/DeskScene";
import type { SlotAsset } from "@/app/s/[slug]/PackageView";
import { savePreset, deletePresetFormAction, type ActionResult } from "./actions";

export type Preset = {
  id: string;
  name: string;
  letter_body: string | null;
  scope: "personal" | "company";
  created_by: string;
  created_at: string;
  preset_assets: { slot_name: string; asset_id: string | null }[];
};

const initialState: ActionResult = { ok: true };
const ORG_LOGO_SLOT = "__org_logo";
const PREVIEW_PROSPECT_NAME = "Sample Prospect";

function toSlotAsset(slot: string, a: PreviewAsset | undefined): SlotAsset | undefined {
  return a ? { slot, ...a } : undefined;
}

export function TemplatesClient({
  assets,
  presets,
  orgName,
  layouts,
  currentUserId,
  isAdmin,
}: {
  assets: Asset[];
  presets: Preset[];
  orgName: string;
  // Built-in + this org's own saved custom ones (see NewPackageForm.tsx).
  layouts: DeskLayout[];
  currentUserId: string;
  isAdmin: boolean;
}) {
  // Presets have no layout concept of their own -- a layout is picked
  // per-package, not per-preset. Preview against whichever layout actually
  // renders a letter/brochures on the desk rather than the bare default --
  // otherwise an admin could never see their letter text or brochure picks
  // in the preview at all, since a layout with no letter/brochures pushes
  // those below the photo (outside what this DeskScene-only preview
  // renders). A from-scratch "preview against a different layout" toggle
  // would be a nicety, not something asked for here.
  const previewLayout = useMemo(
    () =>
      layouts.find((l) => l.letter && l.brochures) ??
      layouts.find((l) => l.id === DEFAULT_LAYOUT_ID) ??
      layouts[0],
    [layouts],
  );
  const [state, formAction, pending] = useActionState(
    savePreset,
    initialState,
  );

  // Clone and Edit both prefill this same form (imperatively, via refs)
  // rather than being separate UIs -- deliberately uncontrolled, not React
  // state, for the exact reset-safety reason documented in
  // NewPackageForm.tsx: useActionState's post-action form.reset() overwrites
  // even a value-controlled field's DOM value directly.
  //
  // mirroredPresetIdRef: which preset's values are currently mirrored into
  // the form (Clone or Edit both set this; "" means blank/from-scratch) --
  // used only to know what to re-apply if a submission fails (see the
  // reset-safety effect below).
  // editingPresetIdRef: if non-empty, Save updates THIS preset in place
  // instead of creating a new one -- the hidden `preset_id` field's real
  // value. Empty for both "from scratch" and Clone (Clone always creates
  // new); equal to mirroredPresetIdRef only when actually editing.
  const nameRef = useRef<HTMLInputElement>(null);
  const letterBodyRef = useRef<HTMLTextAreaElement>(null);
  const scopeSelectRef = useRef<HTMLSelectElement>(null);
  const slotRefs = useRef<Partial<Record<string, HTMLSelectElement>>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const presetIdInputRef = useRef<HTMLInputElement>(null);
  const mirroredPresetIdRef = useRef<string>("");
  const editingPresetIdRef = useRef<string>("");

  const [letterBody, setLetterBody] = useState("");
  const [cloneWarning, setCloneWarning] = useState<string | null>(null);
  // Purely for display (button label, the "Editing X" banner) -- the real
  // source of truth Save reads from is editingPresetIdRef/the hidden input.
  const [editingName, setEditingName] = useState<string | null>(null);
  const { slotAssets, setSlot, clearAll } = usePreviewAssets(assets);

  function applyFormValues(preset: Preset | undefined, asCopy: boolean) {
    if (nameRef.current) {
      nameRef.current.value = preset
        ? asCopy
          ? `${preset.name} (Copy)`
          : preset.name
        : "";
    }
    // A clone always starts personal, regardless of the source's own scope
    // -- "make changes to their version" means their own private copy
    // first, not something that's immediately visible to the whole team
    // again. Editing keeps whatever scope the template already has;
    // starting from scratch defaults to personal too.
    if (scopeSelectRef.current) {
      scopeSelectRef.current.value = asCopy
        ? "personal"
        : (preset?.scope ?? "personal");
    }
    // A mirrored slot's asset can be personal-scope, owned by whoever
    // originally picked it -- invisible to this admin's own `assets` list
    // (assets_select_org RLS: scope = 'company' or owner_id = you), so
    // there's no matching <option> for el.value to land on and the browser
    // just silently leaves the select on its current value. Caught live:
    // cloning a real preset dropped 2 of 8 picks with no indication at all
    // -- applies equally to Edit, so this check stays shared.
    const invisible: string[] = [];
    for (const s of PACKAGE_SLOTS) {
      const sourceAssetId = preset?.preset_assets.find(
        (pa) => pa.slot_name === s.slot,
      )?.asset_id;
      const isVisible = !sourceAssetId || assets.some((a) => a.id === sourceAssetId);
      const assetId = sourceAssetId && isVisible ? sourceAssetId : "";
      if (sourceAssetId && !isVisible) invisible.push(s.label);
      const el = slotRefs.current[s.slot];
      if (el) el.value = assetId;
      setSlot(s.slot, assetId);
    }
    if (letterBodyRef.current) {
      letterBodyRef.current.value = preset?.letter_body ?? "";
    }
    setLetterBody(preset?.letter_body ?? "");
    if (presetIdInputRef.current) {
      presetIdInputRef.current.value = editingPresetIdRef.current;
    }
    setCloneWarning(
      invisible.length > 0
        ? `Couldn't copy ${invisible.join(", ")} — picked as a personal asset by whoever set up the original, so it isn't visible to you. Pick a replacement below if needed.`
        : null,
    );
  }

  function handleClone(preset: Preset) {
    mirroredPresetIdRef.current = preset.id;
    editingPresetIdRef.current = "";
    setEditingName(null);
    applyFormValues(preset, true);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleEdit(preset: Preset) {
    mirroredPresetIdRef.current = preset.id;
    editingPresetIdRef.current = preset.id;
    setEditingName(preset.name);
    applyFormValues(preset, false);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleCancelEdit() {
    mirroredPresetIdRef.current = "";
    editingPresetIdRef.current = "";
    setEditingName(null);
    applyFormValues(undefined, false);
  }

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

  // savePreset doesn't redirect on success -- it clears the form so the
  // admin can add another -- so every action resolution (success or
  // failure) means the native form.reset() just blanked the DOM. On success
  // that's the right outcome (ready for a genuinely new template, and out
  // of edit mode), so both id refs are cleared first and
  // applyFormValues(undefined, ...) blanks the preview to match. On a
  // validation failure, though, the same native reset would otherwise
  // silently discard whatever was just cloned or being edited -- and for
  // Edit specifically, silently falling back to "create" mode would make
  // the next Save click wrongly create a duplicate instead of updating.
  // Re-applying whatever was mirrored in re-populates it correctly either
  // way, the same reset-safety fix already used in NewPackageForm.tsx for
  // its own preset prefill. This is synchronizing local state with an
  // external signal (the native reset a resolved action just triggered),
  // not state derivable during render -- the lint rule's "setState looks
  // unconditional" heuristic doesn't fit this case.
  useEffect(() => {
    clearAll();
    if (state.ok) {
      mirroredPresetIdRef.current = "";
      editingPresetIdRef.current = "";
      // eslint-disable-next-line react-hooks/set-state-in-effect -- see the comment above: synchronizing with the native form.reset() a resolved action just triggered, not state derivable during render.
      setEditingName(null);
    }
    applyFormValues(
      presets.find((p) => p.id === mirroredPresetIdRef.current),
      !editingPresetIdRef.current,
    );
    if (orgLogoAsset) setSlot(ORG_LOGO_SLOT, orgLogoAsset.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const brochureSlots = [1, 2, 3, 4]
    .map((n) => toSlotAsset(`brochure_${n}`, slotAssets[`brochure_${n}`]))
    .filter((a): a is SlotAsset => !!a);

  // presets already only contains your own (any scope) plus every
  // company-scope one in the org (RLS, migration 0019) -- this just splits
  // that one list into the two sections, mirroring LibraryClient.tsx's own
  // "My library" / "Company library" split for assets.
  const myPresets = presets.filter((p) => p.created_by === currentUserId);
  const sharedPresets = presets.filter(
    (p) => p.scope === "company" && p.created_by !== currentUserId,
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-start">
        <form
          ref={formRef}
          action={formAction}
          className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4"
        >
          <input ref={presetIdInputRef} type="hidden" name="preset_id" />
          {editingName && (
            <p className="flex items-center justify-between rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-700">
              <span>
                Editing <strong>{editingName}</strong>
              </span>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="font-medium text-neutral-600 hover:underline"
              >
                Cancel
              </button>
            </p>
          )}
          {cloneWarning && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {cloneWarning}
            </p>
          )}
          <input
            ref={nameRef}
            name="name"
            required
            placeholder="Template name (e.g. Enterprise pitch)"
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none"
          />

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-neutral-700">
              Visibility
            </span>
            <select
              name="scope"
              ref={scopeSelectRef}
              defaultValue="personal"
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
            >
              <option value="personal">Personal — only you</option>
              <option value="company">Shared with your team</option>
            </select>
          </label>

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

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-neutral-700">
              Letter
            </span>
            <textarea
              ref={letterBodyRef}
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
            {pending ? "Saving…" : editingName ? "Save changes" : "Save Template"}
          </button>
        </form>

        <div className="lg:sticky lg:top-6">
          <h3 className="mb-2 text-sm font-semibold text-neutral-700">
            Live Preview
          </h3>
          <DeskScene
            layout={previewLayout}
            prospectName={PREVIEW_PROSPECT_NAME}
            video={toSlotAsset("video", slotAssets.video)}
            video2={toSlotAsset("video_2", slotAssets.video_2)}
            audio={toSlotAsset("audio", slotAssets.audio)}
            pen={toSlotAsset("pen", slotAssets.pen)}
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

      <div className="space-y-6">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-neutral-700">
            My Templates
          </h3>
          {myPresets.length === 0 ? (
            <p className="text-sm text-neutral-400">
              No templates of your own yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {myPresets.map((preset) => (
                <PresetRow
                  key={preset.id}
                  preset={preset}
                  canManage
                  onEdit={handleEdit}
                  onClone={handleClone}
                />
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-neutral-700">
            Shared by your team
          </h3>
          {sharedPresets.length === 0 ? (
            <p className="text-sm text-neutral-400">
              No one has shared a template yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {sharedPresets.map((preset) => (
                <PresetRow
                  key={preset.id}
                  preset={preset}
                  canManage={isAdmin}
                  onEdit={handleEdit}
                  onClone={handleClone}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/** One row in either template list. Edit/Delete only for the owner (or an
 * admin, on a shared one) -- Clone is always available, since that's how
 * anyone else turns someone's shared template into their own editable copy. */
function PresetRow({
  preset,
  canManage,
  onEdit,
  onClone,
}: {
  preset: Preset;
  canManage: boolean;
  onEdit: (preset: Preset) => void;
  onClone: (preset: Preset) => void;
}) {
  const filledSlots = preset.preset_assets.filter((pa) => pa.asset_id);
  return (
    <li className="flex items-start justify-between gap-3 rounded-md border border-neutral-200 bg-white px-4 py-3 text-sm">
      <div className="min-w-0">
        <p className="font-medium text-neutral-900">{preset.name}</p>
        <p className="mt-0.5 text-xs text-neutral-500">
          {filledSlots.length > 0
            ? `${filledSlots.length} asset${filledSlots.length === 1 ? "" : "s"} selected`
            : "No assets selected"}
          {preset.letter_body ? " · has letter text" : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {canManage && (
          <button
            type="button"
            onClick={() => onEdit(preset)}
            className="text-xs text-neutral-700 hover:underline"
          >
            Edit
          </button>
        )}
        <button
          type="button"
          onClick={() => onClone(preset)}
          className="text-xs text-neutral-700 hover:underline"
        >
          Clone
        </button>
        {canManage && (
          <form action={deletePresetFormAction.bind(null, preset.id)}>
            <button
              type="submit"
              className="text-xs text-red-600 hover:underline"
            >
              Delete
            </button>
          </form>
        )}
      </div>
    </li>
  );
}
