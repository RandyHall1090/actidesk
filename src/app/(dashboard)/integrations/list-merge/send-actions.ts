"use server";

import { getCurrentProfile } from "@/lib/profile";
import { sendViaOutlook } from "@/lib/integrations/outlook/graph";
import { applyMergeFields } from "@/lib/integrations/mergeFields";

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Sends from the signed-in rep's own mailbox. Keeps going past a failed
 * recipient so one bad address doesn't stop the rest of the list. */
export async function sendListMerge(input: {
  letterTemplate: string;
  items: { slug: string; url: string; contactName: string; contactEmail: string }[];
}): Promise<{ sent: number; failed: string[] }> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.is_active) return { sent: 0, failed: input.items.map((i) => i.contactEmail) };

  let sent = 0;
  const failed: string[] = [];
  for (const item of input.items) {
    const body = applyMergeFields(input.letterTemplate, {
      name: item.contactName,
      email: item.contactEmail,
    });
    const link = escapeHtml(item.url);
    const html = `<p>${escapeHtml(body).replaceAll("\n", "<br/>")}</p><p><a href="${link}">${link}</a></p>`;
    try {
      await sendViaOutlook(profile.id, { to: item.contactEmail, subject: "A quick personal note", html });
      sent++;
    } catch (error) {
      console.error(`List Merge send to ${item.contactEmail} failed:`, error);
      failed.push(item.contactEmail);
    }
  }
  return { sent, failed };
}
