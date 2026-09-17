import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import { IntegrationsClient } from "./IntegrationsClient";

export default async function IntegrationsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/");

  const supabase = await createClient();
  const { data: integrations } = await supabase
    .from("integrations")
    .select("provider, status, connected_at")
    .eq("org_id", profile.org_id);

  return <IntegrationsClient integrations={integrations ?? []} />;
}
