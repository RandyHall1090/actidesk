"use client";

import { useActionState, useEffect, useRef } from "react";
import { PACKAGE_SLOTS } from "@/lib/packages/slots";
import { DESK_LAYOUTS, DEFAULT_LAYOUT_ID } from "@/lib/packages/layouts";
import type { Asset } from "@/lib/assets/types";
import { createPackage, type ActionResult } from "./actions";

export type PresetOption = {
  id: string;
  name: string;
  letterBody: string | null;
  slots: Record<string, string>; // slot_name -> asset_id
};

const initialState: ActionResult = { ok: true };

export function NewPackageForm({
  assets,
  presets,
}: {
  assets: Asset[];
  presets: PresetOption[];
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

  function applyPreset(preset: PresetOption | undefined) {
    for (const s of PACKAGE_SLOTS) {
      const el = slotRefs.current[s.slot];
      if (el) el.value = preset?.slots[s.slot] ?? "";
    }
    if (letterBodyRef.current) {
      letterBodyRef.current.value = preset?.letterBody ?? "";
    }
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
  // after that reset happens.
  useEffect(() => {
    if (presetSelectRef.current) {
      presetSelectRef.current.value = selectedPresetIdRef.current;
    }
    if (layoutSelectRef.current) {
      layoutSelectRef.current.value = selectedLayoutIdRef.current;
    }
    applyPreset(presets.find((p) => p.id === selectedPresetIdRef.current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
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
          }}
          className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
        >
          {DESK_LAYOUTS.map((l) => (
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
  );
}
