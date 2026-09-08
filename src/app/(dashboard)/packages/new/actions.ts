"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import { PACKAGE_SLOTS } from "@/lib/packages/slots";
import { randomSuffix, slugify } from "@/lib/packages/slug";
import { syncPackageToHubSpot } from "@/lib/hubspot";

export type ActionResult = { ok: true } | { ok: false; error: string };

const MAX_SLUG_ATTEMPTS = 3;

export async function createPackage(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };

  const prospectName = (
    formData.get("prospect_name") as string | null
  )?.trim();
  if (!prospectName) {
    return { ok: false, error: "Prospect name is required." };
  }
  const prospectCompany =
    (formData.get("prospect_company") as string | null)?.trim() || null;
  const prospectEmail =
    (formData.get("prospect_email") as string | null)?.trim() || null;
  const letterBody =
    (formData.get("letter_body") as string | null)?.trim() || null;
  const privateNote =
    (formData.get("private_note") as string | null)?.trim() || null;

  const supabase = await createClient();
  const base = slugify(prospectName) || "package";

  let inserted: { id: string; slug: string } | null = null;
  let lastError: string | null = null;

  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
    const slug = `${base}-${randomSuffix()}`;
    const { data, error } = await supabase
      .from("packages")
      .insert({
        org_id: profile.org_id,
        created_by: profile.id,
        slug,
        prospect_name: prospectName,
        prospect_company: prospectCompany,
        prospect_email: prospectEmail,
        letter_body: letterBody,
        private_note: privateNote,
      })
      .select("id, slug")
      .single();

    if (!error && data) {
      inserted = data;
      break;
    }
    lastError = error?.message ?? "Unknown error";
    if (error?.code !== "23505") break; // not a unique-slug collision — stop retrying
  }

  if (!inserted) {
    return {
      ok: false,
      error: lastError ?? "Couldn't create the package. Try again.",
    };
  }

  const slotRows = PACKAGE_SLOTS.map((s) => ({
    slot: s.slot,
    assetId: formData.get(`slot_${s.slot}`) as string | null,
  }))
    .filter((s) => s.assetId)
    .map((s) => ({
      package_id: inserted!.id,
      slot_name: s.slot,
      asset_id: s.assetId,
    }));

  if (slotRows.length > 0) {
    const { error: slotsError } = await supabase
      .from("package_assets")
      .insert(slotRows);
    if (slotsError) {
      return { ok: false, error: slotsError.message };
    }
  }

  // syncPackageToHubSpot() never throws (it catches its own errors), so
  // awaiting it here just makes sure it actually runs to completion before
  // this serverless function returns — it can't fail the package creation.
  await syncPackageToHubSpot({
    orgId: profile.org_id,
    prospectEmail,
    prospectName,
    prospectCompany,
    packageSlug: inserted.slug,
  });

  redirect(`/packages/${inserted.slug}`);
}
