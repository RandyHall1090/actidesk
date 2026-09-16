"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import { PACKAGE_SLOTS } from "@/lib/packages/slots";

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Presets are personal/company-scope, owned bundles -- the same shape as
 * assets (0001), extended onto presets in migration 0019. Any signed-in org
 * member can create one and choose to share it (scope: "company"); only the
 * owner or an org admin can update/delete it. This is a deliberate
 * departure from how assets themselves work (there, only an admin can mark
 * something company-scope) -- Randy explicitly asked for any rep to be able
 * to share their own template. RLS (presets_insert_own /
 * presets_update_own_or_admin / presets_delete_own_or_admin) is the real
 * enforcement; the ownership/permission errors below are just a clearer
 * message than RLS's own "0 rows affected."
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

  const name = (formData.get("name") as string | null)?.trim();
  if (!name) return { ok: false, error: "Name is required." };
  if (name.length > 200) {
    return { ok: false, error: "Name must be 200 characters or fewer." };
  }
  const letterBody =
    (formData.get("letter_body") as string | null)?.trim() || null;
  if (letterBody && letterBody.length > 20000) {
    return { ok: false, error: "Letter must be 20000 characters or fewer." };
  }
  const presetId = (formData.get("preset_id") as string | null)?.trim() || null;
  const scope = formData.get("scope") === "company" ? "company" : "personal";

  const supabase = await createClient();
  let targetPresetId: string;

  if (presetId) {
    const { data, error } = await supabase
      .from("presets")
      .update({ name, letter_body: letterBody, scope })
      .eq("id", presetId)
      .eq("org_id", profile.org_id)
      .select("id")
      .single();
    if (error || !data) {
      if (error) console.error("savePreset update failed:", error);
      return {
        ok: false,
        error:
          "Couldn't save changes — you may not have permission to edit this template.",
      };
    }
    targetPresetId = data.id;

    const { error: deleteError } = await supabase
      .from("preset_assets")
      .delete()
      .eq("preset_id", targetPresetId);
    if (deleteError) {
      console.error("savePreset slot-reset failed:", deleteError);
      return { ok: false, error: "Couldn't save changes." };
    }
  } else {
    const { data, error } = await supabase
      .from("presets")
      .insert({
        org_id: profile.org_id,
        created_by: profile.id,
        name,
        letter_body: letterBody,
        scope,
      })
      .select("id")
      .single();
    if (error || !data) {
      if (error) console.error("savePreset create failed:", error);
      return {
        ok: false,
        error: "Couldn't create the template.",
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
    if (slotsError) {
      console.error("savePreset slot-save failed:", slotsError);
      return { ok: false, error: "Couldn't save the template." };
    }
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

  const supabase = await createClient();
  // RLS (presets_delete_own_or_admin) silently deletes 0 rows rather than
  // erroring when the caller isn't the owner or an admin -- the count check
  // is what turns that into an actual, visible error instead of the row
  // just quietly staying put with no feedback.
  const { error, count } = await supabase
    .from("presets")
    .delete({ count: "exact" })
    .eq("id", presetId);
  if (error) {
    console.error("deletePreset failed:", error);
    return { ok: false, error: "Couldn't delete the template." };
  }
  if (!count) {
    return {
      ok: false,
      error: "You don't have permission to delete this template.",
    };
  }

  revalidatePath("/templates");
  return { ok: true };
}
