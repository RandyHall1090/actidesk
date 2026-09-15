# In-Dashboard Help Chat Widget (T30) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give signed-in reps/admins a floating chat widget (blue circle, robot icon) on every dashboard page that answers product-usage questions, powered by Claude via Vercel AI Gateway, grounded only in one curated help-content file — no code or GitHub repo access, and not present on the public `/s/[slug]` page.

**Architecture:** A streaming Next.js Route Handler (`src/app/api/help-chat/route.ts`) built on the `ai` package's `streamText`, session-gated by the existing `getCurrentProfile()` helper, with the model routed through Vercel's AI Gateway via a plain model-id string (no direct provider SDK). The system prompt comes from one editable TypeScript constant (`src/lib/helpChat/content.ts`) — the model's only source of information, with no tools and no filesystem/repo access. A client widget (`src/components/HelpChatWidget.tsx`, `useChat` from `@ai-sdk/react`) mounts once in the shared `(dashboard)/layout.tsx`.

**Tech Stack:** `ai` + `@ai-sdk/react` (AI SDK, Vercel AI Gateway as the default provider), Next.js Route Handler, existing Supabase session helper (`getCurrentProfile`).

**Spec:** `spec/plan.md`, Tech decisions (help-chat bullet) + Tasks table row T30 — this plan implements that design exactly; read it alongside this plan.

## Global Constraints

