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

export type ContentDisposition =
  | { mode: "delete" }
  | { mode: "transfer"; targetUserId: string };

// The 4 tables whose owner column CASCADEs from profiles.id (and so,
// transitively, from auth.users.id) -- deleting a user without first
// clearing these would silently take their packages, assets, layouts,
// and presets with them. assets uses owner_id; the other three use
// created_by.
const CASCADING_CONTENT_TABLES = [
  { table: "packages", column: "created_by" },
  { table: "assets", column: "owner_id" },
  { table: "layouts", column: "created_by" },
  { table: "presets", column: "created_by" },
] as const;

/**
 * Permanently deletes a user, first disposing of everything that would
 * otherwise cascade-delete along with their profiles row (packages,
 * assets, layouts, presets -- see CASCADING_CONTENT_TABLES). Content
 * operations run first and are verified successful before the auth user
 * is ever deleted, so a failure partway through leaves the account
 * (and whatever content didn't get reassigned/deleted yet) intact
 * rather than risking an account deleted with content left dangling --
 * auth.users deletion goes through GoTrue's admin API, not raw SQL, so
 * it can't be wrapped in the same database transaction as the content
 * updates regardless; ordering is what keeps this safe.
 */
export async function deleteUserAndReassignContent(
  userId: string,
  disposition: ContentDisposition,
): Promise<UserManagementResult> {
  const admin = createAdminClient();

  for (const { table, column } of CASCADING_CONTENT_TABLES) {
    if (disposition.mode === "transfer") {
      const { error } = await admin
        .from(table)
        .update({ [column]: disposition.targetUserId })
        .eq(column, userId);
      if (error) {
        return { ok: false, error: `Couldn't transfer ${table}: ${error.message}` };
      }
    } else {
      const { error } = await admin.from(table).delete().eq(column, userId);
      if (error) {
        return { ok: false, error: `Couldn't delete ${table}: ${error.message}` };
      }
    }
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
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

  // A deactivated rep's Outlook tokens (Mail.Send on their mailbox) must not
  // outlive their access. Reactivation doesn't restore them -- the rep
  // reconnects. Deleting a user removes them via ON DELETE CASCADE instead.
  if (!active) {
    const { error: outlookError } = await admin
      .from("outlook_connections")
      .delete()
      .eq("user_id", userId);
    if (outlookError) {
      return {
        ok: false,
        error: `Deactivated, but their Outlook connection couldn't be removed -- retry: ${outlookError.message}`,
      };
    }
  }
  return { ok: true };
}
