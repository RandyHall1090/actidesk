import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";

type ViewStats = { count: number; last: string };

export default async function PackagesPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const { data: packages, error } = await supabase
    .from("packages")
    .select("id, slug, prospect_name, prospect_company, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400">
        Couldn&apos;t load packages: {error.message}
      </p>
    );
  }

  const packageIds = (packages ?? []).map((p) => p.id);
  const { data: events } = packageIds.length
    ? await supabase
        .from("tracking_events")
        .select("package_id, event_type, occurred_at")
        .in("package_id", packageIds)
        .eq("event_type", "page_view")
    : { data: [] as { package_id: string; event_type: string; occurred_at: string }[] };

  const viewsByPackage = new Map<string, ViewStats>();
  for (const e of events ?? []) {
    const cur = viewsByPackage.get(e.package_id);
    if (!cur) {
      viewsByPackage.set(e.package_id, { count: 1, last: e.occurred_at });
    } else {
      cur.count += 1;
      if (e.occurred_at > cur.last) cur.last = e.occurred_at;
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">My Sites</h2>
        <Link
          href="/packages/new"
          className="rounded-md bg-neutral-900 dark:bg-neutral-100 px-4 py-2 text-sm font-medium text-white dark:text-neutral-900"
        >
          New Package
        </Link>
      </div>
      {(packages ?? []).length === 0 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">No packages sent yet.</p>
      ) : (
        <ul className="divide-y divide-neutral-200 dark:divide-neutral-700 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900">
          {(packages ?? []).map((p) => {
            const stats = viewsByPackage.get(p.id);
            return (
              <li
                key={p.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div>
                  <Link
                    href={`/packages/${p.slug}`}
                    className="font-medium text-neutral-900 dark:text-neutral-100 hover:underline"
                  >
                    {p.prospect_name}
                  </Link>
                  {p.prospect_company && (
                    <span className="ml-2 text-sm text-neutral-500 dark:text-neutral-400">
                      {p.prospect_company}
                    </span>
                  )}
                </div>
                <div className="text-sm text-neutral-500 dark:text-neutral-400">
                  {stats
                    ? `Opened ${stats.count}× — last ${new Date(stats.last).toLocaleDateString()}`
                    : "Not opened yet"}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
