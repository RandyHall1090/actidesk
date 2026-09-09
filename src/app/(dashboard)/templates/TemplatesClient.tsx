"use client";

import { useActionState } from "react";
import { PACKAGE_SLOTS } from "@/lib/packages/slots";
import type { Asset } from "@/lib/assets/types";
import { createPreset, deletePresetFormAction, type ActionResult } from "./actions";

export type Preset = {
  id: string;
  name: string;
  letter_body: string | null;
  created_at: string;
  preset_assets: { slot_name: string; asset_id: string | null }[];
};

const initialState: ActionResult = { ok: true };

export function TemplatesClient({
  assets,
  presets,
}: {
  assets: Asset[];
  presets: Preset[];
}) {
  const [state, formAction, pending] = useActionState(
    createPreset,
    initialState,
  );

  return (
    <div className="space-y-6">
      <form
        action={formAction}
        className="max-w-2xl space-y-3 rounded-lg border border-neutral-200 bg-white p-4"
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
