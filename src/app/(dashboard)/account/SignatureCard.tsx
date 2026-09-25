"use client";

import { useState } from "react";
import { createSignature, refreshSignature, removeSignature } from "./actions";

type Signature = { packageUrl: string; nameplate: string; imageUrl: string | null };

const ALT_TEXT = "See the desk I put together for you";

function signatureHtml(signature: Signature): string {
  return `<a href="${signature.packageUrl}"><img src="${signature.imageUrl}" width="400" alt="${ALT_TEXT}" style="border:0;border-radius:8px;display:block"></a>`;
}

export function SignatureCard({
  signature,
  presets,
  defaultPresetId,
}: {
  signature: Signature | null;
  presets: { id: string; name: string }[];
  defaultPresetId: string | null;
}) {
  const [presetId, setPresetId] = useState(defaultPresetId ?? presets[0]?.id ?? "");
  const [nameplate, setNameplate] = useState("Our Next Client");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  async function run(label: string, action: () => Promise<{ ok: true } | { ok: false; error: string }>, done: string) {
    setBusy(label);
    setMessage(null);
    const result = await action();
    setBusy(null);
    setMessage(result.ok ? { tone: "ok", text: done } : { tone: "error", text: result.error });
  }

  async function copySignature() {
    if (!signature?.imageUrl) return;
    const html = signatureHtml(signature);
    try {
      // text/html so it pastes into Outlook's signature editor as a clickable picture.
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([signature.packageUrl], { type: "text/plain" }),
        }),
      ]);
      setMessage({ tone: "ok", text: "Copied. Paste it into your Outlook signature." });
    } catch {
      setMessage({ tone: "error", text: "Your browser blocked copying. Right-click the picture below and copy it instead." });
    }
  }

  return (
    <section className="mb-6 space-y-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-4">
      <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Email signature</h3>

      {!signature ? (
        <>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Put a picture of your desk in your email signature. Anyone who clicks it sees your own ActiDesk page, and
            every visit shows up in My Sites.
          </p>
          {presets.length === 0 ? (
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Create a template first (Templates page), then come back here.
            </p>
          ) : (
            <>
              <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                Template
                <select
                  value={presetId}
                  onChange={(e) => setPresetId(e.target.value)}
                  className="mt-1 w-full rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-2 py-1.5 text-sm text-neutral-900 dark:text-neutral-100"
                >
                  {presets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.id === defaultPresetId ? " ★" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                Nameplate (&ldquo;Customized for the desk of&rdquo;)
                <input
                  value={nameplate}
                  onChange={(e) => setNameplate(e.target.value)}
                  maxLength={60}
                  className="mt-1 w-full rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-2 py-1.5 text-sm text-neutral-900 dark:text-neutral-100"
                />
              </label>
              <button
                type="button"
                disabled={!presetId || !!busy}
                onClick={() => run("create", () => createSignature(presetId, nameplate), "Your signature is ready.")}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {busy === "create" ? "Building your signature… (about 15 seconds)" : "Create my signature"}
              </button>
            </>
          )}
        </>
      ) : (
        <>
          {signature.imageUrl ? (
            <a href={signature.packageUrl} target="_blank" rel="noopener noreferrer" className="block">
              {/* eslint-disable-next-line @next/next/no-img-element -- the exact file email clients will load */}
              <img src={signature.imageUrl} alt={ALT_TEXT} width={400} className="w-full max-w-[400px] rounded-md" />
            </a>
          ) : (
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Your signature page exists but its picture isn&apos;t made yet. Click Refresh image.
            </p>
          )}
          <p className="break-all text-xs text-neutral-500 dark:text-neutral-400">
            Links to{" "}
            <a href={signature.packageUrl} target="_blank" rel="noopener noreferrer" className="underline">
              {signature.packageUrl}
            </a>{" "}
            (desk of &ldquo;{signature.nameplate}&rdquo;)
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={copySignature}
              disabled={!signature.imageUrl}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Copy signature
            </button>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => run("refresh", refreshSignature, "Picture updated. Copy it into your signature again.")}
              className="text-sm text-neutral-700 underline dark:text-neutral-300 disabled:opacity-50"
            >
              {busy === "refresh" ? "Updating…" : "Refresh image"}
            </button>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => {
                if (confirm("Remove your signature picture? The page itself stays, so links you already sent keep working.")) {
                  run("remove", removeSignature, "Signature removed.");
                }
              }}
              className="text-sm text-neutral-500 underline dark:text-neutral-400 disabled:opacity-50"
            >
              Remove
            </button>
          </div>
          <details className="text-xs text-neutral-600 dark:text-neutral-400">
            <summary className="cursor-pointer font-medium">How to add it to Outlook</summary>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>Click Copy signature above.</li>
              <li>
                Classic Outlook: File → Options → Mail → Signatures. New Outlook or Outlook on the web: Settings →
                Accounts → Signatures.
              </li>
              <li>Click where the picture should go in your signature, paste, and save.</li>
              <li>Changed what&apos;s on your desk? Edit the package in My Sites, click Refresh image, then copy and paste again.</li>
            </ol>
          </details>
        </>
      )}

      {message && (
        <p className={`text-sm ${message.tone === "ok" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
          {message.text}
        </p>
      )}
    </section>
  );
}
