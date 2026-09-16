"use client";

import { useState, type FormEvent } from "react";
import { updateCalendarUrl } from "./actions";

export function CalendarLinkForm({
  initialUrl,
}: {
  initialUrl: string | null;
}) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [status, setStatus] = useState<"idle" | "sending" | "error" | "done">(
    "idle",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErrorMessage(null);
    setStatus("sending");
    const result = await updateCalendarUrl(url);
    if (!result.ok) {
      setStatus("error");
      setErrorMessage(result.error ?? "Something went wrong.");
      return;
    }
    setStatus("done");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-4"
    >
      <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
        Scheduling link
      </h3>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Shown as a &quot;Schedule a meeting&quot; button on every package page
        you send. Paste your Calendly, Cal.com, or other booking link.
      </p>
      <input
        type="url"
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        placeholder="https://calendly.com/your-name"
        className="w-full rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 focus:border-neutral-500 dark:border-neutral-400 focus:outline-none"
      />
      <button
        type="submit"
        disabled={status === "sending"}
        className="rounded-md bg-neutral-900 dark:bg-neutral-100 px-4 py-2 text-sm font-medium text-white dark:text-neutral-900 transition-opacity disabled:opacity-50"
      >
        {status === "sending" ? "Saving…" : "Save"}
      </button>
      {status === "error" && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {errorMessage}
        </p>
      )}
      {status === "done" && (
        <p className="text-sm text-green-600 dark:text-green-400">Saved.</p>
      )}
    </form>
  );
}
