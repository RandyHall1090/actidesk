"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";

export async function requestIntegration(
  providerName: string,
  note: string,
): Promise<{ ok: boolean; error?: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };

  const supabase = await createClient();
  const { error } = await supabase.from("integration_requests").insert({
    org_id: profile.org_id,
    requested_by: profile.id,
    provider_name: providerName.slice(0, 200),
    note: note.slice(0, 1000) || null,
  });

  if (error) {
    console.error("integration request insert failed:", error);
    return { ok: false, error: "Could not send the request." };
  }
  return { ok: true };
}
