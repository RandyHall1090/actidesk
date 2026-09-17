"use server";

import { getCurrentProfile } from "@/lib/profile";
import { listOutlookContacts } from "@/lib/integrations/outlook/graph";
import { createPackageForContact } from "@/lib/integrations/createPackageForContact";

export async function fetchOutlookContactsForMerge() {
  const profile = await getCurrentProfile();
  if (!profile) return [];
  return listOutlookContacts(profile.org_id);
}

export async function generateListMerge(input: {
  contactIds: string[];
  templateId: string;
}): Promise<
  { slug: string; url: string; contactName: string; contactEmail: string }[]
> {
  const profile = await getCurrentProfile();
  if (!profile) return [];

  const contacts = await listOutlookContacts(profile.org_id);
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
