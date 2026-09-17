import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import { getRepStats, getOrgStats } from "@/lib/dashboard/stats";
import { FollowUpSettings } from "./FollowUpSettings";

export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const repStats = await getRepStats(profile.id);
  const orgStats = profile.role === "admin" ? await getOrgStats(profile.org_id) : null;

  let followUp: { follow_up_enabled: boolean; follow_up_days: number } | null = null;
  if (profile.role === "admin") {
    const supabase = await createClient();
    const { data } = await supabase
      .from("orgs")
      .select("follow_up_enabled, follow_up_days")
      .eq("id", profile.org_id)
      .single();
    followUp = data;
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Dashboard</h2>
      <p className="mt-2 mb-6 text-neutral-600 dark:text-neutral-400">
        Build a personalized package for a prospect, or manage the shared
        asset library.
      </p>
      <div className="mb-8 flex gap-3">
        <Link
          href="/packages/new"
          className="rounded-md bg-neutral-900 dark:bg-neutral-100 px-4 py-2 text-sm font-medium text-white dark:text-neutral-900"
        >
          New Package
        </Link>
        <Link
          href="/library"
          className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300"
        >
          Asset Library
        </Link>
        <Link
          href="/packages"
          className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300"
        >
          My Sites
        </Link>
      </div>

      <section className="mb-8">
        <h3 className="mb-3 text-sm font-semibold text-neutral-500 dark:text-neutral-400">
          Your activity
        </h3>
        <div className="grid max-w-lg grid-cols-3 gap-3">
          <StatCard label="Sent" value={repStats.totalPackages} />
          <StatCard label="Opened" value={repStats.openedCount} />
          <StatCard label="Video played" value={repStats.videoPlayedCount} />
        </div>
        {repStats.recent.length > 0 && (
          <ul className="mt-4 space-y-1">
            {repStats.recent.map((r) => (
              <li key={r.slug} className="text-sm text-neutral-700 dark:text-neutral-300">
                <Link href={`/packages/${r.slug}`} className="underline">
                  {r.prospectName}
                </Link>{" "}
                — {r.opened ? "Opened" : "Not opened yet"}
                {r.videoPlayed ? ", video played" : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      {followUp && (
        <FollowUpSettings
          initialEnabled={followUp.follow_up_enabled}
          initialDays={followUp.follow_up_days}
        />
      )}

      {orgStats && (
        <section>
          <h3 className="mb-3 text-sm font-semibold text-neutral-500 dark:text-neutral-400">
            Team activity (org-wide)
          </h3>
          <div className="mb-4 grid max-w-lg grid-cols-3 gap-3">
            <StatCard label="Sent" value={orgStats.totalPackages} />
            <StatCard label="Opened" value={orgStats.openedCount} />
            <StatCard label="Video played" value={orgStats.videoPlayedCount} />
          </div>
          {orgStats.leaderboard.length > 0 && (
            <table className="w-full max-w-lg text-sm">
              <thead>
                <tr className="text-left text-neutral-500 dark:text-neutral-400">
                  <th className="pb-2 font-medium">Rep</th>
                  <th className="pb-2 font-medium">Sent</th>
                  <th className="pb-2 font-medium">Opened</th>
                </tr>
              </thead>
              <tbody>
                {orgStats.leaderboard.map((row) => (
                  <tr
                    key={row.repId}
                    className="border-t border-neutral-200 dark:border-neutral-700"
                  >
                    <td className="py-1.5 text-neutral-800 dark:text-neutral-200">{row.name}</td>
                    <td className="py-1.5 text-neutral-800 dark:text-neutral-200">
                      {row.totalPackages}
                    </td>
                    <td className="py-1.5 text-neutral-800 dark:text-neutral-200">
                      {row.openedCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-3">
      <p className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">{value}</p>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">{label}</p>
    </div>
  );
}
