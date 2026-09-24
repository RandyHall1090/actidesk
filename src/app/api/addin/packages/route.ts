import { addinAuthError, getAddinRep } from "@/lib/integrations/outlook/addinAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPackageForRep } from "@/lib/packages/createPackageForRep";
import { getSiteUrl } from "@/lib/env";

/**
 * GET ?email= -- packages this org has sent to one prospect, with whether
 * each was opened or had its video played (the taskpane's engagement
 * panel). Org-wide, matching packages_select_org: any rep in the org can
 * already see these in My Sites' admin view and the dashboard stats.
 */
export async function GET(request: Request) {
  const auth = await getAddinRep(request);
  if (!auth.ok) return addinAuthError(auth.reason);

  const email = new URL(request.url).searchParams.get("email")?.trim().toLowerCase();
  if (!email || email.length > 320) return Response.json({ packages: [] });

  const admin = createAdminClient();
  const { data } = await admin
    .from("packages")
    .select("slug, prospect_name, created_at, first_view_notified_at, video_played_notified_at, created_by")
    .eq("org_id", auth.rep.orgId)
    .ilike("prospect_email", email.replace(/[%_\\]/g, "\\$&"))
    .order("created_at", { ascending: false })
    .limit(10);

  const creatorIds = [...new Set((data ?? []).map((p) => p.created_by as string))];
  const { data: creators } = creatorIds.length
    ? await admin.from("profiles").select("id, full_name, email").in("id", creatorIds)
    : { data: [] };
  const creatorName = new Map((creators ?? []).map((c) => [c.id, c.full_name ?? c.email]));

  return Response.json({
    packages: (data ?? []).map((p) => ({
      slug: p.slug,
      url: `${getSiteUrl()}/s/${p.slug}`,
      prospectName: p.prospect_name,
      createdAt: p.created_at,
      opened: p.first_view_notified_at !== null,
      videoPlayed: p.video_played_notified_at !== null,
      sentBy: p.created_by === auth.rep.id ? "You" : (creatorName.get(p.created_by) ?? "A teammate"),
    })),
  });
}

/** POST -- build a package from the taskpane. */
export async function POST(request: Request) {
  const auth = await getAddinRep(request);
  if (!auth.ok) return addinAuthError(auth.reason);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const input = body as {
    prospectName?: unknown;
    prospectCompany?: unknown;
    prospectEmail?: unknown;
    letterBody?: unknown;
    templateId?: unknown;
    slots?: unknown;
  };
  const text = (value: unknown) => (typeof value === "string" ? value : null);
  const slots =
    input.slots && typeof input.slots === "object" && !Array.isArray(input.slots)
      ? Object.fromEntries(
          Object.entries(input.slots as Record<string, unknown>).filter(
            (entry): entry is [string, string] => typeof entry[1] === "string",
          ),
        )
      : {};

  const result = await createPackageForRep(
    { id: auth.rep.id, orgId: auth.rep.orgId },
    {
      prospectName: text(input.prospectName) ?? "",
      prospectCompany: text(input.prospectCompany),
      prospectEmail: text(input.prospectEmail),
      letterBody: text(input.letterBody),
      templateId: text(input.templateId),
      slots,
    },
  );
  if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
  return Response.json({ slug: result.slug, url: result.url });
}
