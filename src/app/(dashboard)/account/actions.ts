"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/profile";
import {
  createSignatureForRep,
  refreshSignatureImage,
  removeSignatureForRep,
} from "@/lib/signature/signature";

/** Removes only the caller's own Outlook connection (service role, since
 * outlook_connections has no browser-role grants at all). */
export async function disconnectOutlook(): Promise<{ ok: boolean; error?: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };

  const { error } = await createAdminClient()
    .from("outlook_connections")
    .delete()
    .eq("user_id", profile.id);
  if (error) return { ok: false, error: "Could not disconnect Outlook." };

  revalidatePath("/account");
  return { ok: true };
}

type SignatureResult = { ok: true } | { ok: false; error: string };

async function signatureRep() {
  const profile = await getCurrentProfile();
  return profile && profile.is_active ? { id: profile.id, orgId: profile.org_id } : null;
}

export async function createSignature(presetId: string, nameplate: string): Promise<SignatureResult> {
  const rep = await signatureRep();
  if (!rep) return { ok: false, error: "Not signed in." };
  const result = await createSignatureForRep(rep, { presetId, nameplate });
  revalidatePath("/account");
  return result;
}

export async function refreshSignature(): Promise<SignatureResult> {
  const rep = await signatureRep();
  if (!rep) return { ok: false, error: "Not signed in." };
  const result = await refreshSignatureImage(rep);
  revalidatePath("/account");
  return result;
}

export async function removeSignature(): Promise<SignatureResult> {
  const rep = await signatureRep();
  if (!rep) return { ok: false, error: "Not signed in." };
  const result = await removeSignatureForRep(rep);
  revalidatePath("/account");
  return result;
}

/**
 * Authorization is enforced by the database, same reasoning as
 * setProfileRole in team/actions.ts: profiles_update_own already lets a
 * rep update any column on their own row except role/org_id (guarded by
 * the prevent_self_role_escalation trigger), so no extra permission check
 * is needed here beyond scoping the update to the caller's own id.
 */
export async function updateCalendarUrl(
  url: string,
): Promise<{ ok: boolean; error?: string }> {
  const trimmed = url.trim();
  if (trimmed && !/^https?:\/\//i.test(trimmed)) {
    return {
      ok: false,
      error: "Must be a full URL starting with http:// or https://",
    };
  }

  const profile = await getCurrentProfile();
  if (!profile) {
    return { ok: false, error: "Not signed in." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ calendar_url: trimmed || null })
    .eq("id", profile.id);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/account");
  return { ok: true };
}
