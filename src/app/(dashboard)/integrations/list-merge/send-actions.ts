"use server";

import { getCurrentProfile } from "@/lib/profile";
import { sendViaOutlook } from "@/lib/integrations/outlook/graph";
import { applyMergeFields } from "@/lib/integrations/mergeFields";

export async function sendListMerge(input: {
  letterTemplate: string;
  items: { slug: string; url: string; contactName: string; contactEmail: string }[];
}): Promise<void> {
  const profile = await getCurrentProfile();
  if (!profile) return;

  for (const item of input.items) {
    const body = applyMergeFields(input.letterTemplate, {
      name: item.contactName,
      email: item.contactEmail,
    });
    const html = `<p>${body.replaceAll("\n", "<br/>")}</p><p><a href="${item.url}">${item.url}</a></p>`;
    await sendViaOutlook(profile.org_id, {
      to: item.contactEmail,
      subject: "A quick personal note",
      html,
    });
  }
}
