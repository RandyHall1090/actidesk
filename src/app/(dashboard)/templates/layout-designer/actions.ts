"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import type { DeskLayout, SlotPosition } from "@/lib/packages/layouts";

export type SaveLayoutInput = {
  // Present => update this org's existing custom layout; absent => create a
  // new one. Never a built-in DESK_LAYOUTS id -- those aren't rows in this
  // table at all, so "refining" one here always creates a new custom copy.
  id?: string;
  label: string;
  backgroundImage: string;
  aspectRatio: string;
  nameplate: SlotPosition;
  slots: DeskLayout["slots"];
  letter?: SlotPosition;
  brochures?: SlotPosition[];
};

export type LayoutActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

/**
 * Self-service save for an org's own custom desk layout (T15) -- the
 * counterpart to this tool's original "copy the code, a developer pastes
 * it into layouts.ts and deploys" path, which stays available (for
 * Securafy shipping a new *built-in* layout to every tenant) but no longer
 * the only option. RLS (layouts_insert_admin/layouts_update_admin, both
 * `is_org_admin(org_id)`) is the real enforcement; the role check here is
 * just a friendly error, matching every other admin-gated action in this
 * app (e.g. templates/actions.ts).
 */
export async function saveLayout(
  input: SaveLayoutInput,
): Promise<LayoutActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (profile.role !== "admin") {
    return { ok: false, error: "Only admins can save layouts." };
  }
  const label = input.label.trim();
  if (!label) return { ok: false, error: "A label is required." };
  if (!input.backgroundImage) {
    return { ok: false, error: "A background image is required." };
  }

  const supabase = await createClient();
  const sharedFields = {
    label,
    background_image: input.backgroundImage,
    aspect_ratio: input.aspectRatio,
    nameplate: input.nameplate,
    slots: input.slots,
    letter: input.letter ?? null,
    brochures: input.brochures ?? null,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { data, error } = await supabase
      .from("layouts")
      .update(sharedFields)
      .eq("id", input.id)
      .eq("org_id", profile.org_id)
      .select("id")
      .single();
    if (error || !data) {
      return { ok: false, error: error?.message ?? "Couldn't update the layout." };
    }
    revalidatePath("/templates/layout-designer");
    revalidatePath("/templates");
    revalidatePath("/packages/new");
    return { ok: true, id: data.id };
  }

  const { data, error } = await supabase
    .from("layouts")
    .insert({ ...sharedFields, org_id: profile.org_id, created_by: profile.id })
    .select("id")
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Couldn't save the layout." };
  }
  revalidatePath("/templates/layout-designer");
  revalidatePath("/templates");
  revalidatePath("/packages/new");
  return { ok: true, id: data.id };
}

export async function deleteLayout(id: string): Promise<LayoutActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (profile.role !== "admin") {
    return { ok: false, error: "Only admins can delete layouts." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("layouts")
    .delete()
    .eq("id", id)
    .eq("org_id", profile.org_id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/templates/layout-designer");
  revalidatePath("/templates");
  revalidatePath("/packages/new");
  return { ok: true, id };
}
