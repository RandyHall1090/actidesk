"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchOutlookContactsForMerge, generateListMerge } from "./actions";
import { sendListMerge } from "./send-actions";

type Contact = { id: string; name: string; email: string };
type Generated = { slug: string; url: string; contactName: string; contactEmail: string };

function describeSend(result: { sent: number; failed: string[] }): string {
  const sent = `Sent ${result.sent} email(s).`;
  return result.failed.length > 0 ? `${sent} Failed: ${result.failed.join(", ")}` : sent;
}

export function ListMergeClient({
  templateId,
  sendingAs,
  defaultTemplateName,
}: {
  templateId: string;
  sendingAs: string;
  defaultTemplateName: string | null;
}) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsLoaded, setContactsLoaded] = useState(false);
  const [contactsError, setContactsError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [letterTemplate, setLetterTemplate] = useState(
    "Hi {{first_name}},\n\nThought you'd enjoy this.\n",
  );
  const [reviewFirst, setReviewFirst] = useState(true);
  const [generated, setGenerated] = useState<Generated[] | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    fetchOutlookContactsForMerge().then((result) => {
      if (result.ok) setContacts(result.contacts);
      else setContactsError(result.error);
      setContactsLoaded(true);
    });
  }, []);

  async function handleGenerate() {
    setStatus("Generating packages...");
    const result = await generateListMerge({ contactIds: selected, templateId });
    if (!result.ok) {
      setStatus(result.error);
      return;
    }
    const results = result.items;
    setGenerated(results);
    if (!reviewFirst) {
      setStatus("Sending...");
      setStatus(describeSend(await sendListMerge({ letterTemplate, items: results })));
    } else {
      setStatus(`Generated ${results.length} package(s) -- review and send below.`);
    }
  }

  async function handleSendAll() {
    if (!generated) return;
    setStatus("Sending...");
    setStatus(describeSend(await sendListMerge({ letterTemplate, items: generated })));
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
        List Merge (Outlook)
      </h2>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        Contacts and sending use your own mailbox: <strong>{sendingAs}</strong>
      </p>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        {defaultTemplateName ? (
          <>
            Each package is built from your ★ default template: <strong>{defaultTemplateName}</strong>
          </>
        ) : (
          <>
            Set a ★ default template first — open{" "}
            <Link href="/packages/new" className="underline">
              New Package
            </Link>
            , pick a template, and click Make this my default.
          </>
        )}
      </p>

      <ul className="mt-4 max-h-64 space-y-1 overflow-y-auto">
        {contacts.map((c) => (
          <li key={c.id}>
            <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
              <input
                type="checkbox"
                checked={selected.includes(c.id)}
                onChange={(e) =>
                  setSelected((prev) =>
                    e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id),
                  )
                }
              />
              {c.name} ({c.email})
            </label>
          </li>
        ))}
        {!contactsLoaded && <li className="text-sm text-neutral-500">Loading your Outlook contacts…</li>}
        {contactsError && <li className="text-sm text-red-600">{contactsError}</li>}
        {contactsLoaded && !contactsError && contacts.length === 0 && (
          <li className="text-sm text-neutral-500">
            No contacts with an email address found in your Outlook Contacts.
          </li>
        )}
      </ul>

      <label htmlFor="merge-email-text" className="mt-4 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
        Email text ({"{{first_name}}"}, {"{{full_name}}"} are filled in per contact)
      </label>
      <textarea
        id="merge-email-text"
        value={letterTemplate}
        onChange={(e) => setLetterTemplate(e.target.value)}
        rows={4}
        className="mt-1 w-full rounded-md border border-neutral-300 p-2 text-sm"
      />

      <label className="mt-2 flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
        <input
          type="checkbox"
          checked={reviewFirst}
          onChange={(e) => setReviewFirst(e.target.checked)}
        />
        Review before sending
      </label>

      {status && <p className="mt-2 text-sm text-blue-600">{status}</p>}

      <button
        onClick={handleGenerate}
        disabled={selected.length === 0 || !defaultTemplateName}
        className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        Generate {selected.length} package(s)
      </button>

      {reviewFirst && generated && (
        <div className="mt-4">
          <ul className="space-y-1 text-sm">
            {generated.map((g) => (
              <li key={g.slug}>
                {g.contactName}:{" "}
                <a href={g.url} className="underline">
                  {g.url}
                </a>
              </li>
            ))}
          </ul>
          <button
            onClick={handleSendAll}
            className="mt-2 rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Send All
          </button>
        </div>
      )}
    </div>
  );
}
