"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";

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
