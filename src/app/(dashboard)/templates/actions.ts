"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import { PACKAGE_SLOTS } from "@/lib/packages/slots";

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Presets are entirely admin-authored, org-wide bundles (no owner/scope
 * concept like assets have) -- the role check here is a friendly-error
 * guard, matching the pattern in library/actions.ts. RLS (presets_insert_admin
 * / presets_update_admin / presets_delete_admin, via is_org_admin()) is the
 * real enforcement.
 *
 * One form, one action, for both create and edit -- a hidden `preset_id`
 * field (empty when creating/cloning into a new one) tells this which case
 * it is, the same shape as the Layout Designer's saveLayout() action.
 * Editing replaces the full set of preset_assets rows (delete then insert)
 * rather than diffing individual slots -- simplest correct way to handle
 * add/change/remove uniformly at this scale.
 */
export async function savePreset(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (profile.role !== "admin") {
    return { ok: false, error: "Only admins can manage templates." };
  }

  const name = (formData.get("name") as string | null)?.trim();
  if (!name) return { ok: false, error: "Name is required." };
  const letterBody =
    (formData.get("letter_body") as string | null)?.trim() || null;
  const presetId = (formData.get("preset_id") as string | null)?.trim() || null;

  const supabase = await createClient();
  let targetPresetId: string;

  if (presetId) {
    const { data, error } = await supabase
      .from("presets")
      .update({ name, letter_body: letterBody })
      .eq("id", presetId)
      .eq("org_id", profile.org_id)
      .select("id")
      .single();
    if (error || !data) {
      return {
        ok: false,
        error: error?.message ?? "Couldn't update the template.",
      };
    }
    targetPresetId = data.id;

    const { error: deleteError } = await supabase
      .from("preset_assets")
      .delete()
      .eq("preset_id", targetPresetId);
    if (deleteError) return { ok: false, error: deleteError.message };
  } else {
    const { data, error } = await supabase
      .from("presets")
      .insert({
        org_id: profile.org_id,
        created_by: profile.id,
        name,
        letter_body: letterBody,
      })
      .select("id")
      .single();
    if (error || !data) {
      return {
        ok: false,
        error: error?.message ?? "Couldn't create the template.",
      };
    }
    targetPresetId = data.id;
  }

  const slotRows = PACKAGE_SLOTS.map((s) => ({
    slot: s.slot,
    assetId: formData.get(`slot_${s.slot}`) as string | null,
  }))
    .filter((s) => s.assetId)
    .map((s) => ({
      preset_id: targetPresetId,
      slot_name: s.slot,
      asset_id: s.assetId,
    }));

  if (slotRows.length > 0) {
    const { error: slotsError } = await supabase
      .from("preset_assets")
      .insert(slotRows);
    if (slotsError) return { ok: false, error: slotsError.message };
  }

  revalidatePath("/templates");
  return { ok: true };
}

/**
 * Bound with .bind(null, presetId) as a <form action>, which requires the
 * exact shape () => Promise<void> -- matches deleteAssetFormAction's reason
 * for existing in library/actions.ts.
 */
export async function deletePresetFormAction(presetId: string): Promise<void> {
  await deletePreset(presetId);
}

export async function deletePreset(presetId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (profile.role !== "admin") {
    return { ok: false, error: "Only admins can delete templates." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("presets").delete().eq("id", presetId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/templates");
  return { ok: true };
}
