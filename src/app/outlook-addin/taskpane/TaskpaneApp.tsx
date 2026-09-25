"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createNestablePublicClientApplication } from "@azure/msal-browser";

// ---------------------------------------------------------------------------
// Office.js -- only the surface this taskpane uses.
// ---------------------------------------------------------------------------
type AsyncResult<T> = { status: "succeeded" | "failed"; value: T; error?: { message: string } };
type EmailAddress = { displayName: string; emailAddress: string };
type OfficeItem = {
  from?: EmailAddress;
  to?: EmailAddress[] | { getAsync: (cb: (r: AsyncResult<EmailAddress[]>) => void) => void };
  displayReplyForm?: (data: { htmlBody: string }) => void;
  body?: {
    getTypeAsync: (cb: (r: AsyncResult<string>) => void) => void;
    setSelectedDataAsync: (data: string, options: { coercionType: string }, cb: (r: AsyncResult<void>) => void) => void;
  };
};
type OfficeGlobal = {
  onReady: (cb?: (info: { host: string | null }) => void) => Promise<{ host: string | null }>;
  context: {
    mailbox?: {
      item: OfficeItem | null;
      addHandlerAsync?: (eventType: string, handler: () => void) => void;
    };
  };
  EventType: { ItemChanged: string };
  CoercionType: { Html: string; Text: string };
};
declare global {
  interface Window {
    Office?: OfficeGlobal;
  }
}

const OFFICE_JS = "https://appsforoffice.microsoft.com/lib/1/hosted/office.js";

// One load per page, however many times the effect runs (React runs effects
// twice in development) -- office.js throws if its script executes twice.
let officeJsPromise: Promise<OfficeGlobal | null> | null = null;

