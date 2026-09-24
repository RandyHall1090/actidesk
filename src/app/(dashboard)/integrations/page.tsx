import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { IntegrationsClient } from "./IntegrationsClient";

export default async function IntegrationsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/dashboard");

  // Service role, scoped to the admin's own org: outlook_connections has no
  // browser-role grants, and admins only need counts, never tokens.
  const admin = createAdminClient();
  const [{ count: connectedReps }, { count: activeReps }] = await Promise.all([
    admin
      .from("outlook_connections")
      .select("user_id", { count: "exact", head: true })
      .eq("org_id", profile.org_id),
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("org_id", profile.org_id)
      .eq("is_active", true),
  ]);

  return (
    <IntegrationsClient
      outlookReps={{ connected: connectedReps ?? 0, active: activeReps ?? 0 }}
    />
  );
}
