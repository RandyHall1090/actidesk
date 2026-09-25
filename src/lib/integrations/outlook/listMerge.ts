import { listOutlookContacts, sendViaOutlook } from "@/lib/integrations/outlook/graph";
import { applyMergeFields } from "@/lib/integrations/mergeFields";
import { requireActiveBilling } from "@/lib/billing";
import { createPackageForRep } from "@/lib/packages/createPackageForRep";
import { getDefaultPresetForRep } from "@/lib/packages/defaultPreset";
import { getOrgLayouts } from "@/lib/packages/getOrgLayouts";
import { pickDefaultLayoutId } from "@/lib/packages/layouts";

export const NO_DEFAULT_TEMPLATE_ERROR =
  "Set a ★ default template first (New Package → pick a template → Make this my default). List Merge builds every package from it.";

// Shared by the web List Merge page (server actions) and the Outlook
// add-in's API, so both run the exact same rules. Every call is scoped to
// one rep's own Outlook connection -- their contacts, their mailbox.

type Rep = { id: string; orgId: string };

export type MergeItem = { slug: string; url: string; contactName: string; contactEmail: string };

export async function generateListMergePackages(
  rep: Rep,
  contactIds: string[],
): Promise<{ ok: true; items: MergeItem[] } | { ok: false; error: string }> {
  // Same soft block as the dashboard's create form.
  const billingError = await requireActiveBilling(rep.orgId);
  if (billingError) return { ok: false, error: billingError };

  // Without a template every contact would get a bare desk with nothing on it.
  const preset = await getDefaultPresetForRep(rep);
  if (!preset) return { ok: false, error: NO_DEFAULT_TEMPLATE_ERROR };

  const templateId = pickDefaultLayoutId(await getOrgLayouts(rep.orgId));
  const contacts = await listOutlookContacts(rep.id);
  const selected = contacts.filter((c) => contactIds.includes(c.id));

  const items: MergeItem[] = [];
  for (const contact of selected) {
    const result = await createPackageForRep(rep, {
      prospectName: contact.name,
      prospectEmail: contact.email,
      letterBody: preset.letterBody ? applyMergeFields(preset.letterBody, contact) : null,
      templateId,
      slots: preset.slots,
    });
    if (!result.ok) {
      const done = items.length ? ` (${items.length} created before it)` : "";
      return { ok: false, error: `${contact.name}: ${result.error}${done}` };
    }
    items.push({ slug: result.slug, url: result.url, contactName: contact.name, contactEmail: contact.email });
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
