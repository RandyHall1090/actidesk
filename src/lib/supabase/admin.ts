import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for server-only admin/user-management tasks
 * (auth.admin.* calls, and the profiles writes that intentionally rely on
 * prevent_self_role_escalation's auth.role() = 'service_role' escape
 * hatch -- see migration 0014). NEVER import this from a Client Component;
 * the key must never reach the browser.
 *
 * Differs from server.ts/client.ts: no cookies (this client represents no
 * end-user session at all, just a one-off privileged API call), and no
 * session persistence/refresh to configure since there's no session.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
