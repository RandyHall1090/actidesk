"use client";

import { useState } from "react";
import Link from "next/link";
import { disconnectOutlook } from "./actions";

const OUTCOME_MESSAGES: Record<string, { text: string; tone: "ok" | "error" }> = {
  connected: { text: "Outlook connected.", tone: "ok" },
  cancelled: { text: "Outlook connection was cancelled.", tone: "error" },
  expired: { text: "That sign-in took too long. Try connecting again.", tone: "error" },
  mismatch: {
    text: "That Microsoft sign-in was started from a different ActiDesk account, so it wasn't saved.",
    tone: "error",
  },
  in_use: {
    text: "That Microsoft mailbox is already connected to another ActiDesk account.",
    tone: "error",
  },
  invalid_state: { text: "That sign-in link was invalid or expired. Try connecting again.", tone: "error" },
  error: { text: "Couldn't connect Outlook. Try again, or contact support if it keeps failing.", tone: "error" },
};

export function OutlookConnectionCard({
  connection,
  outcome,
}: {
  connection: { mailboxEmail: string; connectedAt: string } | null;
  outcome: string | null;
}) {
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const message = outcome ? OUTCOME_MESSAGES[outcome] : undefined;

  async function handleDisconnect() {
    if (!confirm("Disconnect Outlook? List Merge will stop working until you reconnect.")) return;
    setDisconnecting(true);
    const result = await disconnectOutlook();
    setDisconnecting(false);
    if (!result.ok) setError(result.error ?? "Something went wrong.");
  }

  return (
    <section className="mb-6 space-y-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-4">
      <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Outlook</h3>
      {message && (
        <p className={`text-sm ${message.tone === "ok" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
          {message.text}
        </p>
      )}
      {connection ? (
        <>
          <p className="text-sm text-neutral-700 dark:text-neutral-300">
            Connected as <strong>{connection.mailboxEmail}</strong>
          </p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            List Merge reads your Outlook contacts and sends from this mailbox. Only you can use
            this connection.
          </p>
          <div className="flex items-center gap-3">
            <Link
              href="/integrations/list-merge"
              className="rounded-md bg-neutral-900 dark:bg-neutral-100 px-4 py-2 text-sm font-medium text-white dark:text-neutral-900"
            >
              Open List Merge
            </Link>
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="text-sm text-neutral-600 underline dark:text-neutral-400 disabled:opacity-50"
            >
              {disconnecting ? "Disconnecting…" : "Disconnect"}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Connect your own Outlook to build packages from your contacts and send from your own
            mailbox. Nobody else on your team can use your connection.
          </p>
          {/* A full-page navigation, not <Link>: this route redirects to Microsoft. */}
          <a
            href="/api/integrations/outlook/connect"
            className="inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Connect Outlook
          </a>
        </>
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </section>
  );
}
