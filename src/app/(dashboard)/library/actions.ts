"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import { buildAssetStoragePath } from "@/lib/assets/storage-path";
import { isLinkKind, type AssetKind, type AssetScope } from "@/lib/assets/types";

export type ActionResult = { ok: true } | { ok: false; error: string };

function parseKind(formData: FormData): AssetKind | null {
  const kind = formData.get("kind");
  const valid: AssetKind[] = [
    "video",
    "audio",
    "image",
    "document",
    "business_card",
    "logo",
  ];
  return typeof kind === "string" && (valid as string[]).includes(kind)
    ? (kind as AssetKind)
    : null;
}

function parseScope(formData: FormData): AssetScope {
  return formData.get("scope") === "company" ? "company" : "personal";
}

/** Video/audio assets are Vimeo (or similar) links, not uploaded files. */
export async function createLinkAsset(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };

  const kind = parseKind(formData);
  const name = (formData.get("name") as string | null)?.trim();
  const externalUrl = (formData.get("external_url") as string | null)?.trim();
  const scope = parseScope(formData);

  if (!kind || !isLinkKind(kind)) {
    return { ok: false, error: "Invalid asset kind for a link upload." };
  }
  if (!name || !externalUrl) {
    return { ok: false, error: "Name and a URL are both required." };
  }
  if (scope === "company" && profile.role !== "admin") {
    return { ok: false, error: "Only admins can add to the company library." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("assets").insert({
    org_id: profile.org_id,
    owner_id: profile.id,
    scope,
    kind,
    name,
    external_url: externalUrl,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/library");
  return { ok: true };
}

/** Image/document/business_card/logo assets are uploaded to Storage. */
export async function uploadFileAsset(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };

  const kind = parseKind(formData);
  const name = (formData.get("name") as string | null)?.trim();
  const scope = parseScope(formData);
  const file = formData.get("file");

  if (!kind || isLinkKind(kind)) {
    return { ok: false, error: "Invalid asset kind for a file upload." };
  }
  if (!name || !(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Name and a file are both required." };
  }
  if (scope === "company" && profile.role !== "admin") {
    return { ok: false, error: "Only admins can add to the company library." };
  }

  const supabase = await createClient();
  const path = buildAssetStoragePath({
    orgId: profile.org_id,
    scope,
    ownerId: profile.id,
    fileName: file.name,
  });

  const { error: uploadError } = await supabase.storage
    .from("assets")
    .upload(path, file);
  if (uploadError) return { ok: false, error: uploadError.message };

  const { error } = await supabase.from("assets").insert({
    org_id: profile.org_id,
    owner_id: profile.id,
    scope,
    kind,
    name,
    storage_path: path,
    file_size_bytes: file.size,
  });
  if (error) {
    // Roll back the upload so we don't leak an orphaned storage object.
    await supabase.storage.from("assets").remove([path]);
    return { ok: false, error: error.message };
  }

  revalidatePath("/library");
  return { ok: true };
}

/**
 * Bound with .bind(null, assetId) as a <form action>, which requires the
 * exact shape () => Promise<void> — a Promise<ActionResult> is not
 * assignable there even though a plain (non-Promise) value would be.
 */
export async function deleteAssetFormAction(assetId: string): Promise<void> {
  await deleteAsset(assetId);
}

export async function deleteAsset(assetId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: asset, error: fetchError } = await supabase
    .from("assets")
    .select("storage_path")
    .eq("id", assetId)
    .single();
  if (fetchError) return { ok: false, error: fetchError.message };

  const { error } = await supabase.from("assets").delete().eq("id", assetId);
  if (error) return { ok: false, error: error.message };

  if (asset?.storage_path) {
    await supabase.storage.from("assets").remove([asset.storage_path]);
  }

  revalidatePath("/library");
  return { ok: true };
}
