"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function deletePackage(packageId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };

  const supabase = await createClient();
  // RLS (packages_delete_own_or_admin) silently deletes 0 rows rather than
  // erroring when the caller isn't the creator or an admin in that org --
  // the count check is what turns that into a real, visible error instead
  // of the row just quietly staying put with no feedback. Same reasoning
  // as deletePreset in templates/actions.ts.
  const { error, count } = await supabase
    .from("packages")
    .delete({ count: "exact" })
    .eq("id", packageId);
  if (error) {
    console.error("deletePackage failed:", error);
    return { ok: false, error: "Couldn't delete the package." };
  }
  if (!count) {
    return {
      ok: false,
      error: "You don't have permission to delete this package.",
    };
  }

  revalidatePath("/packages");
  return { ok: true };
}

/**
 * Bound with .bind(null, packageId) as a <form action>, which requires the
 * exact shape () => Promise<void> -- matches deletePresetFormAction's
 * reason for existing in templates/actions.ts. Used on the "My Sites" list,
 * where staying on the same (revalidated) page after deleting is correct.
 */
export async function deletePackageFormAction(packageId: string): Promise<void> {
  await deletePackage(packageId);
}

/**
 * Same as deletePackageFormAction, but for the package detail page: that
 * page's own data stops existing once the delete succeeds, so it redirects
 * to the list instead of re-rendering a now-gone package. On failure it
 * silently no-ops (matches deletePresetFormAction's own accepted
 * limitation -- a bound void-returning form action can't surface an error
 * message without additional client-side state, which isn't in scope here).
 */
export async function deletePackageAndRedirectFormAction(
  packageId: string,
): Promise<void> {
  const result = await deletePackage(packageId);
  if (result.ok) {
    redirect("/packages");
  }
}
