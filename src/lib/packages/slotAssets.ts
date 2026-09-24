import { createAdminClient } from "@/lib/supabase/admin";
import { PACKAGE_SLOTS } from "./slots";

export type SlotSelection = Record<string, string>;

/**
 * Checks that every asset a package is about to attach is one this rep may
 * actually use: same org, and either company-shared or their own -- the
 * exact rule assets_select_org applies to the rep's own library view. The
 * package_assets write policy only checks who owns the *package*, and the
 * public page resolves assets through a SECURITY DEFINER function, so
 * without this a hand-edited form could attach another org's asset (or a
 * teammate's private one) and publish it on the rep's prospect page.
 *
 * Also rejects unknown slots. Deliberately doesn't enforce asset kind per
 * slot: some already-sent packages hold a legacy image-kind asset in a
 * magazine slot (see slots.ts), and editing those must keep working.
 * Explicit predicate on the service role rather than relying on the
 * caller's RLS session, so the dashboard and the Outlook add-in (which has
 * no Supabase session) enforce the identical rule.
 */
export async function validateSlotAssets(input: {
  orgId: string;
  userId: string;
  slots: SlotSelection;
}): Promise<{ ok: true; rows: { slot_name: string; asset_id: string }[] } | { ok: false; error: string }> {
  const requested = Object.entries(input.slots).filter(([, assetId]) => assetId);
  if (requested.length === 0) return { ok: true, rows: [] };

  const knownSlots = new Set(PACKAGE_SLOTS.map((s) => s.slot));
  for (const [slot] of requested) {
    if (!knownSlots.has(slot)) return { ok: false, error: `Unknown slot "${slot}".` };
  }

  const assetIds = [...new Set(requested.map(([, assetId]) => assetId))];
  if (!assetIds.every((id) => /^[0-9a-f-]{36}$/i.test(id))) {
    return { ok: false, error: "One of the selected assets isn't available to you." };
  }

  const { data: assets, error } = await createAdminClient()
    .from("assets")
    .select("id, scope, owner_id")
    .in("id", assetIds)
    .eq("org_id", input.orgId);
  if (error) return { ok: false, error: "Couldn't check the selected assets." };

  const usable = new Set(
    (assets ?? [])
      .filter((a) => a.scope === "company" || a.owner_id === input.userId)
      .map((a) => a.id as string),
  );

  const rows: { slot_name: string; asset_id: string }[] = [];
  for (const [slot, assetId] of requested) {
    if (!usable.has(assetId)) {
      return { ok: false, error: "One of the selected assets isn't available to you." };
    }
    rows.push({ slot_name: slot, asset_id: assetId });
  }
  return { ok: true, rows };
}
