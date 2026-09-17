"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import { listOutlookContacts } from "@/lib/integrations/outlook/graph";
import { createPackageForContact } from "@/lib/integrations/createPackageForContact";

export async function createOutlookPackage(
  contactId: string,
  templateId: string,
): Promise<{ url: string } | { error: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };

  const contacts = await listOutlookContacts(profile.org_id);
  const contact = contacts.find((c) => c.id === contactId);
  if (!contact) return { error: "Contact not found." };

  const result = await createPackageForContact({
    orgId: profile.org_id,
    createdBy: profile.id,
    prospectName: contact.name,
    prospectEmail: contact.email,
    templateId,
  });
  return { url: result.url };
}

export async function requestIntegration(
  providerName: string,
  note: string,
): Promise<{ ok: boolean; error?: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };

  const supabase = await createClient();
  const { error } = await supabase.from("integration_requests").insert({
    org_id: profile.org_id,
    requested_by: profile.id,
    provider_name: providerName.slice(0, 200),
    note: note.slice(0, 1000) || null,
  });

  if (error) {
    console.error("integration request insert failed:", error);
    return { ok: false, error: "Could not send the request." };
  }
  return { ok: true };
}
