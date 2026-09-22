"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import { PACKAGE_SLOTS } from "@/lib/packages/slots";
import { DESK_LAYOUTS, DEFAULT_LAYOUT_ID } from "@/lib/packages/layouts";
import { randomSuffix, slugify } from "@/lib/packages/slug";
import { syncPackageToHubSpot } from "@/lib/hubspot";
import { requireActiveBilling } from "@/lib/billing";

export type ActionResult = { ok: true } | { ok: false; error: string };

const MAX_SLUG_ATTEMPTS = 3;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Free-text fields were previously unbounded, limited only by whatever the
// platform/Postgres allowed, not by this code (2026-09-16 security audit).
function validateLength(
  value: string | null,
  label: string,
  maxLength: number,
): string | null {
  if (value && value.length > maxLength) {
    return `${label} must be ${maxLength} characters or fewer.`;
  }
  return null;
}

/**
 * A template_id is either a built-in DESK_LAYOUTS id (checked first, no DB
 * call) or a custom layout this org saved itself (T15) -- looked up scoped
 * to org_id so a rep can't submit another org's layout id and have it
 * silently accepted. Falls back to the default rather than reject the
 * whole submission outright for a stale/tampered value.
 */
export async function resolveTemplateId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  rawTemplateId: string | undefined,
): Promise<string> {
  if (!rawTemplateId) return DEFAULT_LAYOUT_ID;
  if (DESK_LAYOUTS.some((l) => l.id === rawTemplateId)) return rawTemplateId;

  const { data } = await supabase
    .from("layouts")
    .select("id")
    .eq("id", rawTemplateId)
    .eq("org_id", orgId)
    .maybeSingle();
  return data ? rawTemplateId : DEFAULT_LAYOUT_ID;
}

/**
 * One action for both create and edit, branching on a hidden `package_id`
 * field (empty = create) -- the same shape as saveLayout()/savePreset()
 * (T15/T17). Editing never touches the slug: it's the already-sent link,
 * and changing it would break every copy of that link already out in the
 * world. It also never re-syncs HubSpot -- that only happens once, on
 * creation, so fixing a typo later doesn't spam a duplicate contact
 * upsert/timeline note on every save.
 */
export async function savePackage(
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
  const rawTemplateId = (formData.get("template_id") as string | null)?.trim();
  const packageId = (formData.get("package_id") as string | null)?.trim() || "";

  const lengthError =
    validateLength(prospectName, "Prospect name", 200) ??
    validateLength(prospectCompany, "Company", 200) ??
    validateLength(prospectEmail, "Email", 320) ??
    validateLength(letterBody, "Letter", 20000) ??
    validateLength(privateNote, "Private note", 20000);
  if (lengthError) return { ok: false, error: lengthError };
  if (prospectEmail && !EMAIL_RE.test(prospectEmail)) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  const supabase = await createClient();
  const templateId = await resolveTemplateId(supabase, profile.org_id, rawTemplateId);

  if (packageId) {
    // packages_update_own_or_admin (0035) already scopes this to the
    // creator or an org admin -- the explicit .eq below is defense in
    // depth for a non-admin, not the only thing standing between a rep
    // and someone else's package. Skipped for an admin specifically
    // because it would otherwise block the exact edit RLS now allows
    // (someone else's package, still within the admin's own org).
    let updateQuery = supabase
      .from("packages")
      .update({
        prospect_name: prospectName,
        prospect_company: prospectCompany,
        prospect_email: prospectEmail,
        letter_body: letterBody,
        private_note: privateNote,
        template_id: templateId,
      })
      .eq("id", packageId);
    if (profile.role !== "admin") {
      updateQuery = updateQuery.eq("created_by", profile.id);
    }
    const { data: updated, error } = await updateQuery
      .select("id, slug")
      .single();

    if (error || !updated) {
      if (error) console.error("savePackage update failed:", error);
      return { ok: false, error: "Couldn't save changes." };
    }

    // Replace the full slot set (delete then insert) rather than diff
    // individual slots -- same reasoning as saveLayout()'s jsonb replace
    // and savePreset()'s preset_assets replace: simplest correct way to
    // handle add/change/remove uniformly.
    const { error: deleteError } = await supabase
      .from("package_assets")
      .delete()
      .eq("package_id", updated.id);
    if (deleteError) {
      console.error("savePackage slot-reset failed:", deleteError);
      return { ok: false, error: "Couldn't save changes." };
    }

    const editSlotRows = PACKAGE_SLOTS.map((s) => ({
      slot: s.slot,
      assetId: formData.get(`slot_${s.slot}`) as string | null,
    }))
      .filter((s) => s.assetId)
      .map((s) => ({
        package_id: updated.id,
        slot_name: s.slot,
        asset_id: s.assetId,
      }));

    if (editSlotRows.length > 0) {
      const { error: slotsError } = await supabase
        .from("package_assets")
        .insert(editSlotRows);
      if (slotsError) {
        console.error("savePackage slot-save failed:", slotsError);
        return { ok: false, error: "Couldn't save changes." };
      }
    }

    redirect(`/packages/${updated.slug}`);
  }

  // Only the create path is gated -- editing a package a rep already made
  // is "existing content", not new creation (see requireActiveBilling).
  const billingError = await requireActiveBilling(profile.org_id);
  if (billingError) return { ok: false, error: billingError };

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
        template_id: templateId,
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
    if (lastError) console.error("savePackage create failed:", lastError);
    return {
      ok: false,
      error: "Couldn't create the package. Try again.",
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
      console.error("savePackage slot-save failed:", slotsError);
      return { ok: false, error: "Couldn't create the package. Try again." };
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
