"use client";

import { useState } from "react";

/**
 * Shows a freshly-generated temporary password exactly once, for an admin
 * to relay directly (Slack/text/verbally) -- there's no email involved in
 * creating a user or resetting their password, deliberately (see
 * spec/plan.md: corporate email-link scanning already broke a link-based
 * flow once for this app). Shared between the Team and Admin pages, which
 * both need the identical UI for this.
 */
export function OneTimePasswordBanner({
  email,
  password,
  onDismiss,
}: {
  email: string;
  password: string;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950 p-4">
      <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
        Temporary password for {email}
      </p>
      <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
        Shown once — copy it now and relay it directly. It won&apos;t be
        shown again.
      </p>
      <div className="mt-2 flex items-center gap-2">
        <code className="flex-1 rounded-md border border-amber-300 dark:border-amber-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100">
          {password}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-md border border-amber-300 dark:border-amber-700 bg-white dark:bg-neutral-900 px-3 py-2 text-xs font-medium text-amber-900 dark:text-amber-200 hover:bg-amber-100"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-300 underline hover:text-amber-900 dark:text-amber-200"
      >
        Dismiss
      </button>
    </div>
  );
}
