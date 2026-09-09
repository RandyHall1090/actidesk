"use client";

import { useCallback, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isLinkKind, type Asset } from "@/lib/assets/types";

export type PreviewAsset = { kind: Asset["kind"]; name: string; url: string };
export type PreviewSlots = Partial<Record<string, PreviewAsset>>;

/**
 * Resolves a selected asset id into something a live desk-scene preview can
 * actually render, without touching a server route: video/audio assets
 * already carry a direct external_url (Vimeo), so those resolve instantly;
 * everything else lives in the private "assets" Storage bucket and needs a
 * signed URL, fetched directly from the browser (same direct-to-Storage
 * pattern already used for uploads in LibraryClient.tsx) rather than a
 * server round-trip.
 *
 * A per-asset-id cache avoids re-signing the same asset on every re-pick
 * within one editing session, and a "latest request wins" guard drops a
 * signed-URL response that's been superseded by a newer selection before
 * it resolves (otherwise a quick pick-then-repick could show a stale
 * preview).
 */
export function usePreviewAssets(assets: Asset[]) {
  const [slotAssets, setSlotAssets] = useState<PreviewSlots>({});
  const signedUrlCache = useRef<Map<string, string>>(new Map());
  const latestRequest = useRef<Record<string, string>>({});

  const setSlot = useCallback(
    (slot: string, assetId: string) => {
      latestRequest.current[slot] = assetId;

      if (!assetId) {
        setSlotAssets((s) => {
          const next = { ...s };
          delete next[slot];
          return next;
        });
        return;
      }

      const asset = assets.find((a) => a.id === assetId);
      if (!asset) return;

      if (isLinkKind(asset.kind)) {
        setSlotAssets((s) => ({
          ...s,
          [slot]: { kind: asset.kind, name: asset.name, url: asset.external_url ?? "" },
        }));
        return;
      }

      const cached = signedUrlCache.current.get(asset.id);
      if (cached) {
        setSlotAssets((s) => ({
          ...s,
          [slot]: { kind: asset.kind, name: asset.name, url: cached },
        }));
        return;
      }

      if (!asset.storage_path) return;
      createClient()
        .storage.from("assets")
        .createSignedUrl(asset.storage_path, 3600)
        .then(({ data }) => {
          if (!data?.signedUrl) return;
          signedUrlCache.current.set(asset.id, data.signedUrl);
          if (latestRequest.current[slot] !== asset.id) return; // superseded by a newer pick
          setSlotAssets((s) => ({
            ...s,
            [slot]: { kind: asset.kind, name: asset.name, url: data.signedUrl },
          }));
        });
    },
    [assets],
  );

  const clearAll = useCallback(() => setSlotAssets({}), []);

  return { slotAssets, setSlot, clearAll };
}
