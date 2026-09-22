import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import { getOrg } from "@/lib/org";
import { getOrgLayouts } from "@/lib/packages/getOrgLayouts";
import type { Asset } from "@/lib/assets/types";
import { NewPackageForm, type InitialPackage, type PresetOption } from "../../new/NewPackageForm";

type PresetRow = {
  id: string;
  name: string;
  letter_body: string | null;
  preset_assets: { slot_name: string; asset_id: string | null }[];
};

// Editing reuses the exact same form as /packages/new (NewPackageForm),
// prefilled -- one form, one savePackage() action branching on a hidden
// package_id field, matching the templates edit pattern (T17). This is
// also what gives editing a live preview for free: the create form
// already has one.
export default async function EditPackagePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const { slug } = await params;
  const supabase = await createClient();

  const { data: pkg, error: pkgError } = await supabase
    .from("packages")
    .select(
      "id, slug, prospect_name, prospect_company, prospect_email, letter_body, private_note, template_id, created_by",
    )
    .eq("slug", slug)
    .single();

  if (pkgError || !pkg) notFound();

  // packages_update_own_or_admin (RLS, 0035) lets the creating rep or an
  // org admin save changes -- gate the edit page itself the same way,
  // rather than show a form whose Save button would just silently fail
  // under RLS. (Not exploitable as written: profile.id already uniquely
  // identifies one user, profile.role comes from the caller's own
  // session-authenticated profile row, and no field of pkg renders before
  // this check runs -- kept as a fetch-then-check rather than folding
  // into the query above so a mistyped/deleted slug still 404s instead
  // of showing "not yours".)
  if (pkg.created_by !== profile.id && profile.role !== "admin") {
    return (
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Only the rep who created this package, or an admin, can edit it.
      </p>
    );
  }

  const [org, layouts, { data: assets, error: assetsError }, { data: presetsData, error: presetsError }, { data: slotRows, error: slotsError }] =
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
      supabase
        .from("package_assets")
        .select("slot_name, asset_id")
        .eq("package_id", pkg.id),
    ]);

  const error = assetsError ?? presetsError ?? slotsError;
  if (error) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400">
        Couldn&apos;t load this package: {error.message}
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

  const initialPackage: InitialPackage = {
    id: pkg.id,
    slug: pkg.slug,
    prospectName: pkg.prospect_name,
    prospectCompany: pkg.prospect_company ?? "",
    prospectEmail: pkg.prospect_email ?? "",
    letterBody: pkg.letter_body ?? "",
    privateNote: pkg.private_note ?? "",
    templateId: pkg.template_id,
    slots: Object.fromEntries(
      (slotRows ?? [])
        .filter((r) => r.asset_id)
        .map((r) => [r.slot_name, r.asset_id as string]),
    ),
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
        Edit Package — {pkg.prospect_name}
      </h2>
      <p className="mt-1 mb-6 text-sm text-neutral-600 dark:text-neutral-400">
        Saving keeps the same link — anyone who already has it sees your
        changes next time they open it.
      </p>
      <NewPackageForm
        assets={(assets ?? []) as Asset[]}
        presets={presets}
        orgName={org?.name ?? ""}
        layouts={layouts}
        initialPackage={initialPackage}
      />
    </div>
  );
}
