"use client";

import { useEffect, useState } from "react";

declare const Office: {
  onReady: (callback: () => void) => void;
  context: { mailbox: { item: { from?: { emailAddress: string; displayName: string } } } };
};

export default function TaskpanePage() {
  const [contact, setContact] = useState<{ name: string; email: string } | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://appsforoffice.microsoft.com/lib/1/hosted/office.js";
    script.onload = () => {
      Office.onReady(() => {
        const from = Office.context.mailbox.item.from;
        if (from) setContact({ name: from.displayName, email: from.emailAddress });
      });
    };
    document.body.appendChild(script);
  }, []);

  async function handleCreate() {
    if (!contact) return;
    setLoading(true);
    const response = await fetch("/api/integrations/outlook/taskpane-create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: contact.name, email: contact.email }),
      credentials: "include",
    });
    const json = await response.json();
    setResult(json.url ?? json.error);
    setLoading(false);
  }

  return (
    <div style={{ padding: 16, fontFamily: "sans-serif" }}>
      <h3>ActiDesk</h3>
      {!contact && <p>Reading the current message...</p>}
      {contact && (
        <>
          <p>
            Create a package for <strong>{contact.name}</strong> ({contact.email})?
          </p>
          <button onClick={handleCreate} disabled={loading}>
            {loading ? "Creating..." : "Create package"}
          </button>
        </>
      )}
      {result && (
        <p>
          Done:{" "}
          <a href={result} target="_blank" rel="noopener noreferrer">
            {result}
          </a>
        </p>
      )}
    </div>
  );
}
