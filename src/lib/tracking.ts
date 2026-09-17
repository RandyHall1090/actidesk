"use client";

import { createClient } from "@/lib/supabase/client";

export type TrackingEventType = "page_view" | "asset_opened" | "asset_played";

/**
 * Fire-and-forget tracking beacon for the public package page. Failures
 * (network hiccup, ad blocker, etc.) must never break the prospect's
 * viewing experience, so they're logged to the console rather than thrown —
 * this is a non-critical side channel, not the page's actual content.
 *
 * Routed through the record_tracking_event RPC (not a direct table insert)
 * so a caller can only ever record an event against the ONE package
 * matching the slug they're actually viewing -- a direct insert would
 * accept any existing package_id from any org, since there's no RLS
 * relationship between "the slug in this browser tab" and "the package_id
 * in the request body" for a raw insert. See migration 0025.
 */
export async function logTrackingEvent(
  slug: string,
  eventType: TrackingEventType,
  slotName?: string,
) {
  try {
    const supabase = createClient();
    const { error } = await supabase.rpc("record_tracking_event", {
      p_slug: slug,
      p_event_type: eventType,
      p_slot_name: slotName ?? null,
    });
    if (error) console.warn("tracking event failed:", error.message);
  } catch (err) {
    console.warn("tracking event failed:", err);
  }

  // "Strike while hot" (T36): a best-effort, non-blocking notify-the-rep
  // check. Deliberately not awaited into the caller and never throws --
  // this must never slow down or break the prospect's page.
  fetch("/api/notifications/hot-lead", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug, eventType, slotName: slotName ?? null }),
  }).catch(() => {});
}
