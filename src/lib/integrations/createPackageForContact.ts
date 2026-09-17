import { createAdminClient } from "@/lib/supabase/admin";
import { slugify, randomSuffix } from "@/lib/packages/slug";

/**
 * Independent package-creation path for integration-originated packages
 * (Outlook today, other providers later) -- deliberately not a call into
 * packages/new/actions.ts's savePackage, matching the precedent T33's
 * Gate Desk route already established: a shared refactor of the
 * existing, already-verified dashboard create-package action carries
 * more regression risk than a small independent path with its own
 * slug-collision retry loop.
 */
export async function createPackageForContact(input: {
  orgId: string;
  createdBy: string;
  prospectName: string;
  prospectEmail?: string;
  prospectCompany?: string;
  templateId: string;
}): Promise<{ slug: string; url: string }> {
  const supabase = createAdminClient();
  const base = slugify(input.prospectName);

  for (let attempt = 0; attempt < 3; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${randomSuffix()}`;
    const { data, error } = await supabase
      .from("packages")
      .insert({
        org_id: input.orgId,
        created_by: input.createdBy,
        slug,
        prospect_name: input.prospectName,
        prospect_email: input.prospectEmail ?? null,
        prospect_company: input.prospectCompany ?? null,
        template_id: input.templateId,
      })
      .select("slug")
      .single();

    if (!error && data) {
      return { slug: data.slug, url: `${process.env.NEXT_PUBLIC_SITE_URL}/s/${data.slug}` };
    }
    // Unique-violation on slug -- retry with a fresh suffix; any other
    // error is real and should surface, not be silently retried.
    if (error && error.code !== "23505") {
      throw new Error(`Package creation failed: ${error.message}`);
    }
  }
  throw new Error("Could not generate a unique slug after 3 attempts.");
}
