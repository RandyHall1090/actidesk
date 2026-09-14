"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import { PACKAGE_SLOTS } from "@/lib/packages/slots";
import { DESK_LAYOUTS, DEFAULT_LAYOUT_ID } from "@/lib/packages/layouts";
import { randomSuffix, slugify } from "@/lib/packages/slug";
import { syncPackageToHubSpot } from "@/lib/hubspot";

export type ActionResult = { ok: true } | { ok: false; error: string };

const MAX_SLUG_ATTEMPTS = 3;

/**
 * A template_id is either a built-in DESK_LAYOUTS id (checked first, no DB
 * call) or a custom layout this org saved itself (T15) -- looked up scoped
 * to org_id so a rep can't submit another org's layout id and have it
 * silently accepted. Falls back to the default rather than reject the
 * whole submission outright for a stale/tampered value.
 */
async function resolveTemplateId(
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
  const supabase = await createClient();
  const templateId = await resolveTemplateId(supabase, profile.org_id, rawTemplateId);

  if (packageId) {
    // packages_update_own (0001) already scopes this to created_by =
    // auth.uid() -- the explicit .eq here is defense in depth, not the
    // only thing standing between a rep and someone else's package.
    const { data: updated, error } = await supabase
      .from("packages")
      .update({
        prospect_name: prospectName,
        prospect_company: prospectCompany,
        prospect_email: prospectEmail,
        letter_body: letterBody,
        private_note: privateNote,
        template_id: templateId,
      })
      .eq("id", packageId)
      .eq("created_by", profile.id)
      .select("id, slug")
      .single();

    if (error || !updated) {
      return { ok: false, error: error?.message ?? "Couldn't save changes." };
    }

    // Replace the full slot set (delete then insert) rather than diff
    // individual slots -- same reasoning as saveLayout()'s jsonb replace
    // and savePreset()'s preset_assets replace: simplest correct way to
    // handle add/change/remove uniformly.
    const { error: deleteError } = await supabase
      .from("package_assets")
      .delete()
      .eq("package_id", updated.id);
    if (deleteError) return { ok: false, error: deleteError.message };

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
      if (slotsError) return { ok: false, error: slotsError.message };
    }

    redirect(`/packages/${updated.slug}`);
  }

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