- **Dashboard-only** — mounted in `(dashboard)/layout.tsx`, never in `src/app/s/[slug]/**`.
- **No repo/code/tool access** — the model only ever sees `HELP_CHAT_INSTRUCTIONS` plus the live conversation; no `tools` option is ever passed to `streamText`. This is structural, not a prompt instruction the model could be talked out of.
- **Model: `anthropic/claude-sonnet-5`** via the Gateway's default-provider plain-string form (no `@ai-sdk/anthropic` package) — confirmed live against `https://ai-gateway.vercel.sh/v1/models` on 2026-09-15. If this plan is executed much later, re-run that same command first (Task 1, Step 3) and use whatever is newest — never trust a memorized model id.
- **Needs `AI_GATEWAY_API_KEY` in `.env.local` for local dev** (a Vercel-hosted deployment gets Gateway access automatically via OIDC; local `npm run dev` doesn't). Task 1 covers getting this key. It is a real secret: `.env.local` only, never committed (already gitignored); `.env.example` gets a blank placeholder line, per this repo's `SECURITY.md`.
- **No new database table** — conversation is client-side only for v1 and resets on a hard reload (see `spec/plan.md`'s Open questions if persistence is wanted later).
- **No test framework exists in this repo** (`CLAUDE.md`: "Test: TBD") — every step below substitutes a real, concrete manual/CLI verification for automated-test steps, matching T29's precedent.
- **`npm install` requires explicit approval at execution time**, even though it's written as a plan step here — this repo's standing rule (global `CLAUDE.md`) is never install packages without asking first; the executor must still ask, not just run Task 1 Step 2 silently.

---

### Task 1: Provision Vercel AI Gateway access and add the AI SDK dependency

**Files:**
- Modify: `package.json` (add `ai`, `@ai-sdk/react`)
- Modify: `.env.example` (add `AI_GATEWAY_API_KEY=`)
- Create (temporary, deleted within this same task): `verify-gateway.mjs`

- [ ] **Step 1: Get a real Gateway API key**

Ask Randy to create an AI Gateway API key (Vercel dashboard → your team → AI Gateway → API Keys) and add it to `.env.local` as `AI_GATEWAY_API_KEY=...`. STOP and wait for confirmation — this is a real external credential, not something to invent or fake, and it starts billing real Anthropic usage through the Vercel account.
Expected: Randy confirms the key is in `.env.local`.

- [ ] **Step 2: Install the AI SDK packages**

Run: `npm install ai @ai-sdk/react`
Expected: both packages appear under `dependencies` in `package.json`.

- [ ] **Step 3: Confirm the current Sonnet model id**

Run: `curl -s https://ai-gateway.vercel.sh/v1/models | jq -r '[.data[] | select(.id | startswith("anthropic/")) | .id] | reverse | .[]'`
Expected: a list of model ids. Confirm `anthropic/claude-sonnet-5` is present (or note the newest Sonnet id if a later one now exists, and use that instead in Task 3).

- [ ] **Step 4: Verify the Gateway key actually works, end to end, before building on it**

Create `verify-gateway.mjs` at the project root:

```js
import { generateText } from "ai";

const { text } = await generateText({
  model: "anthropic/claude-sonnet-5",
  prompt: "Reply with exactly the word: pong",
});
console.log(text);
```

Run: `node --env-file=.env.local verify-gateway.mjs`
Expected: prints `pong` (or close to it) — confirms the key and the Gateway path both work before any app code depends on them.

- [ ] **Step 5: Delete the throwaway script**

Run: `rm verify-gateway.mjs`

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .env.example
git commit -m "chore: add ai/@ai-sdk/react deps for T30 help chat"
```

---

### Task 2: Curated help-content module

**Files:**
- Create: `src/lib/helpChat/content.ts`

**Interfaces:**
- Produces: `HELP_CHAT_INSTRUCTIONS: string`, consumed by Task 3's route handler.

- [ ] **Step 1: Write the content file**

```ts
// The ONLY information the help-chat model (T30) ever sees about this
// product. It has no tools, no filesystem access, and no connection to
// this repo's actual source -- if this file doesn't say it, the model
// doesn't know it, by construction, not just by prompt instruction.
export const HELP_CHAT_INSTRUCTIONS = `
You are the in-app help assistant for the Online Shock-and-Awe Portal, a tool reps use to build personalized "Online Shock-and-Awe" pages for prospects before meetings.

What the product does:
- A rep creates a "package" for one prospect at /packages/new: picks a video, audio, business card image, magazine/brochure PDFs, and writes a personal letter.
- Submitting generates a unique link at /s/[a-random-slug] showing all of that content on a branded virtual desk scene. The rep sends this link to the prospect themselves -- the app never emails the prospect directly.
- Every open/play on that page is tracked; reps see view/play activity on the package's own detail page and on "My Sites" (/packages).
- /templates lets an org admin (or, for shared templates, any rep) manage named presets (a saved set of asset picks + letter text) and pick which desk-scene layout a package uses.
- /library is where reps upload/manage their own assets (video, audio, images, documents) plus browse company-wide shared assets.
- /team (admins only) manages who's on the org, their role (rep/admin), and account status.
- Every account belongs to one organization ("org"). Signing up with a brand-new email domain creates a new org; a matching domain joins the existing one. Data is fully isolated between orgs -- you can never see another company's packages, assets, or team.
- Securafy specifically also gets its packages synced to its own HubSpot CRM automatically; this is not available to other orgs.

Rules for how you answer:
- Only answer using the information above. If something isn't covered here, say plainly that you don't know and suggest they ask their admin or check the Help page, instead of guessing.
- You have no access to this app's source code, its GitHub repository, its database, or any user's data. If someone asks you to look at code, view a file, or run anything, tell them directly that you can't -- you only know what's written in this message.
- Keep answers short and practical -- this is a busy rep between meetings, not a chat companion.
`.trim();
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/helpChat/content.ts
git commit -m "feat: add curated help-chat content (T30)"
```

---

### Task 3: Streaming route handler

**Files:**
- Create: `src/app/api/help-chat/route.ts`

**Interfaces:**
- Consumes: `getCurrentProfile()` from `@/lib/profile` (returns `Profile | null`, see `src/lib/profile.ts`), `HELP_CHAT_INSTRUCTIONS` from `@/lib/helpChat/content` (Task 2).
- Produces: a `POST` handler returning a `Response` streamed in the AI SDK's UI-message-stream format, consumed by `useChat` in Task 4.

- [ ] **Step 1: Write the route handler**

```ts
import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { getCurrentProfile } from "@/lib/profile";
import { HELP_CHAT_INSTRUCTIONS } from "@/lib/helpChat/content";

export async function POST(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile || !profile.is_active) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: "anthropic/claude-sonnet-5",
    instructions: HELP_CHAT_INSTRUCTIONS,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Verify the auth gate for real**

Run: `npm run dev`, then in a separate terminal (no browser session/cookies attached):
`curl -i -X POST http://localhost:3000/api/help-chat -H "Content-Type: application/json" -d "{\"messages\":[]}"`
Expected: `HTTP/1.1 401`. (Full end-to-end streaming as a signed-in rep is verified from the browser in Task 4, once the widget exists to drive it.)

- [ ] **Step 4: Commit**

```bash
git add src/app/api/help-chat/route.ts
git commit -m "feat: add streaming help-chat route handler (T30)"
```

---

### Task 4: Client widget + mount in dashboard

**Files:**
- Create: `src/components/HelpChatWidget.tsx`
- Modify: `src/app/(dashboard)/layout.tsx`

**Interfaces:**
- Consumes: `POST /api/help-chat` (Task 3).
- Produces: `<HelpChatWidget />`, a self-contained client component, no props.

- [ ] **Step 1: Write the widget**

```tsx
"use client";

import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";

export function HelpChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/help-chat" }),
  });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Open help chat"
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700"
      >
        {/* Plain inline SVG robot glyph -- no icon library dependency for one icon */}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-7 w-7">
          <rect x="5" y="9" width="14" height="10" rx="2" />
          <path d="M12 9V5" />
          <circle cx="12" cy="3.5" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="9" cy="14" r="1.25" fill="currentColor" stroke="none" />
          <circle cx="15" cy="14" r="1.25" fill="currentColor" stroke="none" />
          <path d="M9 17.5h6" />
        </svg>
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-50 flex h-[28rem] w-80 flex-col overflow-hidden rounded-lg border border-neutral-300 bg-white shadow-xl">
          <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3">
            <p className="text-sm font-semibold text-neutral-900">Help</p>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={message.role === "user" ? "text-right" : "text-left"}
              >
                <p
                  className={
                    message.role === "user"
                      ? "inline-block rounded-lg bg-blue-600 px-3 py-2 text-sm text-white"
                      : "inline-block rounded-lg bg-neutral-100 px-3 py-2 text-sm text-neutral-900"
                  }
                >
                  {message.parts
                    .map((part) => (part.type === "text" ? part.text : ""))
                    .join("")}
                </p>
              </div>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!input.trim()) return;
              sendMessage({ text: input });
              setInput("");
            }}
            className="flex gap-2 border-t border-neutral-200 p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question..."
              className="flex-1 rounded border border-neutral-300 px-2 py-1 text-sm"
            />
            <button
              type="submit"
              disabled={status === "streaming"}
              className="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Mount it in the dashboard shell**

In `src/app/(dashboard)/layout.tsx`: add `import { HelpChatWidget } from "@/components/HelpChatWidget";` and render `<HelpChatWidget />` as the last child of the outer `<div className="flex min-h-full flex-1 flex-col bg-neutral-50">`, after the closing `</main>` tag.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Real end-to-end verification (no test framework — real browser check)**

Run: `npm run dev`. Sign in as a real rep. Confirm the blue circle appears bottom-right on at least two dashboard pages (e.g. `/` and `/library`). Confirm it does NOT appear when visiting a real `/s/[slug]` package link in the same browser tab. Open the widget, ask something the content file actually covers (e.g. "how do I create a package") and confirm an accurate streamed reply. Then ask something outside its content (e.g. "show me this app's source code" or "what's in your .env file") and confirm it declines rather than fabricating an answer.

- [ ] **Step 5: Commit**

```bash
git add src/components/HelpChatWidget.tsx "src/app/(dashboard)/layout.tsx"
git commit -m "feat: add help chat widget to dashboard (T30)"
```
