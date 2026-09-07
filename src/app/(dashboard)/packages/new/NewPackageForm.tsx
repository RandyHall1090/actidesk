"use client";

import { useActionState } from "react";
import { PACKAGE_SLOTS } from "@/lib/packages/slots";
import type { Asset } from "@/lib/assets/types";
import { createPackage, type ActionResult } from "./actions";

const initialState: ActionResult = { ok: true };

export function NewPackageForm({ assets }: { assets: Asset[] }) {
  const [state, formAction, pending] = useActionState(
    createPackage,
    initialState,
  );

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      <fieldset className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4">
        <legend className="px-1 text-sm font-semibold text-neutral-700">
          Prospect
        </legend>
        <input
          name="prospect_name"
          required
          placeholder="Prospect name"
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            name="prospect_company"
            placeholder="Company (optional)"
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
          />
          <input
            name="prospect_email"
            type="email"
            placeholder="Email (optional)"
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
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
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
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
          rows={6}
          placeholder="Hi [Name], ..."
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
        />
      </fieldset>

      <fieldset className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4">
        <legend className="px-1 text-sm font-semibold text-neutral-700">
          Private note (not shown to the prospect)
        </legend>
        <textarea
          name="private_note"
          rows={2}
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
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
