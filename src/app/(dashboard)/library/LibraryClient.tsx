"use client";

import { useActionState, useState } from "react";
import {
  ASSET_KINDS,
  isLinkKind,
  type Asset,
  type AssetKind,
} from "@/lib/assets/types";
import {
  createLinkAsset,
  deleteAssetFormAction,
  uploadFileAsset,
  type ActionResult,
} from "./actions";

const initialState: ActionResult = { ok: true };

export function LibraryClient({
  assets,
  currentUserId,
  isAdmin,
}: {
  assets: Asset[];
  currentUserId: string;
  isAdmin: boolean;
}) {
  const [activeKind, setActiveKind] = useState<AssetKind>("video");
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

      <UploadForm kind={activeKind} isAdmin={isAdmin} />

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

function UploadForm({ kind, isAdmin }: { kind: AssetKind; isAdmin: boolean }) {
  const isLink = isLinkKind(kind);
  const [state, formAction, pending] = useActionState(
    isLink ? createLinkAsset : uploadFileAsset,
    initialState,
  );

  return (
    <form
      // Remount on kind change so stale File inputs / action bindings don't
      // carry over between tabs.
      key={kind}
      action={formAction}
      className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4"
    >
      <input type="hidden" name="kind" value={kind} />
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          name="name"
          required
          placeholder="Name"
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
        />
        {isLink ? (
          <input
            name="external_url"
            required
            type="url"
            placeholder="https://vimeo.com/..."
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
          />
        ) : (
          <input
            name="file"
            required
            type="file"
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm file:mr-3 file:rounded file:border-0 file:bg-neutral-100 file:px-2 file:py-1 file:text-sm"
          />
        )}
      </div>
      <div className="flex items-center justify-between gap-3">
        <select
          name="scope"
          defaultValue="personal"
          disabled={!isAdmin}
          className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm disabled:bg-neutral-100 disabled:text-neutral-400"
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
