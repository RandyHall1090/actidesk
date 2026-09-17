import { getCurrentProfile } from "@/lib/profile";
import { createPackageForContact } from "@/lib/integrations/createPackageForContact";

export async function POST(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return Response.json({ error: "Not signed in to ActiDesk." }, { status: 401 });

  const { name, email } = await req.json();
  if (!name) return Response.json({ error: "Missing contact name." }, { status: 400 });

  const result = await createPackageForContact({
    orgId: profile.org_id,
    createdBy: profile.id,
    prospectName: name,
    prospectEmail: email,
    templateId: "desk-v1",
  });
  return Response.json({ url: result.url });
}
