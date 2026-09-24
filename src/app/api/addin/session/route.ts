import { addinAuthError, getAddinRep } from "@/lib/integrations/outlook/addinAuth";
import { getOutlookConnection } from "@/lib/integrations/outlook/graph";

/** Who the add-in is signed in as -- the taskpane's first call. */
export async function GET(request: Request) {
  const auth = await getAddinRep(request);
  if (!auth.ok) return addinAuthError(auth.reason);

  const connection = await getOutlookConnection(auth.rep.id);
  return Response.json({
    rep: { name: auth.rep.fullName ?? auth.rep.email, email: auth.rep.email },
    sendingAs: connection?.mailboxEmail ?? null,
  });
}
