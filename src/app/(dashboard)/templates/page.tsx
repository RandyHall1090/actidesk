import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import type { Asset } from "@/lib/assets/types";
import { TemplatesClient, type Preset } from "./TemplatesClient";

export default async function TemplatesPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") {
    return (
      <p className="text-sm text-neutral-600">
        Only admins can manage templates.
      </p>
    );
  }

  const supabase = await createClient();

  const [{ data: assets, error: assetsError }, { data: presets, error: presetsError }] =
    await Promise.all([
      supabase
        .from("assets")
        .select(
          "id, org_id, owner_id, scope, kind, name, storage_path, external_url, file_size_bytes, created_at",
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("presets")
        .select("id, name, letter_body, created_at, preset_assets(slot_name, asset_id)")
        .order("created_at", { ascending: false }),
    ]);

  const error = assetsError ?? presetsError;
  if (error) {
    return (
      <p className="text-sm text-red-600">
        Couldn&apos;t load templates: {error.message}
      </p>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-neutral-900">Templates</h2>
      <p className="mt-1 mb-6 text-sm text-neutral-600">
        Content presets reps can start a new package from — a saved set of
        asset picks and letter text. Desk-scene layouts (the visual look of
        the package page) are shipped by the dev team and picked per-package
        when creating one.
      </p>
      <TemplatesClient
        assets={(assets ?? []) as Asset[]}
        presets={(presets ?? []) as Preset[]}
      />
    </div>
  );
}
