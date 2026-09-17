import { createClient } from "@/lib/supabase/server";

/**
 * Reuses the first_view_notified_at/video_played_notified_at columns T36
 * already added to packages -- no new migration needed, "opened"/"video
 * played" are just "is that column non-null" against data already being
 * written by the hot-lead notification path.
 */

export type RepStats = {
  totalPackages: number;
  openedCount: number;
  videoPlayedCount: number;
  recent: {
    slug: string;
    prospectName: string;
    createdAt: string;
    opened: boolean;
    videoPlayed: boolean;
  }[];
};

export async function getRepStats(repId: string): Promise<RepStats> {
  const supabase = await createClient();
  const { data: packages } = await supabase
    .from("packages")
    .select("slug, prospect_name, created_at, first_view_notified_at, video_played_notified_at")
    .eq("created_by", repId)
    .order("created_at", { ascending: false });

  const rows = packages ?? [];
  return {
    totalPackages: rows.length,
    openedCount: rows.filter((r) => r.first_view_notified_at).length,
    videoPlayedCount: rows.filter((r) => r.video_played_notified_at).length,
    recent: rows.slice(0, 10).map((r) => ({
      slug: r.slug,
      prospectName: r.prospect_name,
      createdAt: r.created_at,
      opened: !!r.first_view_notified_at,
      videoPlayed: !!r.video_played_notified_at,
    })),
  };
}

export type RepLeaderboardRow = {
  repId: string;
  name: string;
  totalPackages: number;
  openedCount: number;
};

export type OrgStats = {
  totalPackages: number;
  openedCount: number;
  videoPlayedCount: number;
  leaderboard: RepLeaderboardRow[];
};

/**
 * Org-wide rollup -- relies on packages_select_org already letting any
 * org member (not just the creating rep) read every package in their own
 * org (see migration 0014), so this needs no RLS changes to work for an
 * admin querying across the whole team.
 */
export async function getOrgStats(orgId: string): Promise<OrgStats> {
  const supabase = await createClient();
  const { data: packages } = await supabase
    .from("packages")
    .select("created_by, first_view_notified_at, video_played_notified_at")
    .eq("org_id", orgId);

  const rows = packages ?? [];
  const byRep = new Map<string, { total: number; opened: number }>();
  for (const row of rows) {
    const entry = byRep.get(row.created_by) ?? { total: 0, opened: 0 };
    entry.total += 1;
    if (row.first_view_notified_at) entry.opened += 1;
    byRep.set(row.created_by, entry);
  }

  const repIds = [...byRep.keys()];
  const { data: profiles } = repIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", repIds)
    : { data: [] as { id: string; full_name: string | null; email: string | null }[] };
  const nameById = new Map(
    (profiles ?? []).map((p) => [p.id, p.full_name || p.email || "Unknown"]),
  );

  const leaderboard: RepLeaderboardRow[] = repIds
    .map((repId) => ({
      repId,
      name: nameById.get(repId) ?? "Unknown",
      totalPackages: byRep.get(repId)!.total,
      openedCount: byRep.get(repId)!.opened,
    }))
    .sort((a, b) => b.totalPackages - a.totalPackages);

  return {
    totalPackages: rows.length,
    openedCount: rows.filter((r) => r.first_view_notified_at).length,
    videoPlayedCount: rows.filter((r) => r.video_played_notified_at).length,
    leaderboard,
  };
}