function loadOfficeJs(): Promise<OfficeGlobal | null> {
  officeJsPromise ??= new Promise((resolve) => {
    if (window.Office) return resolve(window.Office);
    // office.js deletes history.pushState/replaceState in some hosts (a
    // long-standing known issue), which the Next.js router relies on.
    const { pushState, replaceState } = window.history;
    const script = document.createElement("script");
    script.src = OFFICE_JS;
    script.onload = () => {
      window.history.pushState = pushState;
      window.history.replaceState = replaceState;
      resolve(window.Office ?? null);
    };
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
  return officeJsPromise;
}

// ---------------------------------------------------------------------------
// Types returned by /api/addin/*
// ---------------------------------------------------------------------------
type Session = { rep: { name: string | null; email: string | null }; sendingAs: string | null };
type Options = {
  defaultPresetId: string | null;
  layouts: { id: string; label: string }[];
  defaultLayoutId: string;
  slots: { slot: string; label: string; kind: string }[];
  assets: { id: string; name: string; kind: string }[];
  presets: { id: string; name: string; letterBody: string | null; slots: Record<string, string> }[];
};
type PastPackage = {
  slug: string;
  url: string;
  prospectName: string;
  createdAt: string;
  opened: boolean;
  videoPlayed: boolean;
  sentBy: string;
};
type Contact = { name: string; email: string; company: string };
type MergeItem = { slug: string; url: string; contactName: string; contactEmail: string };

type Mode = "read" | "compose" | "preview";
type Phase =
  | { kind: "loading" }
  | { kind: "not_in_outlook" }
  | { kind: "not_connected" }
  | { kind: "error"; message: string }
  | { kind: "ready" };

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string | null,
  ) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
export function TaskpaneApp({ clientId, apiScope }: { clientId: string; apiScope: string }) {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [mode, setMode] = useState<Mode>("read");
  const [session, setSession] = useState<Session | null>(null);
  const [options, setOptions] = useState<Options | null>(null);
  const [contact, setContact] = useState<Contact>({ name: "", email: "", company: "" });
  const [tab, setTab] = useState<"package" | "merge">("package");
  // Bumped each time Outlook switches to a different email (pinned pane), so
  // the Package tab starts fresh for the new contact instead of offering
  // the previous contact's just-created link.
  const [itemKey, setItemKey] = useState(0);
  const officeRef = useRef<OfficeGlobal | null>(null);
  const getTokenRef = useRef<(() => Promise<string>) | null>(null);

  const api = useCallback(async <T,>(path: string, init?: RequestInit): Promise<T> => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (getTokenRef.current) headers.Authorization = `Bearer ${await getTokenRef.current()}`;
    const response = await fetch(path, { ...init, headers, credentials: "same-origin" });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new ApiError((json as { error?: string }).error ?? `Request failed (${response.status})`, (json as { error?: string }).error ?? null);
    }
    return json as T;
  }, []);

  const readContactFromItem = useCallback(() => {
    const item = officeRef.current?.context.mailbox?.item;
    if (!item) return;
    setItemKey((k) => k + 1);
    const to = item.to;
    if (to && !Array.isArray(to) && typeof to.getAsync === "function") {
      setMode("compose");
      to.getAsync((result) => {
        const first = result.status === "succeeded" ? result.value[0] : undefined;
        setContact((c) => ({ ...c, name: first?.displayName ?? "", email: first?.emailAddress ?? "" }));
      });
    } else {
      setMode("read");
      setContact({ name: item.from?.displayName ?? "", email: item.from?.emailAddress ?? "", company: "" });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const office = await loadOfficeJs();
      const info = office ? await office.onReady() : { host: null };
      const insideOutlook = info.host === "Outlook" && !!office?.context.mailbox;

      if (!insideOutlook) {
        // A normal browser tab: only allowed as a local dev preview, which
        // authenticates with the web app's session cookie (see addinAuth.ts).
        if (window.location.hostname !== "localhost") {
          if (!cancelled) setPhase({ kind: "not_in_outlook" });
          return;
        }
        setMode("preview");
        setContact({ name: "Jordan Sample", email: "jordan.sample@example.com", company: "Example Co" });
      } else {
        officeRef.current = office;
        if (!clientId) {
          if (!cancelled) setPhase({ kind: "error", message: "ActiDesk isn't configured for Outlook sign-in yet." });
          return;
        }
        const pca = await createNestablePublicClientApplication({
          auth: { clientId, authority: "https://login.microsoftonline.com/common" },
        });
        getTokenRef.current = async () => {
          const request = { scopes: [apiScope] };
          try {
            return (await pca.acquireTokenSilent(request)).accessToken;
          } catch {
            return (await pca.acquireTokenPopup(request)).accessToken;
          }
        };
        readContactFromItem();
        office.context.mailbox?.addHandlerAsync?.(office.EventType.ItemChanged, readContactFromItem);
      }

      try {
        const [s, o] = await Promise.all([api<Session>("/api/addin/session"), api<Options>("/api/addin/options")]);
        if (cancelled) return;
        setSession(s);
        setOptions(o);
        setPhase({ kind: "ready" });
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiError && (error.code === "not_connected" || error.code === "inactive")) {
          setPhase({ kind: "not_connected" });
        } else {
          setPhase({ kind: "error", message: error instanceof Error ? error.message : "Couldn't reach ActiDesk." });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, apiScope, clientId, readContactFromItem]);

  if (phase.kind === "loading") return <Shell><p className="text-sm text-neutral-500">Connecting to ActiDesk…</p></Shell>;
  if (phase.kind === "not_in_outlook") {
    return (
      <Shell>
        <p className="text-sm text-neutral-700">This page runs inside Outlook. Open ActiDesk from the Outlook ribbon.</p>
      </Shell>
    );
  }
  if (phase.kind === "not_connected") {
    return (
      <Shell>
        <p className="text-sm text-neutral-700">
          Connect this Outlook account to ActiDesk first. Sign in at ActiDesk, open <strong>Account</strong>, and click{" "}
          <strong>Connect Outlook</strong> using this same Microsoft account. Then reopen this panel.
        </p>
        <a
          href="https://www.actidesk.ai/account"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white"
        >
          Open ActiDesk Account
        </a>
      </Shell>
    );
  }
  if (phase.kind === "error") {
    return (
      <Shell>
        <p className="text-sm text-red-600">{phase.message}</p>
      </Shell>
    );
  }

  return (
    <Shell>
      <p className="text-xs text-neutral-500">
        {session?.rep.name}
        {session?.sendingAs ? ` · sends from ${session.sendingAs}` : ""}
        {mode === "preview" && " · local preview (outside Outlook)"}
      </p>
      <div className="mt-3 flex border-b border-neutral-200">
        {(["package", "merge"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${tab === t ? "border-blue-600 text-blue-700" : "border-transparent text-neutral-500"}`}
          >
            {t === "package" ? "Package" : "List Merge"}
          </button>
        ))}
      </div>
      {tab === "package" && options ? (
        <PackageTab
          key={itemKey}
          api={api}
          options={options}
          onDefaultChange={(id) => setOptions((o) => (o ? { ...o, defaultPresetId: id } : o))}
          contact={contact}
          setContact={setContact}
          mode={mode}
          office={officeRef}
        />
      ) : null}
      {tab === "merge" ? (
        <MergeTab
          api={api}
          defaultTemplateName={options?.presets.find((p) => p.id === options.defaultPresetId)?.name ?? null}
        />
      ) : null}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full bg-white p-3 text-neutral-900">
      <p className="text-sm font-semibold">ActiDesk</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

// The slots nearly every package uses; everything else sits behind "More".
const PRIMARY_SLOTS = new Set(["video", "audio", "business_card", "magazine", "brochure_1"]);

const inputClass = "w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none";
const labelClass = "mb-1 block text-xs font-medium text-neutral-600";

// ---------------------------------------------------------------------------
// Package tab: build one package for the contact in the current email.
// ---------------------------------------------------------------------------
function PackageTab({
  api,
  options,
  onDefaultChange,
  contact,
  setContact,
  mode,
  office,
}: {
  api: <T>(path: string, init?: RequestInit) => Promise<T>;
  options: Options;
  onDefaultChange: (presetId: string | null) => void;
  contact: Contact;
  setContact: (updater: (c: Contact) => Contact) => void;
  mode: Mode;
  office: React.RefObject<OfficeGlobal | null>;
}) {
  // Every new email starts from the rep's default template, if they set one
  // (this tab remounts per email -- see itemKey).
  const defaultPreset = options.presets.find((p) => p.id === options.defaultPresetId);
  const [presetId, setPresetId] = useState(defaultPreset?.id ?? "");
  const [templateId, setTemplateId] = useState(options.defaultLayoutId);
  const [slots, setSlots] = useState<Record<string, string>>(defaultPreset?.slots ?? {});
  const [letter, setLetter] = useState(defaultPreset?.letterBody ?? "");
  const [defaultError, setDefaultError] = useState<string | null>(null);

  async function saveDefault(id: string | null) {
    setDefaultError(null);
    try {
      await api("/api/addin/default-preset", { method: "POST", body: JSON.stringify({ presetId: id }) });
      onDefaultChange(id);
    } catch (error) {
      setDefaultError(error instanceof Error ? error.message : "Couldn't save your default.");
    }
  }
  const [status, setStatus] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [created, setCreated] = useState<{ url: string } | null>(null);
  const [linkText, setLinkText] = useState("I put together a personal page for you");
  const [history, setHistory] = useState<PastPackage[]>([]);

  const loadHistory = useCallback(
    (email: string) =>
      api<{ packages: PastPackage[] }>(`/api/addin/packages?email=${encodeURIComponent(email)}`)
        .then((r) => setHistory(r.packages))
        .catch(() => setHistory([])),
    [api],
  );
  useEffect(() => {
    if (contact.email) loadHistory(contact.email);
  }, [loadHistory, contact.email]);
  const shownHistory = contact.email ? history : [];

  // Only offer slots this rep actually has assets for, and show the
  // everyday ones up front -- fifteen dropdowns is too much for a narrow pane.
  const slotChoices = useMemo(
    () =>
      options.slots
        .map((s) => ({ ...s, assets: options.assets.filter((a) => a.kind === s.kind) }))
        .filter((s) => s.assets.length > 0),
    [options],
  );
  const primarySlots = slotChoices.filter((s) => PRIMARY_SLOTS.has(s.slot));
  const moreSlots = slotChoices.filter((s) => !PRIMARY_SLOTS.has(s.slot));
  // Never hide what the default template filled in.
  const [showMore, setShowMore] = useState(
    () => !!defaultPreset && Object.keys(defaultPreset.slots).some((slot) => !PRIMARY_SLOTS.has(slot)),
  );

  function applyPreset(id: string) {
    setPresetId(id);
    const preset = options.presets.find((p) => p.id === id);
    if (!preset) return;
    setSlots(preset.slots);
    if (preset.letterBody) setLetter(preset.letterBody);
    // Never hide what a preset just filled in.
    if (Object.keys(preset.slots).some((slot) => !PRIMARY_SLOTS.has(slot))) setShowMore(true);
  }

  const renderSlot = (s: (typeof slotChoices)[number]) => (
    <div key={s.slot}>
      <label htmlFor={`slot-${s.slot}`} className={labelClass}>{s.label}</label>
      <select
        id={`slot-${s.slot}`}
        className={inputClass}
        value={slots[s.slot] ?? ""}
        onChange={(e) => setSlots((current) => ({ ...current, [s.slot]: e.target.value }))}
      >
        <option value="">None</option>
        {s.assets.map((a) => (
          <option key={a.id} value={a.id}>{a.name}</option>
        ))}
      </select>
    </div>
  );
  const chosenInMore = moreSlots.filter((s) => slots[s.slot]).length;

  async function handleCreate() {
    setStatus({ tone: "info", text: "Creating package…" });
    try {
      const result = await api<{ url: string }>("/api/addin/packages", {
        method: "POST",
        body: JSON.stringify({
          prospectName: contact.name,
          prospectEmail: contact.email,
          prospectCompany: contact.company,
          letterBody: letter,
          templateId,
          slots,
        }),
      });
      setCreated(result);
      setStatus(null);
      if (contact.email) loadHistory(contact.email);
    } catch (error) {
      setStatus({ tone: "error", text: error instanceof Error ? error.message : "Couldn't create the package." });
    }
  }

  function replyWithPackage() {
    if (!created) return;
    const firstName = contact.name.split(" ")[0] || "there";
    office.current?.context.mailbox?.item?.displayReplyForm?.({
      htmlBody: `<p>Hi ${escapeHtml(firstName)},</p><p><a href="${escapeHtml(created.url)}">${escapeHtml(linkText)}</a></p>`,
    });
  }

  function insertIntoEmail() {
    const body = office.current?.context.mailbox?.item?.body;
    const officeGlobal = office.current;
    if (!created || !body || !officeGlobal) return;
    body.getTypeAsync((typeResult) => {
      const isHtml = typeResult.status === "succeeded" && typeResult.value === "html";
      const data = isHtml
        ? `<a href="${escapeHtml(created.url)}">${escapeHtml(linkText)}</a>`
        : `${linkText}: ${created.url}`;
      body.setSelectedDataAsync(
        data,
        { coercionType: isHtml ? officeGlobal.CoercionType.Html : officeGlobal.CoercionType.Text },
        (result) =>
          setStatus(
            result.status === "succeeded"
              ? { tone: "info", text: "Link inserted into your email." }
              : { tone: "error", text: result.error?.message ?? "Couldn't insert the link." },
          ),
      );
    });
  }

  return (
    <div className="mt-3 space-y-4">
      <section className="space-y-2">
        <div>
          <label htmlFor="prospect-name" className={labelClass}>Prospect name</label>
          <input id="prospect-name" className={inputClass} value={contact.name} onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))} />
        </div>
        <div>
          <label htmlFor="prospect-email" className={labelClass}>Email</label>
          <input id="prospect-email" className={inputClass} value={contact.email} onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))} />
        </div>
        <div>
          <label htmlFor="prospect-company" className={labelClass}>Company</label>
          <input id="prospect-company" className={inputClass} value={contact.company} onChange={(e) => setContact((c) => ({ ...c, company: e.target.value }))} />
        </div>
      </section>

      {shownHistory.length > 0 && (
        <section>
          <p className={labelClass}>Sent to this contact before</p>
          <ul className="space-y-1">
            {shownHistory.map((p) => (
              <li key={p.slug} className="rounded-md border border-neutral-200 px-2 py-1.5 text-xs">
                <a href={p.url} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-700 underline">
                  {new Date(p.createdAt).toLocaleDateString()}
                </a>{" "}
                by {p.sentBy} ·{" "}
                <span className={p.opened ? "text-green-700" : "text-neutral-500"}>{p.opened ? "Opened" : "Not opened yet"}</span>
                {p.videoPlayed && <span className="text-green-700"> · Video played</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {!created && (
        <section className="space-y-2">
          {options.presets.length > 0 && (
            <div>
              <label htmlFor="preset" className={labelClass}>Start from a template</label>
              <select id="preset" className={inputClass} value={presetId} onChange={(e) => applyPreset(e.target.value)}>
                <option value="">— Blank —</option>
                {options.presets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.id === options.defaultPresetId ? " ★" : ""}
                  </option>
                ))}
              </select>
              {presetId && (
                <p className="mt-1 text-xs text-neutral-600">
                  {presetId === options.defaultPresetId ? (
                    <>
                      ★ Your default.{" "}
                      <button type="button" onClick={() => saveDefault(null)} className="underline">
                        Remove default
                      </button>
                    </>
                  ) : (
                    <button type="button" onClick={() => saveDefault(presetId)} className="font-medium text-blue-700 underline">
                      Make this my default
                    </button>
                  )}
                </p>
              )}
              {defaultError && <p className="mt-1 text-xs text-red-600">{defaultError}</p>}
            </div>
          )}
          <div>
            <label htmlFor="layout" className={labelClass}>Layout</label>
            <select id="layout" className={inputClass} value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              {options.layouts.map((l) => (
                <option key={l.id} value={l.id}>{l.label}</option>
              ))}
            </select>
          </div>
          {primarySlots.map(renderSlot)}
          {moreSlots.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowMore((open) => !open)}
                aria-expanded={showMore}
                className="text-xs font-medium text-blue-700 underline"
              >
                {showMore ? "Fewer assets" : `More assets (${moreSlots.length} slots${chosenInMore ? `, ${chosenInMore} chosen` : ""})`}
              </button>
              {showMore && <div className="mt-2 space-y-2">{moreSlots.map(renderSlot)}</div>}
            </div>
          )}
          <div>
            <label htmlFor="letter" className={labelClass}>Letter</label>
            <textarea id="letter" rows={6} className={inputClass} value={letter} onChange={(e) => setLetter(e.target.value)} />
          </div>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!contact.name.trim()}
            className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Create package
          </button>
        </section>
      )}

      {created && (
        <section className="space-y-2 rounded-md border border-green-200 bg-green-50 p-2">
          <p className="text-sm font-medium text-green-800">Package created</p>
          <a href={created.url} target="_blank" rel="noopener noreferrer" className="block break-all text-xs text-blue-700 underline">
            {created.url}
          </a>
          <div>
            <label htmlFor="link-text" className={labelClass}>Link text in the email</label>
            <input id="link-text" className={inputClass} value={linkText} onChange={(e) => setLinkText(e.target.value)} />
          </div>
          {mode === "read" && (
            <button type="button" onClick={replyWithPackage} className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white">
              Reply with this package
            </button>
          )}
          {mode === "compose" && (
            <button type="button" onClick={insertIntoEmail} className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white">
              Insert into email
            </button>
          )}
          {mode === "preview" && <p className="text-xs text-neutral-500">Reply / insert work inside Outlook.</p>}
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(created.url)}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700"
          >
            Copy link
          </button>
          <button type="button" onClick={() => setCreated(null)} className="w-full text-xs text-neutral-500 underline">
            Build another
          </button>
        </section>
      )}

      {status && <p className={`text-sm ${status.tone === "error" ? "text-red-600" : "text-blue-700"}`}>{status.text}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// List Merge tab: one package per contact, sent from the rep's own mailbox.
// ---------------------------------------------------------------------------
function MergeTab({
  api,
  defaultTemplateName,
}: {
  api: <T>(path: string, init?: RequestInit) => Promise<T>;
  defaultTemplateName: string | null;
}) {
  const [contacts, setContacts] = useState<{ id: string; name: string; email: string }[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [letter, setLetter] = useState("Hi {{first_name}},\n\nThought you'd enjoy this.\n");
  const [items, setItems] = useState<MergeItem[] | null>(null);
  const [status, setStatus] = useState<{ tone: "info" | "error"; text: string } | null>(null);

  useEffect(() => {
    api<{ contacts: { id: string; name: string; email: string }[] }>("/api/addin/contacts")
      .then((r) => setContacts(r.contacts))
      .catch((error) => setLoadError(error instanceof Error ? error.message : "Couldn't load your contacts."));
  }, [api]);

  const visible = (contacts ?? []).filter((c) =>
    `${c.name} ${c.email}`.toLowerCase().includes(filter.trim().toLowerCase()),
  );

  async function generate() {
    setStatus({ tone: "info", text: "Creating packages…" });
    try {
      const result = await api<{ items: MergeItem[] }>("/api/addin/list-merge", {
        method: "POST",
        body: JSON.stringify({ step: "generate", contactIds: selected }),
      });
      setItems(result.items);
      setStatus({ tone: "info", text: `Created ${result.items.length} package(s). Review, then send.` });
    } catch (error) {
      setStatus({ tone: "error", text: error instanceof Error ? error.message : "Couldn't create packages." });
    }
  }

  async function send() {
    if (!items || !confirm(`Send ${items.length} email(s) from your mailbox?`)) return;
    setStatus({ tone: "info", text: "Sending…" });
    try {
      const result = await api<{ sent: number; failed: string[] }>("/api/addin/list-merge", {
        method: "POST",
        body: JSON.stringify({ step: "send", letterTemplate: letter, items }),
      });
      setStatus({
        tone: result.failed.length ? "error" : "info",
        text: `Sent ${result.sent} email(s).${result.failed.length ? ` Failed: ${result.failed.join(", ")}` : ""}`,
      });
      setItems(null);
      setSelected([]);
    } catch (error) {
      setStatus({ tone: "error", text: error instanceof Error ? error.message : "Couldn't send." });
    }
  }

  if (loadError) return <p className="mt-3 text-sm text-red-600">{loadError}</p>;
  if (!contacts) return <p className="mt-3 text-sm text-neutral-500">Loading your Outlook contacts…</p>;

  return (
    <div className="mt-3 space-y-3">
      <p className="text-xs text-neutral-600">
        {defaultTemplateName ? (
          <>Each package is built from your ★ default template: <strong>{defaultTemplateName}</strong></>
        ) : (
          <>Set a ★ default template first: on the Package tab, pick a template and click Make this my default.</>
        )}
      </p>
      {!items && (
        <>
          <input className={inputClass} placeholder="Search contacts" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Search contacts" />
          <ul className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-neutral-200 p-2">
            {visible.map((c) => (
              <li key={c.id}>
                <label className="flex items-start gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={selected.includes(c.id)}
                    onChange={(e) =>
                      setSelected((prev) => (e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id)))
                    }
                  />
                  <span>
                    {c.name} <span className="text-neutral-500">({c.email})</span>
                  </span>
                </label>
              </li>
            ))}
            {visible.length === 0 && <li className="text-xs text-neutral-500">No contacts with an email address.</li>}
          </ul>
        </>
      )}
      <div>
        <label htmlFor="merge-letter" className={labelClass}>
          Email text ({"{{first_name}}"}, {"{{full_name}}"} are filled in per contact)
        </label>
        <textarea id="merge-letter" rows={4} className={inputClass} value={letter} onChange={(e) => setLetter(e.target.value)} />
      </div>
      {!items ? (
        <button
          type="button"
          onClick={generate}
          disabled={selected.length === 0 || !defaultTemplateName}
          className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Create {selected.length} package(s)
        </button>
      ) : (
        <>
          <ul className="space-y-1 text-xs">
            {items.map((i) => (
              <li key={i.slug}>
                {i.contactName}:{" "}
                <a href={i.url} target="_blank" rel="noopener noreferrer" className="break-all text-blue-700 underline">
                  {i.url}
                </a>
              </li>
            ))}
          </ul>
          <button type="button" onClick={send} className="w-full rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white">
            Send {items.length} email(s)
          </button>
        </>
      )}
      {status && <p className={`text-sm ${status.tone === "error" ? "text-red-600" : "text-blue-700"}`}>{status.text}</p>}
    </div>
  );
}
