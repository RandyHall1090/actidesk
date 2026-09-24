import { addinAuthError, getAddinRep } from "@/lib/integrations/outlook/addinAuth";
import { listOutlookContacts, OutlookNotConnectedError } from "@/lib/integrations/outlook/graph";

/** The signed-in rep's own Outlook contacts, for List Merge. */
export async function GET(request: Request) {
  const auth = await getAddinRep(request);
  if (!auth.ok) return addinAuthError(auth.reason);
  try {
    return Response.json({ contacts: await listOutlookContacts(auth.rep.id) });
  } catch (error) {
    if (error instanceof OutlookNotConnectedError) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    console.error("Add-in contacts load failed:", error);
    return Response.json({ error: "Couldn't load your Outlook contacts." }, { status: 502 });
  }
}
