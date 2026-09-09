import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PackageView, type SlotAsset } from "./PackageView";

type PackageRow = {
  id: string;
  slug: string;
  prospect_name: string;
  prospect_company: string | null;
  letter_body: string | null;
  template_id: string;
  org_name: string;
  org_logo_storage_path: string | null;
};

type SlotRow = {
  slot_name: string;
  kind: string;
  name: string;
  storage_path: string | null;
  external_url: string | null;
};

// Public, unauthenticated page — this is what the prospect opens. Looked up
// via SECURITY DEFINER RPCs (not direct table SELECTs) so an exact slug is
// required; there is no way to browse/enumerate packages. See
// supabase/migrations/0004_public_package_lookup.sql.
export default async function PackagePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: pkgRows, error: pkgError } = await supabase.rpc(
    "get_package_by_slug",
    { p_slug: slug },
  );
  const pkg = (pkgRows as PackageRow[] | null)?.[0];
  if (pkgError || !pkg) notFound();

  const { data: slotRowsData } = await supabase.rpc(
    "get_package_assets_by_slug",
    { p_slug: slug },
  );
  const slotRows = (slotRowsData as SlotRow[] | null) ?? [];

  const slots: SlotAsset[] = [];
  for (const row of slotRows) {
    let url = row.external_url;
    if (!url && row.storage_path) {
      const { data: signed } = await supabase.storage
        .from("assets")
        .createSignedUrl(row.storage_path, 60 * 60); // regenerated on every page load
      url = signed?.signedUrl ?? null;
    }
    if (url) {
      slots.push({ slot: row.slot_name, kind: row.kind, name: row.name, url });
    }
  }

  let orgLogoUrl: string | null = null;
  if (pkg.org_logo_storage_path) {
    const { data: signed } = await supabase.storage
      .from("assets")
      .createSignedUrl(pkg.org_logo_storage_path, 60 * 60);
    orgLogoUrl = signed?.signedUrl ?? null;
  }

  return (
    <PackageView
      packageId={pkg.id}
      templateId={pkg.template_id}
      prospectName={pkg.prospect_name}
      letterBody={pkg.letter_body}
      slots={slots}
      orgName={pkg.org_name}
      orgLogoUrl={orgLogoUrl}
    />
  );
}
