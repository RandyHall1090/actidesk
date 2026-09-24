"use server";

import { getCurrentProfile } from "@/lib/profile";
import { listOutlookContacts } from "@/lib/integrations/outlook/graph";
import { createPackageForContact } from "@/lib/integrations/createPackageForContact";

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
}): Promise<{ slug: string; url: string; contactName: string; contactEmail: string }[]> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.is_active) return [];

  const contacts = await listOutlookContacts(profile.id);
  const selected = contacts.filter((c) => input.contactIds.includes(c.id));

  const results = [];
  for (const contact of selected) {
    const { slug, url } = await createPackageForContact({
      orgId: profile.org_id,
      createdBy: profile.id,
      prospectName: contact.name,
      prospectEmail: contact.email,
      templateId: input.templateId,
    });
    results.push({ slug, url, contactName: contact.name, contactEmail: contact.email });
  }
  return results;
}
