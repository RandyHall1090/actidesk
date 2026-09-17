"use client";

import { useState } from "react";
import { setFollowUpSettings } from "./actions";

export function FollowUpSettings({
  initialEnabled,
  initialDays,
}: {
  initialEnabled: boolean;
  initialDays: number;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [days, setDays] = useState(initialDays);
  const [status, setStatus] = useState<string | null>(null);

  async function handleSave() {
    const result = await setFollowUpSettings(enabled, days);
    setStatus(result.ok ? "Saved." : (result.error ?? "Something went wrong."));
  }

  return (
    <section className="mb-8 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-4">
      <h3 className="mb-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
        Automated follow-through
      </h3>
      <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
        When a package goes unopened past the threshold below, a fresh follow-up
        package is generated automatically and the sending rep gets an email
        with a ready-to-send link. Nothing is ever emailed to the prospect
        directly.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Enabled
        </label>
        <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
          After
          <input
            type="number"
            min={1}
            max={90}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="w-16 rounded-md border border-neutral-300 px-2 py-1 text-sm"
          />
          days unopened
        </label>
        <button
          onClick={handleSave}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          Save
        </button>
        {status && <span className="text-xs text-neutral-500">{status}</span>}
      </div>
    </section>
  );
}
