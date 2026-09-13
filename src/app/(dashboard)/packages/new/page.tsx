import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import { getOrg } from "@/lib/org";
import { getOrgLayouts } from "@/lib/packages/getOrgLayouts";
import type { Asset } from "@/lib/assets/types";
import { NewPackageForm, type PresetOption } from "./NewPackageForm";

type PresetRow = {
  id: string;
  name: string;
  letter_body: string | null;
  preset_assets: { slot_name: string; asset_id: string | null }[];
};

export default async function NewPackagePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const [org, layouts, { data: assets, error: assetsError }, { data: presetsData, error: presetsError }] =
    await Promise.all([
      getOrg(profile.org_id),
      getOrgLayouts(profile.org_id),
      supabase
        .from("assets")
        .select(
          "id, org_id, owner_id, scope, kind, name, storage_path, external_url, file_size_bytes, created_at",
        )
        .order("name"),
      supabase
        .from("presets")
        .select("id, name, letter_body, preset_assets(slot_name, asset_id)")
        .order("name"),
    ]);

  const error = assetsError ?? presetsError;
  if (error) {
    return (
      <p className="text-sm text-red-600">
        Couldn&apos;t load your assets: {error.message}
      </p>
    );
  }

  const presets: PresetOption[] = ((presetsData ?? []) as PresetRow[]).map(
    (p) => ({
      id: p.id,
      name: p.name,
      letterBody: p.letter_body,
      slots: Object.fromEntries(
        p.preset_assets
          .filter((pa) => pa.asset_id)
          .map((pa) => [pa.slot_name, pa.asset_id as string]),
      ),
    }),
  );

  return (
    <div>
      <h2 className="text-xl font-semibold text-neutral-900">New Package</h2>
      <p className="mt-1 mb-6 text-sm text-neutral-600">
        Pick assets for this prospect, then send them the link yourself once
        it&apos;s created.
      </p>
      <NewPackageForm
        assets={(assets ?? []) as Asset[]}
        presets={presets}
        orgName={org?.name ?? ""}
        layouts={layouts}
      />
    </div>
  );
}
