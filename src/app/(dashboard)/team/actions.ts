"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import {
  createUserWithTempPassword,
  resetUserPassword,
  setUserActive,
  type UserManagementResult,
} from "@/lib/user-management";

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

/**
 * addTeamMember/resetTeamMemberPassword/setTeamMemberActive all go through
 * the service-role client (user-management.ts), which bypasses RLS
 * entirely -- unlike setProfileRole above, the database can't protect
 * these on its own, so each one explicitly checks the caller is an admin
 * (and, for the latter two, that the target profile is actually in the
 * caller's own org) before doing anything.
 */
export async function addTeamMember(
  email: string,
  role: "rep" | "admin",
): Promise<UserManagementResult> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    return { ok: false, error: "Only admins can add users." };
  }
  const result = await createUserWithTempPassword(profile.org_id, email, role);
  if (result.ok) revalidatePath("/team");
  return result;
}

async function assertSameOrgTarget(
  callerOrgId: string,
  targetUserId: string,
): Promise<string | null> {
  const supabase = await createClient();
  const { data: target } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", targetUserId)
    .single();
  if (!target || target.org_id !== callerOrgId) {
    return "User not found in your organization.";
  }
  return null;
}

export async function resetTeamMemberPassword(
  userId: string,
): Promise<UserManagementResult> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    return { ok: false, error: "Only admins can reset passwords." };
  }
  const orgError = await assertSameOrgTarget(profile.org_id, userId);
  if (orgError) return { ok: false, error: orgError };
  const result = await resetUserPassword(userId);
  if (result.ok) revalidatePath("/team");
  return result;
}

export async function setTeamMemberActive(
  userId: string,
  active: boolean,
): Promise<UserManagementResult> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    return { ok: false, error: "Only admins can deactivate/reactivate users." };
  }
  const orgError = await assertSameOrgTarget(profile.org_id, userId);
  if (orgError) return { ok: false, error: orgError };
  const result = await setUserActive(userId, active);
  if (result.ok) revalidatePath("/team");
  return result;
}
