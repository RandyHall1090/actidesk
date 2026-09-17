"use client";

import { useState } from "react";
import { requestIntegration } from "./actions";

const PROVIDERS = [
  { id: "outlook", label: "Outlook", available: true },
  { id: "hubspot", label: "HubSpot", available: false },
  { id: "autotask", label: "Autotask", available: false },
  { id: "connectwise", label: "ConnectWise Manage", available: false },
  { id: "generic", label: "Generic (webhook/API key)", available: false },
] as const;

type Integration = { provider: string; status: string; connected_at: string };

export function IntegrationsClient({ integrations }: { integrations: Integration[] }) {
  const [requestNote, setRequestNote] = useState("");
  const [requestTarget, setRequestTarget] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const byProvider = new Map(integrations.map((i) => [i.provider, i]));

  async function handleRequest(providerName: string) {
    const result = await requestIntegration(providerName, requestNote);
    setMessage(result.ok ? "Request sent -- thanks!" : (result.error ?? "Something went wrong."));
    setRequestTarget(null);
    setRequestNote("");
  }

  return (
    <div className="max-w-xl">
      <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
        Integrations
      </h2>
      <p className="mt-1 mb-4 text-sm text-neutral-600 dark:text-neutral-400">
        Connect a CRM/mailbox to create ActiDesk packages from within it and
        bulk-generate personalized packages for a contact list.
      </p>
      {message && <p className="mt-2 mb-2 text-sm text-blue-600">{message}</p>}
      <ul className="space-y-3">
        {PROVIDERS.map((provider) => {
          const connected = byProvider.get(provider.id);
          return (
            <li
              key={provider.id}
              className="flex items-center justify-between rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-3"
            >
              <div>
                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  {provider.label}
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {connected
                    ? `Connected ${new Date(connected.connected_at).toLocaleDateString()}`
                    : "Not connected"}
                </p>
              </div>
              {provider.available ? (
                <a
                  href={connected ? undefined : "/api/integrations/outlook/connect"}
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                >
                  {connected ? "Connected" : "Connect"}
                </a>
              ) : requestTarget === provider.id ? (
                <div className="flex items-center gap-2">
                  <input
                    value={requestNote}
                    onChange={(e) => setRequestNote(e.target.value)}
                    placeholder="Optional note"
                    className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
                  />
                  <button
                    onClick={() => handleRequest(provider.label)}
                    className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white"
                  >
                    Send
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setRequestTarget(provider.id)}
                  className="text-sm text-blue-600 underline"
                >
                  Request this integration
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
