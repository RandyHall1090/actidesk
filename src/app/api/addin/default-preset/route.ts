import { addinAuthError, getAddinRep } from "@/lib/integrations/outlook/addinAuth";
import { setDefaultPresetForRep } from "@/lib/packages/defaultPreset";

/** POST { presetId: string | null } -- set or clear the rep's default template. */
export async function POST(request: Request) {
  const auth = await getAddinRep(request);
  if (!auth.ok) return addinAuthError(auth.reason);

  let body: { presetId?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const presetId = typeof body.presetId === "string" ? body.presetId : null;

  const result = await setDefaultPresetForRep({ id: auth.rep.id, orgId: auth.rep.orgId }, presetId);
  if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
  return Response.json({ defaultPresetId: presetId });
}
