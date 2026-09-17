"use client";

import { useEffect, useState } from "react";
import { fetchOutlookContactsForMerge, generateListMerge } from "./actions";
import { sendListMerge } from "./send-actions";

type Contact = { id: string; name: string; email: string };
type Generated = { slug: string; url: string; contactName: string; contactEmail: string };

export function ListMergeClient({ templateId }: { templateId: string }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [letterTemplate, setLetterTemplate] = useState(
    "Hi {{first_name}},\n\nThought you'd enjoy this.\n",
  );
  const [reviewFirst, setReviewFirst] = useState(true);
  const [generated, setGenerated] = useState<Generated[] | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    fetchOutlookContactsForMerge().then(setContacts);
  }, []);

  async function handleGenerate() {
    setStatus("Generating packages...");
    const results = await generateListMerge({ contactIds: selected, templateId });
    setGenerated(results);
    if (!reviewFirst) {
      setStatus("Sending...");
      await sendListMerge({ letterTemplate, items: results });
      setStatus(`Sent ${results.length} email(s).`);
    } else {
      setStatus(`Generated ${results.length} package(s) -- review and send below.`);
    }
  }

  async function handleSendAll() {
    if (!generated) return;
    setStatus("Sending...");
    await sendListMerge({ letterTemplate, items: generated });
    setStatus(`Sent ${generated.length} email(s).`);
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
        List Merge (Outlook)
      </h2>

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
        {contacts.length === 0 && (
          <li className="text-sm text-neutral-500">
            No contacts loaded -- connect Outlook first on the Integrations page.
          </li>
        )}
      </ul>

      <textarea
        value={letterTemplate}
        onChange={(e) => setLetterTemplate(e.target.value)}
        rows={4}
        className="mt-4 w-full rounded-md border border-neutral-300 p-2 text-sm"
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
        disabled={selected.length === 0}
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
