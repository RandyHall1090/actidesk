"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
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

/**
 * Image/document/business_card/logo assets are uploaded to Storage.
 *
 * The file itself is uploaded client-side, directly from the browser to
 * Supabase Storage (see UploadForm in LibraryClient.tsx) — NOT through this
 * Server Action. Vercel Functions hard-cap request bodies at 4.5MB
 * (413 FUNCTION_PAYLOAD_TOO_LARGE), which real marketing PDFs/images
 * routinely exceed; that limit isn't raiseable via next.config.ts, since
 * it's enforced by the platform, not by Next.js. This action only records
 * the already-uploaded file's metadata, so its request body is a few bytes
 * regardless of file size.
 */
export async function createFileAssetRecord(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };

  const kind = parseKind(formData);
  const name = (formData.get("name") as string | null)?.trim();
  const scope = parseScope(formData);
  const storagePath = (formData.get("storage_path") as string | null)?.trim();
  const fileSize = Number(formData.get("file_size") ?? 0);

  if (!kind || isLinkKind(kind)) {
    return { ok: false, error: "Invalid asset kind for a file upload." };
  }
  if (!name || !storagePath) {
    return {
      ok: false,
      error: "Name and an uploaded file are both required.",
    };
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
    storage_path: storagePath,
    file_size_bytes: fileSize > 0 ? fileSize : null,
  });
  if (error) {
    // Roll back the upload so we don't leak an orphaned storage object.
    await supabase.storage.from("assets").remove([storagePath]);
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
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };

  const supabase = await createClient();

  const { data: asset, error: fetchError } = await supabase
    .from("assets")
    .select("storage_path")
    .eq("id", assetId)
    .single();
  if (fetchError) return { ok: false, error: fetchError.message };

  // RLS silently deletes 0 rows rather than erroring when the caller isn't
  // the owner or an admin in that org -- the count check is what turns
  // that into a real, visible error, and is also what gates the storage
  // removal below so a denied DB delete can never still delete the file.
  const { error, count } = await supabase
    .from("assets")
    .delete({ count: "exact" })
    .eq("id", assetId);
  if (error) return { ok: false, error: error.message };
  if (!count) {
    return { ok: false, error: "You don't have permission to delete this asset." };
  }

  if (asset?.storage_path) {
    await supabase.storage.from("assets").remove([asset.storage_path]);
  }

  revalidatePath("/library");
  return { ok: true };
}
