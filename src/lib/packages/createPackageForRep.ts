import { createAdminClient } from "@/lib/supabase/admin";
import { requireActiveBilling } from "@/lib/billing";
import { syncPackageToHubSpot } from "@/lib/hubspot";
import { getSiteUrl } from "@/lib/env";
import { DESK_LAYOUTS, DEFAULT_LAYOUT_ID } from "./layouts";
import { randomSuffix, slugify } from "./slug";
import { validateSlotAssets, type SlotSelection } from "./slotAssets";

// Package creation for callers without a Supabase session (the Outlook
// add-in's API). Mirrors savePackage's create path rule for rule -- same
// limits, email check, template resolution, billing gate, slot validation,
// always-suffixed slug, HubSpot sync -- but on the service role with the
// rep's server-verified identity standing in for RLS. Keep the two in step.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_SLUG_ATTEMPTS = 3;

export type NewPackageInput = {
  prospectName: string;
  prospectCompany?: string | null;
  prospectEmail?: string | null;
  letterBody?: string | null;
  templateId?: string | null;
  slots?: SlotSelection;
};

function tooLong(value: string | null, label: string, max: number): string | null {
  return value && value.length > max ? `${label} must be ${max} characters or fewer.` : null;
}

export async function createPackageForRep(
  rep: { id: string; orgId: string },
  input: NewPackageInput,
): Promise<{ ok: true; slug: string; url: string } | { ok: false; error: string }> {
  const prospectName = input.prospectName?.trim();
  if (!prospectName) return { ok: false, error: "Prospect name is required." };
  const prospectCompany = input.prospectCompany?.trim() || null;
  const prospectEmail = input.prospectEmail?.trim() || null;
  const letterBody = input.letterBody?.trim() || null;

  const lengthError =
    tooLong(prospectName, "Prospect name", 200) ??
    tooLong(prospectCompany, "Company", 200) ??
    tooLong(prospectEmail, "Email", 320) ??
    tooLong(letterBody, "Letter", 20000);
  if (lengthError) return { ok: false, error: lengthError };
  if (prospectEmail && !EMAIL_RE.test(prospectEmail)) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  const billingError = await requireActiveBilling(rep.orgId);
  if (billingError) return { ok: false, error: billingError };

  const slotCheck = await validateSlotAssets({ orgId: rep.orgId, userId: rep.id, slots: input.slots ?? {} });
  if (!slotCheck.ok) return { ok: false, error: slotCheck.error };

  const supabase = createAdminClient();

  // Built-in layout, or one of this org's own custom layouts -- never
  // another org's id. Falls back to the default like resolveTemplateId.
  let templateId = DEFAULT_LAYOUT_ID;
  const requested = input.templateId?.trim();
  if (requested && DESK_LAYOUTS.some((l) => l.id === requested)) {
    templateId = requested;
  } else if (requested) {
    const { data } = await supabase
      .from("layouts")
      .select("id")
      .eq("id", requested)
      .eq("org_id", rep.orgId)
      .maybeSingle();
    if (data) templateId = requested;
  }

  const base = slugify(prospectName) || "package";
  let inserted: { id: string; slug: string } | null = null;
  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS && !inserted; attempt++) {
    const { data, error } = await supabase
      .from("packages")
      .insert({
        org_id: rep.orgId,
        created_by: rep.id,
        slug: `${base}-${randomSuffix()}`,
        prospect_name: prospectName,
        prospect_company: prospectCompany,
        prospect_email: prospectEmail,
        letter_body: letterBody,
        template_id: templateId,
      })
      .select("id, slug")
      .single();
    if (data) inserted = data;
    else if (error?.code !== "23505") {
      console.error("createPackageForRep insert failed:", error);
      break;
    }
  }
  if (!inserted) return { ok: false, error: "Couldn't create the package. Try again." };

  if (slotCheck.rows.length > 0) {
    const { error } = await supabase
      .from("package_assets")
      .insert(slotCheck.rows.map((row) => ({ package_id: inserted!.id, ...row })));
    if (error) {
      console.error("createPackageForRep slot-save failed:", error);
      // Don't leave a half-built package behind for the rep to send.
      await supabase.from("packages").delete().eq("id", inserted.id);
      return { ok: false, error: "Couldn't create the package. Try again." };
    }
  }

  await syncPackageToHubSpot({
    orgId: rep.orgId,
    prospectEmail,
    prospectName,
    prospectCompany,
    packageSlug: inserted.slug,
  });

  return { ok: true, slug: inserted.slug, url: `${getSiteUrl()}/s/${inserted.slug}` };
}
