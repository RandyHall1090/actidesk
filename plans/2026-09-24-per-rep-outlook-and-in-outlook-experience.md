# Per-rep Outlook + the rep experience inside Outlook — plan index

**Status:** Phase 1 shipped (61c49d2). Phase 2 built and locally verified;
end-to-end test waits on the Azure additions and the Microsoft 365
deployment below (only Randy can do those).
**Requested by:** Randy, 2026-09-24 ("plan the per-rep version and make it
happen" + "once connected, the entire experience should live in Outlook").

## Why

The original Outlook integration stored **one connection per org**, tied to
whoever clicked Connect. Graph's `/me/*` calls run as that person, so every
rep using List Merge saw the connector's personal contacts and sent mail
from the connector's mailbox. The marketing site promises the opposite
("from the rep's own mailbox"). The callback also never recorded who
connected, so a second admin connecting silently switched everyone's
sending identity.

## Phase 1 — each rep connects their own Outlook

Outcome: every Graph call (contacts, send) runs against the signed-in rep's
own mailbox, or refuses with "connect your Outlook first".

- **Schema** (migration 0040): `outlook_connections` (one row per profile:
  encrypted tokens, `mailbox_email`, `microsoft_user_id` unique — Phase 2's
  add-in maps a Microsoft sign-in back to a rep through it) and
  `outlook_connection_pending` (short-lived, see binding below). Both
  service-role only: RLS on, no policies, no grants to anon/authenticated.
  Deletes the old org-level `integrations` row for Outlook.
- **Session-bound OAuth**: connect (any active rep) signs `{userId,
  returnOrigin}` into `state`. The callback (registered redirect URI, a
  different host from where many reps are signed in, so it has no session)
  verifies state, exchanges the code, reads Graph `/me`, parks the result in
  a pending row, and hands off to `/finish` on the rep's own host. `/finish`
  requires the rep's live session and a matching user id before storing the
  tokens (RFC 6749 §10.12 — state bound to the user-agent), so a flow
  started by one account can't be completed into another.
- **Graph by user**: `getValidAccessToken(userId)`; List Merge uses
  `profile.id`, shows the sending mailbox, and prompts to connect if none.
- **Offboarding**: deactivating a user deletes their connection; deleting a
  user cascades.
- **UI**: Outlook card on Account (connect / "Connected as …" / disconnect /
  List Merge). Admin Integrations page shows "N of M reps connected"
  instead of an org-wide Connect button. Homepage copy corrected.
- **Randy**: reconnect from Account after deploy.

Acceptance: two reps in one org see only their own contacts and send as
themselves; a state/pending pair can't be completed by a different signed-in
user; a deactivated rep's tokens are gone.

## Phase 2 — the rep experience inside Outlook

Outcome: once a rep has connected Outlook, they can build, send, and track
packages without leaving Outlook.

- Add-in taskpane becomes the full builder (template/layout, video, audio,
  business card, magazine, brochures, letter + presets + merge fields),
  reusing the dashboard's create-package rules rather than the current
  bare `createPackageForContact` stub.
- Read mode: "Reply with a package" (`displayReplyForm` with the link).
  Compose mode: insert the link into the current draft, recipient prefilled
  from To. Manifest v2 adds the compose form + `ReadWriteItem`.
- Engagement panel: the current contact's packages with opened / video
  played status.
- List Merge from the taskpane (Graph, as the rep).
- Auth: Microsoft's nested app authentication in the add-in, token verified
  server-side and mapped to the rep via `outlook_connections.microsoft_user_id`
  — no ActiDesk password inside Outlook (the embedded browser won't carry
  the web app's session cookie anyway). Verify current NAA requirements
  against Microsoft's docs before building; fall back to an Office dialog
  sign-in only if NAA can't cover the Outlook clients reps use.
- Stays in the web app: asset library uploads, templates/layout designer,
  team, billing, admin, blog.
- **Randy**: Azure app registration additions for add-in auth, then deploy
  the add-in to Securafy's Microsoft 365 (admin center → Integrated apps).
  Exact steps provided at that point.

### As built (2026-09-24)

- Auth (`src/lib/integrations/outlook/addinAuth.ts`): MSAL
  `createNestablePublicClientApplication` in the taskpane requests
  `api://<client-id>/access_as_user`; the server verifies signature
  (Microsoft common JWKS, via `jose`), audience, tenant-bound issuer (v1 or
  v2), `azp`/`appid` = this app, and the `access_as_user` scope, then maps
  `oid` to `outlook_connections.microsoft_user_id`. Forged, unsigned, and
  garbage tokens verified rejected. Local `next dev` only: falls back to the
  web session cookie so the pane can be exercised in a browser.
- API (`src/app/api/addin/*`): session, options, packages (GET engagement
  by email / POST create), contacts, list-merge. Service role everywhere,
  with RLS's own predicates restated per query.
- Package creation (`src/lib/packages/createPackageForRep.ts`) mirrors
  savePackage's create path; attachments go through `validateSlotAssets`.
- Manifest v2 (`public/outlook-addin/manifest.xml`): new add-in id,
  VersionOverrides v1.0 + nested v1.1 (pinning), read + compose ribbon
  buttons, `ReadWriteItem`, served from www.actidesk.ai.
- Framing: `/outlook-addin/*` allows only Microsoft Office hosts as
  frame-ancestors; every other route keeps `frame-ancestors 'self'` + XFO.
- Not built: a fallback for Outlook builds without NAA (Microsoft lists NAA
  GA on all current clients; revisit only if a rep's Outlook is too old).
