import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";

/**
 * T36 "strike while hot": notifies the creating rep the moment their
 * prospect first opens the package, and separately the first time the
 * primary video plays -- each fires at most once per package per signal.
 *
 * Public route, no session: the prospect's own browser calls this right
 * after logTrackingEvent() succeeds (src/lib/tracking.ts), same trust
 * level as record_tracking_event itself. Uses the admin client since
 * there's no RLS relationship between an anonymous prospect and the
 * rep's profile row this needs to read.
 *
 * Fire-and-forget from the caller's side -- every path below returns 200
 * even on a no-op, so a slow/failed notification never surfaces as an
 * error to the prospect's page.
 */
export async function POST(req: Request) {
  let body: { slug?: string; eventType?: string; slotName?: string | null };
  try {
    body = await req.json();
  } catch {
    return new Response("ok", { status: 200 });
  }

  const { slug, eventType, slotName } = body;
  if (!slug || !eventType) return new Response("ok", { status: 200 });

  const isFirstView = eventType === "page_view";
  const isVideoPlay = eventType === "asset_played" && slotName === "video";
  if (!isFirstView && !isVideoPlay) return new Response("ok", { status: 200 });

  const supabase = createAdminClient();
  const column = isFirstView ? "first_view_notified_at" : "video_played_notified_at";

  // Atomic claim: only the request that actually flips this column from
  // NULL to a timestamp wins the right to send -- a concurrent duplicate
  // (two tabs, a retry) matches zero rows and does nothing further.
  const { data: claimed } = await supabase
    .from("packages")
    .update({ [column]: new Date().toISOString() })
    .eq("slug", slug)
    .is(column, null)
    .select("prospect_name, created_by")
    .maybeSingle();

  if (!claimed) return new Response("ok", { status: 200 });

  const { data: rep } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", claimed.created_by)
    .single();
  if (!rep?.email) return new Response("ok", { status: 200 });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const label = isFirstView ? "opened their package" : "played your video";
  await sendEmail({
    to: rep.email,
    subject: `${claimed.prospect_name} just ${label}`,
    html: `<p><strong>${claimed.prospect_name}</strong> just ${label} in the ActiDesk package you sent them.</p><p><a href="${siteUrl}/packages/${slug}">View activity</a></p>`,
  });

  return new Response("ok", { status: 200 });
}
