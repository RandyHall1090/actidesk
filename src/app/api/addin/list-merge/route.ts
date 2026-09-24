import { addinAuthError, getAddinRep } from "@/lib/integrations/outlook/addinAuth";
import {
  generateListMergePackages,
  sendListMergeEmails,
  type MergeItem,
} from "@/lib/integrations/outlook/listMerge";

const MAX_CONTACTS = 200;

/**
 * { step: "generate", contactIds } builds one package per contact;
 * { step: "send", letterTemplate, items } emails them from the rep's own
 * mailbox. Two steps so the taskpane can show the links for review first --
 * same flow and same shared code as the web List Merge page.
 */
export async function POST(request: Request) {
  const auth = await getAddinRep(request);
  if (!auth.ok) return addinAuthError(auth.reason);
  const rep = { id: auth.rep.id, orgId: auth.rep.orgId };

  let body: { step?: unknown; contactIds?: unknown; letterTemplate?: unknown; items?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  if (body.step === "generate") {
    const contactIds = Array.isArray(body.contactIds)
      ? body.contactIds.filter((id): id is string => typeof id === "string").slice(0, MAX_CONTACTS)
      : [];
    if (contactIds.length === 0) return Response.json({ error: "Pick at least one contact." }, { status: 400 });
    const result = await generateListMergePackages(rep, contactIds, "desk-v1");
    if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
    return Response.json({ items: result.items });
  }

  if (body.step === "send") {
    const letterTemplate = typeof body.letterTemplate === "string" ? body.letterTemplate.slice(0, 20000) : "";
    const items = Array.isArray(body.items)
      ? (body.items as MergeItem[])
          .filter(
            (i) =>
              i &&
              typeof i.url === "string" &&
              typeof i.slug === "string" &&
              typeof i.contactName === "string" &&
              typeof i.contactEmail === "string",
          )
          .slice(0, MAX_CONTACTS)
      : [];
    if (items.length === 0) return Response.json({ error: "Nothing to send." }, { status: 400 });
    return Response.json(await sendListMergeEmails(rep, letterTemplate, items));
  }

  return Response.json({ error: "Unknown step." }, { status: 400 });
}
