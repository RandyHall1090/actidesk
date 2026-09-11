import { createAdminClient } from "@/lib/supabase/admin";

export type UserManagementResult =
  | { ok: true; password?: string }
  | { ok: false; error: string };

/**
 * 16 random bytes -> base64url (~22 chars): well over the 8-char minimum
 * this codebase already enforces (ChangePasswordForm.tsx), and paste-safe
 * (no spaces/quotes to mangle) for relaying over Slack/text.
 */
function generateTempPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Buffer.from(bytes).toString("base64url");
}

/**
 * Creates a new user directly, with a system-generated temporary password
 * returned once for the admin to relay -- no invite email, deliberately
 * (see spec/plan.md: corporate email-link scanning already broke a
 * link-based flow once for this app).
 *
 * handle_new_user() (the trigger that used to auto-create a profiles row
 * on signup) was removed in migration 0010, replaced by the self-service
 * complete_signup() RPC -- an admin-created user never runs that RPC, so
 * the profiles row has to be inserted explicitly here, or the new user
 * would sign in to an app that can't find their profile anywhere.
 */
export async function createUserWithTempPassword(
  orgId: string,
  email: string,
  role: "rep" | "admin",
): Promise<UserManagementResult> {
  const admin = createAdminClient();
  const password = generateTempPassword();

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // skips the confirmation-email path entirely
  });
  if (error || !data.user) {
    return { ok: false, error: error?.message ?? "Could not create user." };
  }

  const { error: profileError } = await admin
    .from("profiles")
    .insert({ id: data.user.id, org_id: orgId, role, email });
  if (profileError) {
    // Avoid an orphaned auth.users row with no profile -- every RLS
    // policy and getCurrentProfile() assume one always exists.
    await admin.auth.admin.deleteUser(data.user.id);
    return { ok: false, error: profileError.message };
  }

  return { ok: true, password };
}

export async function resetUserPassword(
  userId: string,
): Promise<UserManagementResult> {
  const admin = createAdminClient();
  const password = generateTempPassword();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password,
  });
  return error ? { ok: false, error: error.message } : { ok: true, password };
}

export async function setUserActive(
  userId: string,
  active: boolean,
): Promise<UserManagementResult> {
  const admin = createAdminClient();

  // Ban/unban auth.users FIRST. If this succeeds but the profiles write
  // below fails, the resulting inconsistent state is "really banned, UI
  // still shows active" -- annoying but safe, and worth a retry. Doing it
  // in the other order risks the opposite: profiles says inactive while
  // auth.users still allows sign-in -- a falsely-reassuring UI.
  const { error: authError } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: active ? "none" : "876000h", // Supabase's own "~100 years" idiom for a permanent ban
  });
  if (authError) return { ok: false, error: authError.message };

  const { error: profileError } = await admin
    .from("profiles")
    .update({ is_active: active })
    .eq("id", userId);
  if (profileError) {
    return {
      ok: false,
      error: `Auth ${active ? "reactivated" : "deactivated"}, but the team list may show the old status until retried: ${profileError.message}`,
    };
  }
  return { ok: true };
}
