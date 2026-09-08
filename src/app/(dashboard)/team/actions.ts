"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Authorization is enforced by the database, not this action: the
 * profiles_update_admin RLS policy plus the prevent_self_role_escalation
 * trigger mean a non-admin caller simply updates zero rows here, not that
 * this function needs its own permission check to be safe.
 */
export async function setProfileRole(
  profileId: string,
  role: "rep" | "admin",
): Promise<void> {
  const supabase = await createClient();
  await supabase.from("profiles").update({ role }).eq("id", profileId);
  revalidatePath("/team");
}
