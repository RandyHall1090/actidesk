import { timingSafeEqual } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { slugify, randomSuffix } from "@/lib/packages/slug";
import { getSiteUrl } from "@/lib/env";

/**
 * T38: automated follow-through, triggered daily by pg_cron/pg_net (see
 * migration 0027) -- never by a user request, so this is bearer-token
 * authenticated against CRON_SECRET the same way T33's Gate Desk route
 * is authenticated against GATE_DESK_API_KEY.
 *
 * For every org with follow_up_enabled = true, finds original packages
 * that are still unopened after that org's configured follow_up_days,
 * generates one fresh follow-up package per eligible original (same
 * prospect/org/template, a default "just checking in" letter), and
 * emails the *creating rep* (not the prospect -- matches this app's
 * standing "reps send links themselves" design; see spec/plan.md) a
 * ready-to-send link. Never sends anything to the prospect directly.
 */
function isAuthorized(req: Request): boolean {
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: orgs } = await supabase
    .from("orgs")
    .select("id, follow_up_days")
    .eq("follow_up_enabled", true);

  let generated = 0;
  for (const org of orgs ?? []) {
    const cutoff = new Date(Date.now() - org.follow_up_days * 86_400_000).toISOString();

    // Eligible: an original (not itself a follow-up), never opened,
    // older than the org's configured threshold, and not already
    // followed up on.
    const { data: candidates } = await supabase
      .from("packages")
      .select("id, org_id, created_by, prospect_name, prospect_email, prospect_company, template_id")
      .eq("org_id", org.id)
      .is("first_view_notified_at", null)
      .is("follow_up_of", null)
      .lt("created_at", cutoff);

    for (const original of candidates ?? []) {
      const { data: existingFollowUp } = await supabase
        .from("packages")
        .select("id")
        .eq("follow_up_of", original.id)
        .maybeSingle();
      if (existingFollowUp) continue; // already followed up -- never send a second

      const base = slugify(original.prospect_name);
      let slug: string | null = null;
      for (let attempt = 0; attempt < 3 && !slug; attempt++) {
        const candidateSlug = attempt === 0 ? base : `${base}-${randomSuffix()}`;
        const { data: inserted, error } = await supabase
          .from("packages")
          .insert({
            org_id: original.org_id,
            created_by: original.created_by,
            slug: candidateSlug,
            prospect_name: original.prospect_name,
            prospect_email: original.prospect_email,
            prospect_company: original.prospect_company,
            template_id: original.template_id,
            follow_up_of: original.id,
            letter_body:
              "Just following up in case this got buried -- wanted to make sure you saw this before we lose touch.",
          })
          .select("slug")
          .single();
        if (!error && inserted) slug = inserted.slug;
        else if (error && error.code !== "23505") break; // real error, not a slug collision -- stop retrying
      }
      if (!slug) continue;

      const { data: rep } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", original.created_by)
        .single();
      if (rep?.email) {
        const url = `${getSiteUrl()}/s/${slug}`;
        await sendEmail({
          to: rep.email,
          subject: `Follow-up ready for ${original.prospect_name}`,
          html: `<p><strong>${original.prospect_name}</strong> hasn't opened the package you sent them yet. A fresh follow-up package is ready: <a href="${url}">${url}</a></p>`,
        });
      }
      generated++;
    }
  }

  return Response.json({ ok: true, generated });
}
