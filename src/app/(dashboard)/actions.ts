"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * T38 follow-through settings -- authorization enforced by the database
 * (orgs_update_admin), not this action, same reasoning as setProfileRole
 * in team/actions.ts: a non-admin caller simply updates zero rows.
 */
export async function setFollowUpSettings(
  enabled: boolean,
  days: number,
): Promise<{ ok: boolean; error?: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (days < 1 || days > 90) return { ok: false, error: "Days must be between 1 and 90." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("orgs")
    .update({ follow_up_enabled: enabled, follow_up_days: days })
    .eq("id", profile.org_id);

  if (error) {
    console.error("setFollowUpSettings failed:", error);
    return { ok: false, error: "Could not save settings." };
  }
  revalidatePath("/dashboard");
  return { ok: true };
}
