"use server";

import { syncOrgSeatCount } from "@/lib/stripe/seatSync";

/**
 * The signup page calls complete_signup() directly as an RPC from the
 * client (no server action involved), so a self-service "join" -- the
 * one seat-count change that doesn't go through team/actions.ts -- has
 * no natural server-side hook of its own. This is that hook.
 */
export async function syncSeatCountAfterJoin(orgId: string): Promise<void> {
  await syncOrgSeatCount(orgId);
}
