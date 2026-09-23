import type { SupabaseClient } from "@supabase/supabase-js";

export type PostStatus = "draft" | "pending_review" | "published" | "rejected";

export type BlogAuthor = {
  id: string;
  name: string;
  title: string;
  email: string;
  focus_area: string;
};

export type BlogPostSummary = {
  slug: string;
  title: string;
  excerpt: string;
  cover_image_url: string | null;
  published_at: string | null;
  authors: { name: string; title: string } | null;
};

/** Only Mon-Fri counts as a valid publish slot, matching Forge University's
 * editorial-calendar model (2026 blog automation realignment brief). */
export function isPublishableWeekday(date: Date): boolean {
  const day = date.getUTCDay();
  return day !== 0 && day !== 6;
}

/** occupiedDateKeys are "YYYY-MM-DD" (UTC) calendar-day keys already taken
 * by this same author -- different authors sharing a publish day is
 * accepted; the invariant this protects is narrower: the SAME author
 * shouldn't land two posts on the same calendar day. */
export function nextOpenPublishDate(occupiedDateKeys: Set<string>, from: Date): Date {
  const candidate = new Date(from);
  for (let i = 0; i < 366; i++) {
    if (isPublishableWeekday(candidate)) {
      const key = candidate.toISOString().slice(0, 10);
      if (!occupiedDateKeys.has(key)) return candidate;
    }
    candidate.setUTCDate(candidate.getUTCDate() + 1);
  }
  throw new Error("No open publish slot found within a year");
}

export async function getOccupiedPublishDates(
  supabase: SupabaseClient,
  authorId: string
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("blog_posts")
    .select("published_at")
    .eq("status", "published")
    .eq("author_id", authorId)
    .not("published_at", "is", null);

  if (error) {
    throw new Error(`Failed to read the editorial calendar: ${error.message}`);
  }

  return new Set(
    (data ?? [])
      .map((row) => row.published_at as string | null)
      .filter((value): value is string => value !== null)
      .map((value) => value.slice(0, 10))
  );
}

/** Shared by createPost, updatePost, and approve: an explicit admin-chosen
 * override date (skips collision-avoidance, may be in the past), or, absent
 * that, the next open weekday this author hasn't already used. */
export async function resolvePublishedAt(
  supabase: SupabaseClient,
  authorId: string,
  overrideDate: string | null
): Promise<string> {
  if (overrideDate) return new Date(overrideDate).toISOString();
  const occupied = await getOccupiedPublishDates(supabase, authorId);
  return nextOpenPublishDate(occupied, new Date()).toISOString();
}

/** A "published" row can carry a future published_at (its assigned
 * editorial-calendar slot) -- shows "scheduled: <date>" instead of a
 * misleading "published" for admin lists. */
export function displayStatus(status: string, publishedAt: string | null): string {
  if (status === "published" && publishedAt && new Date(publishedAt) > new Date()) {
    return "scheduled";
  }
  return status;
}
