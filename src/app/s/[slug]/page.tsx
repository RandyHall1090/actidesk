import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLayoutForPublicPage } from "@/lib/packages/getOrgLayouts";
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
      // "document" (brochure/magazine PDFs) gets a download-flagged signed
      // URL -- the DocumentViewer reader's Download button just links
      // straight to this same url, and Supabase's `download` option makes
      // the object's response carry a real Content-Disposition: attachment
      // header, which is what actually makes a clicked link save the file
      // instead of navigating to it (the HTML `download` attribute alone
      // is ignored cross-origin, which this signed URL always is). Every
      // document-kind asset observed in this app is a PDF; ".pdf" isn't
      // derived from the stored file's own extension.
      const { data: signed } = await supabase.storage
        .from("assets")
        .createSignedUrl(
          row.storage_path,
          60 * 60, // regenerated on every page load
          row.kind === "document" ? { download: `${row.name}.pdf` } : undefined,
        );
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

  const layout = await getLayoutForPublicPage(pkg.template_id);

  return (
    <PackageView
      packageId={pkg.id}
      layout={layout}
      prospectName={pkg.prospect_name}
      letterBody={pkg.letter_body}
      slots={slots}
      orgName={pkg.org_name}
      orgLogoUrl={orgLogoUrl}
    />
  );
}
