import { listOutlookContacts, sendViaOutlook } from "@/lib/integrations/outlook/graph";
import { createPackageForContact } from "@/lib/integrations/createPackageForContact";
import { applyMergeFields } from "@/lib/integrations/mergeFields";
import { requireActiveBilling } from "@/lib/billing";

// Shared by the web List Merge page (server actions) and the Outlook
// add-in's API, so both run the exact same rules. Every call is scoped to
// one rep's own Outlook connection -- their contacts, their mailbox.

type Rep = { id: string; orgId: string };

export type MergeItem = { slug: string; url: string; contactName: string; contactEmail: string };

export async function generateListMergePackages(
  rep: Rep,
  contactIds: string[],
  templateId: string,
): Promise<{ ok: true; items: MergeItem[] } | { ok: false; error: string }> {
  // Same soft block as the dashboard's create form.
  const billingError = await requireActiveBilling(rep.orgId);
  if (billingError) return { ok: false, error: billingError };

  const contacts = await listOutlookContacts(rep.id);
  const selected = contacts.filter((c) => contactIds.includes(c.id));

  const items: MergeItem[] = [];
  for (const contact of selected) {
    const { slug, url } = await createPackageForContact({
      orgId: rep.orgId,
      createdBy: rep.id,
      prospectName: contact.name,
      prospectEmail: contact.email,
      templateId,
    });
    items.push({ slug, url, contactName: contact.name, contactEmail: contact.email });
  }
  return { ok: true, items };
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Keeps going past a failed recipient so one bad address doesn't stop the
 * rest of the list. */
export async function sendListMergeEmails(
  rep: Rep,
  letterTemplate: string,
  items: MergeItem[],
): Promise<{ sent: number; failed: string[] }> {
  let sent = 0;
  const failed: string[] = [];
  for (const item of items) {
    const body = applyMergeFields(letterTemplate, { name: item.contactName, email: item.contactEmail });
    const link = escapeHtml(item.url);
    const html = `<p>${escapeHtml(body).replaceAll("\n", "<br/>")}</p><p><a href="${link}">${link}</a></p>`;
    try {
      await sendViaOutlook(rep.id, { to: item.contactEmail, subject: "A quick personal note", html });
      sent++;
    } catch (error) {
      console.error(`List Merge send to ${item.contactEmail} failed:`, error);
      failed.push(item.contactEmail);
    }
  }
  return { sent, failed };
}
