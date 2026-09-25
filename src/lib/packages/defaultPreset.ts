import { createAdminClient } from "@/lib/supabase/admin";

type Rep = { id: string; orgId: string };

/** Only a preset this rep may actually use -- their org's company-shared
 * ones plus their own, the same rule presets_select_org applies. */
async function isUsablePreset(rep: Rep, presetId: string): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(presetId)) return false;
  const { data } = await createAdminClient()
    .from("presets")
    .select("id, scope, created_by")
    .eq("id", presetId)
    .eq("org_id", rep.orgId)
    .maybeSingle();
  return !!data && (data.scope === "company" || data.created_by === rep.id);
}

/** Sets (or, with null, clears) the rep's default preset. Shared by the web
 * New Package form and the Outlook add-in. */
export async function setDefaultPresetForRep(
  rep: Rep,
  presetId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (presetId && !(await isUsablePreset(rep, presetId))) {
    return { ok: false, error: "That template isn't available to you." };
  }
  const { error } = await createAdminClient()
    .from("profiles")
    .update({ default_preset_id: presetId })
    .eq("id", rep.id);
  return error ? { ok: false, error: "Couldn't save your default." } : { ok: true };
}

/** The rep's default preset id, or null. */
export async function getDefaultPresetId(repId: string): Promise<string | null> {
  const { data } = await createAdminClient()
    .from("profiles")
    .select("default_preset_id")
    .eq("id", repId)
    .maybeSingle();
  return (data?.default_preset_id as string | null) ?? null;
}
