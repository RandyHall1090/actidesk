import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import { AdminClient, type AdminOrg, type AdminProfile, type ContentCounts } from "./AdminClient";

export default async function AdminPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!profile.is_platform_admin) {
    return (
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Only Securafy platform admins can access this page.
      </p>
    );
  }

  const supabase = await createClient();
  const [
    { data: orgs, error: orgsError },
    { data: profiles, error: profilesError },
    { data: packageRows, error: packagesError },
    { data: assetRows, error: assetsError },
    { data: layoutRows, error: layoutsError },
    { data: presetRows, error: presetsError },
  ] = await Promise.all([
    supabase.from("orgs").select("id, name").order("name"),
    supabase
      .from("profiles")
      .select(
        "id, org_id, email, role, full_name, is_active, is_platform_admin, created_at",
      )
      .order("created_at"),
    // Deleting a user CASCADEs through created_by/owner_id on all four of
    // these tables -- fetched here (just the owner column, not full rows;
    // platform-wide row counts are small enough that this is simpler and
    // cheaper than a new RPC) so the delete-user dialog can show what's
    // actually at stake before an admin picks delete-or-transfer, with no
    // extra round trip when it opens.
    supabase.from("packages").select("created_by"),
    supabase.from("assets").select("owner_id"),
    supabase.from("layouts").select("created_by"),
    supabase.from("presets").select("created_by"),
  ]);

  const error =
    orgsError ?? profilesError ?? packagesError ?? assetsError ?? layoutsError ?? presetsError;
  if (error) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400">
        Couldn&apos;t load cross-tenant data: {error.message}
      </p>
    );
  }

  const contentCounts: Record<string, ContentCounts> = {};
  function bump(userId: string | null, key: keyof ContentCounts) {
    if (!userId) return;
    const counts = (contentCounts[userId] ??= {
      packages: 0,
      assets: 0,
      layouts: 0,
      presets: 0,
    });
    counts[key] += 1;
  }
  for (const r of packageRows ?? []) bump(r.created_by, "packages");
  for (const r of assetRows ?? []) bump(r.owner_id, "assets");
  for (const r of layoutRows ?? []) bump(r.created_by, "layouts");
  for (const r of presetRows ?? []) bump(r.created_by, "presets");

  return (
    <div>
      <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Admin</h2>
      <p className="mt-1 mb-6 text-sm text-neutral-600 dark:text-neutral-400">
        Securafy platform admin — manage users across every tenant on the
        platform.
      </p>
      <AdminClient
        orgs={(orgs ?? []) as AdminOrg[]}
        profiles={(profiles ?? []) as AdminProfile[]}
        contentCounts={contentCounts}
        currentUserId={profile.id}
      />
    </div>
  );
}
