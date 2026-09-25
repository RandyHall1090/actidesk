import { addinAuthError, getAddinRep } from "@/lib/integrations/outlook/addinAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgLayouts } from "@/lib/packages/getOrgLayouts";
import { PACKAGE_SLOTS } from "@/lib/packages/slots";
import { getDefaultPresetId } from "@/lib/packages/defaultPreset";

/**
 * Everything the taskpane's builder can pick from. Service role, so each
 * query restates the rule RLS would apply to this rep: assets and presets
 * are their org's company-shared ones plus their own (assets_select_org /
 * presets_select_org), layouts are their org's plus the built-ins.
 */
export async function GET(request: Request) {
  const auth = await getAddinRep(request);
  if (!auth.ok) return addinAuthError(auth.reason);
  const { rep } = auth;

  const admin = createAdminClient();
  const [layouts, defaultPresetId, { data: assets }, { data: presets }] = await Promise.all([
    getOrgLayouts(rep.orgId),
    getDefaultPresetId(rep.id),
    admin
      .from("assets")
      .select("id, name, kind")
      .eq("org_id", rep.orgId)
      .or(`scope.eq.company,owner_id.eq.${rep.id}`)
      .order("name"),
    admin
      .from("presets")
      .select("id, name, letter_body, preset_assets(slot_name, asset_id)")
      .eq("org_id", rep.orgId)
      .or(`scope.eq.company,created_by.eq.${rep.id}`)
      .order("name"),
  ]);

  return Response.json({
    // Only if still one this rep can see; a deleted/privatized one = none.
    defaultPresetId: (presets ?? []).some((p) => p.id === defaultPresetId) ? defaultPresetId : null,
    layouts: layouts.map((l) => ({ id: l.id, label: l.label })),
    slots: PACKAGE_SLOTS.map((s) => ({ slot: s.slot, label: s.label, kind: s.kind })),
    assets: assets ?? [],
    presets: (presets ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      letterBody: p.letter_body,
      slots: Object.fromEntries(
        (p.preset_assets as { slot_name: string; asset_id: string | null }[])
          .filter((pa) => pa.asset_id)
          .map((pa) => [pa.slot_name, pa.asset_id]),
      ),
    })),
  });
}
