"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import type { DeskLayout, SlotPosition } from "@/lib/packages/layouts";
import { requireActiveBilling } from "@/lib/billing";

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
 * Lightweight runtime shape check for a SlotPosition before it's stored in
 * a JSONB column -- this isn't a security boundary (JSONB storage is
 * parameterized, so there's no injection risk, and these values are only
 * ever consumed as React inline `style` properties, never raw HTML), just
 * data-integrity defense-in-depth so a malformed shape fails at save time
 * instead of silently breaking the desk-scene renderer later.
 */
function isValidSlotPosition(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.left !== "string" || typeof v.top !== "string" || typeof v.width !== "string") {
    return false;
  }
  if (v.rotate !== undefined && typeof v.rotate !== "number") return false;
  if (v.aspect !== undefined && typeof v.aspect !== "string") return false;
  return true;
}

function validateLayoutShape(input: SaveLayoutInput): string | null {
  if (!isValidSlotPosition(input.nameplate)) {
    return "The nameplate position is malformed.";
  }
  if (!input.slots || typeof input.slots !== "object") {
    return "Slot positions are malformed.";
  }
  for (const slot of Object.values(input.slots)) {
    if (slot !== undefined && !isValidSlotPosition(slot)) {
      return "One or more slot positions are malformed.";
    }
  }
  if (input.letter !== undefined && !isValidSlotPosition(input.letter)) {
    return "The letter position is malformed.";
  }
  if (input.brochures !== undefined) {
    if (!Array.isArray(input.brochures) || input.brochures.some((b) => !isValidSlotPosition(b))) {
      return "One or more brochure positions are malformed.";
    }
  }
  return null;
}

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
  const shapeError = validateLayoutShape(input);
  if (shapeError) return { ok: false, error: shapeError };

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
      if (error) console.error("saveLayout update failed:", error);
      return { ok: false, error: "Couldn't update the layout." };
    }
    revalidatePath("/templates/layout-designer");
    revalidatePath("/templates");
    revalidatePath("/packages/new");
    return { ok: true, id: data.id };
  }

  // Only the create branch is gated -- refining an org's existing custom
  // layout is "existing content", not new creation (see requireActiveBilling).
  const billingError = await requireActiveBilling(profile.org_id);
  if (billingError) return { ok: false, error: billingError };

  const { data, error } = await supabase
    .from("layouts")
    .insert({ ...sharedFields, org_id: profile.org_id, created_by: profile.id })
    .select("id")
    .single();
  if (error || !data) {
    if (error) console.error("saveLayout insert failed:", error);
    return { ok: false, error: "Couldn't save the layout." };
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
  // count check: without it, a stale/nonexistent/cross-org id would still
  // report { ok: true } even though nothing was actually deleted.
  const { error, count } = await supabase
    .from("layouts")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("org_id", profile.org_id);
  if (error) {
    console.error("deleteLayout failed:", error);
    return { ok: false, error: "Couldn't delete the layout." };
  }
  if (!count) {
    return { ok: false, error: "Couldn't delete the layout — it may not exist." };
  }

  revalidatePath("/templates/layout-designer");
  revalidatePath("/templates");
  revalidatePath("/packages/new");
  return { ok: true, id };
}
