import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { SECURAFY_ORG_ID } from "@/lib/hubspot";
import { slugify, randomSuffix } from "@/lib/packages/slug";
import { resolveTemplateId } from "@/app/(dashboard)/packages/new/actions";
import { getSiteUrl } from "@/lib/env";

// Real profiles/auth.users row created directly this session (not by this
// code) -- can never log in (encrypted_password is NULL), exists only as
// the created_by foreign key API-created packages point at. Not secret,
// same reasoning as the SECURAFY_ORG_ID code constant it sits next to in
// spirit -- see spec/plan.md T33.
const GATE_DESK_SERVICE_PROFILE_ID = "f97e0b1c-5b3d-4ee5-94a4-51314ceadc21";

const MAX_SLUG_ATTEMPTS = 3;

// Gate Desk's request body is untrusted JSON -- a field can be any JSON type
// despite the `as string` casts callers write against. Throws on anything
// but undefined/null/string so the caller can turn that into a clean 400
// instead of letting `.trim()` throw a TypeError that becomes an unhandled 500.
// Also caps length -- unbounded free text was previously only limited by
// whatever the platform/Postgres allowed, not by this code.
function optionalString(
  value: unknown,
  fieldName: string,
  maxLength = 500,
): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string`);
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLength) {
    throw new Error(`${fieldName} must be ${maxLength} characters or fewer`);
  }
  return trimmed;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidBearerToken(header: string | null): boolean {
  const expected = process.env.GATE_DESK_API_KEY;
  if (!expected || !header) return false;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return false;
  const provided = Buffer.from(match[1]);
  const expectedBuf = Buffer.from(expected);
  if (provided.length !== expectedBuf.length) return false;
  return timingSafeEqual(provided, expectedBuf);
}

/**
 * Server-to-server package creation for Actiforge's Gate Desk campaign
 * backend. Bearer-token authenticated (not a Supabase session -- the
 * caller is a backend, not a logged-in rep), so every DB write here goes
 * through the service-role client, same as T12's admin mutations. Never
 * calls syncPackageToHubSpot -- API-created packages must not generate a
 * HubSpot contact, only dashboard-created ones do. See spec/plan.md T33.
 */
export async function POST(req: Request) {
  if (!isValidBearerToken(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);

  let prospectName: string | null;
  let prospectCompany: string | null;
  let prospectEmail: string | null;
  let rawTemplateId: string | null;
  try {
    prospectName = optionalString(body?.prospect_name, "prospect_name", 200);
    prospectCompany = optionalString(
      body?.prospect_company,
      "prospect_company",
      200,
    );
    prospectEmail = optionalString(body?.prospect_email, "prospect_email", 320);
    rawTemplateId = optionalString(body?.template_id, "template_id", 100);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid input" },
      { status: 400 },
    );
  }

  if (!prospectName) {
    return NextResponse.json(
      { error: "prospect_name is required" },
      { status: 400 },
    );
  }
  if (prospectEmail && !EMAIL_RE.test(prospectEmail)) {
    return NextResponse.json(
      { error: "prospect_email must be a valid email address" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const templateId = await resolveTemplateId(
    admin,
    SECURAFY_ORG_ID,
    rawTemplateId ?? undefined,
  );

  const base = slugify(prospectName) || "package";
  let inserted: { slug: string } | null = null;
  let lastError: string | null = null;

  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
    const slug = `${base}-${randomSuffix()}`;
    const { data, error } = await admin
      .from("packages")
      .insert({
        org_id: SECURAFY_ORG_ID,
        created_by: GATE_DESK_SERVICE_PROFILE_ID,
        slug,
        prospect_name: prospectName,
        prospect_company: prospectCompany,
        prospect_email: prospectEmail,
        template_id: templateId,
      })
      .select("slug")
      .single();

    if (!error && data) {
      inserted = data;
      break;
    }
    lastError = error?.message ?? "Unknown error";
    if (error?.code !== "23505") break; // not a unique-slug collision — stop retrying
  }

  if (!inserted) {
    console.error("Gate Desk package creation failed:", lastError);
    return NextResponse.json(
      { error: "Could not create package" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    slug: inserted.slug,
    url: `${getSiteUrl()}/s/${inserted.slug}`,
  });
}
