"use client";

import { createClient } from "@/lib/supabase/client";

export type TrackingEventType = "page_view" | "asset_opened" | "asset_played";

/**
 * Fire-and-forget tracking beacon for the public package page. Failures
 * (network hiccup, ad blocker, etc.) must never break the prospect's
 * viewing experience, so they're logged to the console rather than thrown —
 * this is a non-critical side channel, not the page's actual content.
 */
export async function logTrackingEvent(
  packageId: string,
  eventType: TrackingEventType,
  slotName?: string,
) {
  try {
    const supabase = createClient();
    const { error } = await supabase.from("tracking_events").insert({
      package_id: packageId,
      event_type: eventType,
      slot_name: slotName ?? null,
    });
    if (error) console.warn("tracking event failed:", error.message);
  } catch (err) {
    console.warn("tracking event failed:", err);
  }
}
