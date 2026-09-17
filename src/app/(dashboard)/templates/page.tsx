import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import { getOrg } from "@/lib/org";
import { getOrgLayouts } from "@/lib/packages/getOrgLayouts";
import type { Asset } from "@/lib/assets/types";
import { TemplatesClient, type Preset } from "./TemplatesClient";

export default async function TemplatesPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();

  const [org, layouts, { data: assets, error: assetsError }, { data: presets, error: presetsError }] =
    await Promise.all([
      getOrg(profile.org_id),
      getOrgLayouts(profile.org_id),
      supabase
        .from("assets")
        .select(
          "id, org_id, owner_id, scope, kind, name, storage_path, external_url, file_size_bytes, created_at",
        )
        .order("created_at", { ascending: false }),
      // RLS (presets_select_org, migration 0019) already limits this to your
      // own presets plus every company-scope one in the org -- no further
      // filtering needed here.
      supabase
        .from("presets")
        .select(
          "id, name, letter_body, scope, created_by, created_at, preset_assets(slot_name, asset_id)",
        )
        .order("created_at", { ascending: false }),
    ]);

  const error = assetsError ?? presetsError;
  if (error) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400">
        Couldn&apos;t load templates: {error.message}
      </p>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Templates</h2>
      <p className="mt-1 mb-2 text-sm text-neutral-600 dark:text-neutral-400">
        Content presets you can start a new package from — a saved set of
        asset picks and letter text. Keep your own private, or share one with
        your team; clone anyone&apos;s shared template to make your own
        editable version.
      </p>
      {profile.role === "admin" && (
        <p className="mb-6 text-sm">
          <Link
            href="/templates/layout-designer"
            className="font-medium text-neutral-700 dark:text-neutral-300 underline hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            Manage desk layouts →
          </Link>
        </p>
      )}
      <TemplatesClient
        assets={(assets ?? []) as Asset[]}
        presets={(presets ?? []) as Preset[]}
        orgName={org?.name ?? ""}
        layouts={layouts}
        currentUserId={profile.id}
        isAdmin={profile.role === "admin"}
      />
    </div>
  );
}
