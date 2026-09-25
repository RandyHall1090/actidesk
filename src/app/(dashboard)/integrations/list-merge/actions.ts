"use server";

import { getCurrentProfile } from "@/lib/profile";
import { listOutlookContacts } from "@/lib/integrations/outlook/graph";
import { generateListMergePackages, type MergeItem } from "@/lib/integrations/outlook/listMerge";

// Every call is scoped to the signed-in rep's own Outlook connection --
// never the org's -- so a rep only ever sees and sends from their own mailbox.

export async function fetchOutlookContactsForMerge(): Promise<
  { ok: true; contacts: { id: string; name: string; email: string }[] } | { ok: false; error: string }
> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.is_active) return { ok: false, error: "Not signed in." };
  try {
    return { ok: true, contacts: await listOutlookContacts(profile.id) };
  } catch (error) {
    console.error("Loading Outlook contacts failed:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Couldn't load your Outlook contacts." };
  }
}

export async function generateListMerge(input: {
  contactIds: string[];
  templateId: string;
}): Promise<{ ok: true; items: MergeItem[] } | { ok: false; error: string }> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.is_active) return { ok: false, error: "Not signed in." };
  return generateListMergePackages(
    { id: profile.id, orgId: profile.org_id },
    input.contactIds,
    input.templateId,
  );
}
