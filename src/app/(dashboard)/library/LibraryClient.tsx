"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { buildAssetStoragePath } from "@/lib/assets/storage-path";
import {
  ASSET_KINDS,
  isLinkKind,
  type Asset,
  type AssetKind,
  type AssetScope,
} from "@/lib/assets/types";
import {
  createLinkAsset,
  createFileAssetRecord,
  deleteAssetFormAction,
  type ActionResult,
} from "./actions";

const initialState: ActionResult = { ok: true };

export function LibraryClient({
  assets,
  currentUserId,
  orgId,
  isAdmin,
}: {
  assets: Asset[];
  currentUserId: string;
  orgId: string;
  isAdmin: boolean;
}) {
  const [activeKind, setActiveKind] = useState<AssetKind>("video");
  // Lifted out of UploadForm (rather than local state there) so it survives
  // both the per-submission form reset (React resets uncontrolled fields
  // after a successful action) and the remount on tab change below --
  // otherwise every upload, or every tab switch, silently snapped back to
  // "My library".
  const [scope, setScope] = useState<AssetScope>("personal");
  const kindAssets = assets.filter((a) => a.kind === activeKind);
  const companyAssets = kindAssets.filter((a) => a.scope === "company");
  const myAssets = kindAssets.filter(
    (a) => a.scope === "personal" && a.owner_id === currentUserId,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-neutral-200 pb-3">
        {ASSET_KINDS.map((k) => (
          <button
            key={k.value}
            type="button"
            onClick={() => setActiveKind(k.value)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeKind === k.value
                ? "bg-neutral-900 text-white"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>

      <UploadForm
        // Remounts UploadForm entirely on tab change, clearing its
        // useActionState error/pending along with the form fields. The old
        // key on the inner <form> only reset the DOM form (fixing stale
        // file inputs) but not the hook state living in this component,
        // which doesn't remount just because a key deeper in its own JSX
        // changes -- a leftover "Name and a file are both required" error
        // from a different, file-based tab was showing up on the Video
        // link tab, which has no file field at all.
        key={activeKind}
        kind={activeKind}
        isAdmin={isAdmin}
        orgId={orgId}
        ownerId={currentUserId}
        scope={scope}
        onScopeChange={setScope}
      />

      <div className="grid gap-6 sm:grid-cols-2">
        <AssetColumn
          title="Company Library"
          assets={companyAssets}
          canDelete={isAdmin}
        />
        <AssetColumn title="My Library" assets={myAssets} canDelete />
      </div>
    </div>
  );
}

function UploadForm({
  kind,
  isAdmin,
  orgId,
  ownerId,
  scope,
  onScopeChange,
}: {
  kind: AssetKind;
  isAdmin: boolean;
  orgId: string;
  ownerId: string;
  scope: AssetScope;
  onScopeChange: (scope: AssetScope) => void;
}) {
  const isLink = isLinkKind(kind);

  // File kinds upload directly from the browser to Supabase Storage, not
  // through this Server Action's request body — Vercel Functions hard-cap
  // request bodies at 4.5MB (413 FUNCTION_PAYLOAD_TOO_LARGE), which real
  // marketing PDFs/images routinely exceed, and that limit can't be raised
  // via next.config.ts since it's enforced by the platform. Only the
  // resulting storage path + file size (a few bytes) go through the
  // action, matching Vercel's own recommended pattern for large uploads.
  async function uploadFileThenRecord(
    _prev: ActionResult,
    formData: FormData,
  ): Promise<ActionResult> {
    const file = formData.get("file");
    const name = (formData.get("name") as string | null)?.trim();
    const scope = (
      formData.get("scope") === "company" ? "company" : "personal"
    ) as AssetScope;

    if (!name || !(file instanceof File) || file.size === 0) {
      return { ok: false, error: "Name and a file are both required." };
    }
    if (scope === "company" && !isAdmin) {
      return {
        ok: false,
        error: "Only admins can add to the company library.",
      };
    }

    const path = buildAssetStoragePath({
      orgId,
      scope,
      ownerId,
      fileName: file.name,
    });

    const supabase = createClient();
    const { error: uploadError } = await supabase.storage
      .from("assets")
      .upload(path, file);
    if (uploadError) return { ok: false, error: uploadError.message };

    const recordFormData = new FormData();
    recordFormData.set("kind", kind);
    recordFormData.set("name", name);
    recordFormData.set("scope", scope);
    recordFormData.set("storage_path", path);
    recordFormData.set("file_size", String(file.size));
    return createFileAssetRecord(_prev, recordFormData);
  }

  const [state, formAction, pending] = useActionState(
    isLink ? createLinkAsset : uploadFileThenRecord,
    initialState,
  );

  // React resets every field to its default after a successful action --
  // including this one, via a native form.reset() that overwrites the
  // <select>'s DOM value directly, bypassing the controlled `value` prop
  // (confirmed live: value={scope} alone wasn't enough, it still snapped
  // back to "personal"). Re-assert the real value on the DOM node right
  // after that reset happens.
  const scopeSelectRef = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    if (scopeSelectRef.current) scopeSelectRef.current.value = scope;
  }, [state, scope]);

  return (
    <form
      action={formAction}
      className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4"
    >
      <input type="hidden" name="kind" value={kind} />
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          name="name"
          required
          placeholder="Name"
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none"
        />
        {isLink ? (
          <input
            name="external_url"
            required
            type="url"
            placeholder="https://vimeo.com/..."
            className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none"
          />
        ) : (
          <input
            name="file"
            required
            type="file"
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-900 file:mr-3 file:rounded file:border-0 file:bg-neutral-100 file:px-2 file:py-1 file:text-sm"
          />
        )}
      </div>
      <div className="flex items-center justify-between gap-3">
        <select
          ref={scopeSelectRef}
          name="scope"
          value={scope}
          onChange={(event) =>
            onScopeChange(event.target.value as AssetScope)
          }
          disabled={!isAdmin}
          className="rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900 disabled:bg-neutral-100 disabled:text-neutral-400"
        >
          <option value="personal">My library</option>
          {isAdmin && <option value="company">Company library</option>}
        </select>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add"}
        </button>
      </div>
      {!state.ok && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}
    </form>
  );
}

function AssetColumn({
  title,
  assets,
  canDelete,
}: {
  title: string;
  assets: Asset[];
  canDelete: boolean;
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-neutral-700">{title}</h3>
      {assets.length === 0 ? (
        <p className="text-sm text-neutral-400">Nothing here yet.</p>
      ) : (
        <ul className="space-y-2">
          {assets.map((asset) => (
            <li
              key={asset.id}
              className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm"
            >
              <span className="truncate">{asset.name}</span>
              {canDelete && (
                <form action={deleteAssetFormAction.bind(null, asset.id)}>
                  <button
                    type="submit"
                    className="shrink-0 text-xs text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
