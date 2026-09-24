"use server";

import { getCurrentProfile } from "@/lib/profile";
import { sendListMergeEmails, type MergeItem } from "@/lib/integrations/outlook/listMerge";

/** Sends from the signed-in rep's own mailbox. */
export async function sendListMerge(input: {
  letterTemplate: string;
  items: MergeItem[];
}): Promise<{ sent: number; failed: string[] }> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.is_active) return { sent: 0, failed: input.items.map((i) => i.contactEmail) };
  return sendListMergeEmails({ id: profile.id, orgId: profile.org_id }, input.letterTemplate, input.items);
}
