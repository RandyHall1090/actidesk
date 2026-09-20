"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { SECURAFY_ORG_ID } from "@/lib/hubspot";
import {
  createUserWithTempPassword,
  resetUserPassword,
  setUserActive,
  type UserManagementResult,
} from "@/lib/user-management";

/**
 * Every action here is gated purely on is_platform_admin -- no org
 * restriction, by design (that's the whole point of the cross-tenant
 * Admin surface, per Randy's confirmed "full cross-tenant access" scope).
 * Same reasoning as team/actions.ts for why this check has to be explicit:
 * the underlying calls go through the service-role client, which bypasses
 * RLS entirely.
 */
async function assertPlatformAdmin(): Promise<string | null> {
  const profile = await getCurrentProfile();
  if (!profile?.is_platform_admin) return "Not authorized.";
  return null;
}

/**
 * Creates a brand-new tenant: the org row plus its first admin user, in one
 * action. The only other way an org gets created today is the self-service
 * complete_signup() RPC's "create" branch -- this mirrors that exactly
 * (email_domain derived from the admin's own email, same uniqueness
 * behavior) but lets a platform admin do it directly, without that person
 * having to sign up themselves first.
 */
export async function adminCreateOrg(
  companyName: string,
  adminEmail: string,
  billingExempt: boolean,
): Promise<UserManagementResult> {
  const authError = await assertPlatformAdmin();
  if (authError) return { ok: false, error: authError };

  const creator = await getCurrentProfile();
  const emailDomain = adminEmail.trim().toLowerCase().split("@")[1];
  if (!emailDomain) return { ok: false, error: "Invalid email address." };

  const admin = createAdminClient();
  const { data: org, error: orgError } = await admin
    .from("orgs")
    .insert({
      name: companyName.trim(),
      email_domain: emailDomain,
      created_by: creator!.id,
      billing_exempt: billingExempt,
      // Matches migration 0030's own precedent for Securafy's exempt org --
      // exempt orgs are marked active, never left in the default "trialing".
      ...(billingExempt ? { subscription_status: "active" } : {}),
    })
    .select("id")
    .single();

  if (orgError) {
    if (orgError.code === "23505") {
      return { ok: false, error: "An organization already exists for this email domain." };
    }
    return { ok: false, error: orgError.message };
  }

  const result = await createUserWithTempPassword(org.id, adminEmail, "admin");
  if (!result.ok) {
    // Don't leave an empty, unusable org behind if the first user couldn't
    // be created.
    await admin.from("orgs").delete().eq("id", org.id);
    return result;
  }

  revalidatePath("/admin");
  return result;
}

export async function adminAddUser(
  orgId: string,
  email: string,
  role: "rep" | "admin",
): Promise<UserManagementResult> {
  const authError = await assertPlatformAdmin();
  if (authError) return { ok: false, error: authError };
  const result = await createUserWithTempPassword(orgId, email, role);
  if (result.ok) revalidatePath("/admin");
  return result;
}

export async function adminResetUserPassword(
  userId: string,
): Promise<UserManagementResult> {
  const authError = await assertPlatformAdmin();
  if (authError) return { ok: false, error: authError };
  const result = await resetUserPassword(userId);
  if (result.ok) revalidatePath("/admin");
  return result;
}

export async function adminSetUserActive(
  userId: string,
  active: boolean,
): Promise<UserManagementResult> {
  const authError = await assertPlatformAdmin();
  if (authError) return { ok: false, error: authError };
  const result = await setUserActive(userId, active);
  if (result.ok) revalidatePath("/admin");
  return result;
}

export async function adminSetProfileRole(
  profileId: string,
  role: "rep" | "admin",
): Promise<UserManagementResult> {
  const authError = await assertPlatformAdmin();
  if (authError) return { ok: false, error: authError };
  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ role })
    .eq("id", profileId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  return { ok: true };
}

export async function adminSetPlatformAdmin(
  profileId: string,
  isPlatformAdmin: boolean,
): Promise<UserManagementResult> {
  const authError = await assertPlatformAdmin();
  if (authError) return { ok: false, error: authError };

  const admin = createAdminClient();
  if (isPlatformAdmin) {
    // Friendlier than the raw CHECK-constraint-violation message the DB
    // would otherwise return -- the constraint (profiles_platform_admin_
    // only_securafy, migration 0014) is still the real, un-bypassable
    // backstop, this is just a nicer error on the way there.
    const { data: target } = await admin
      .from("profiles")
      .select("org_id")
      .eq("id", profileId)
      .single();
    if (target?.org_id !== SECURAFY_ORG_ID) {
      return {
        ok: false,
        error: "Platform admin can only be granted within Securafy's own org.",
      };
    }
  }

  const { error } = await admin
    .from("profiles")
    .update({ is_platform_admin: isPlatformAdmin })
    .eq("id", profileId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  return { ok: true };
}
