import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import { AdminClient, type AdminOrg, type AdminProfile } from "./AdminClient";

export default async function AdminPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!profile.is_platform_admin) {
    return (
      <p className="text-sm text-neutral-600">
        Only Securafy platform admins can access this page.
      </p>
    );
  }

  const supabase = await createClient();
  const [{ data: orgs, error: orgsError }, { data: profiles, error: profilesError }] =
    await Promise.all([
      supabase.from("orgs").select("id, name").order("name"),
      supabase
        .from("profiles")
        .select(
          "id, org_id, email, role, full_name, is_active, is_platform_admin, created_at",
        )
        .order("created_at"),
    ]);

  const error = orgsError ?? profilesError;
  if (error) {
    return (
      <p className="text-sm text-red-600">
        Couldn&apos;t load cross-tenant data: {error.message}
      </p>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-neutral-900">Admin</h2>
      <p className="mt-1 mb-6 text-sm text-neutral-600">
        Securafy platform admin — manage users across every tenant on the
        platform.
      </p>
      <AdminClient
        orgs={(orgs ?? []) as AdminOrg[]}
        profiles={(profiles ?? []) as AdminProfile[]}
      />
    </div>
  );
}
