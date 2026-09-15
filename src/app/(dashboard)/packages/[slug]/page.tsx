import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import { CopyLinkButton } from "./CopyLinkButton";

export default async function PackageDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const { slug } = await params;
  const supabase = await createClient();

  const { data: pkg, error } = await supabase
    .from("packages")
    .select(
      "id, slug, prospect_name, prospect_company, prospect_email, private_note, created_at, created_by",
    )
    .eq("slug", slug)
    .single();

  if (error || !pkg) notFound();

  const { data: events } = await supabase
    .from("tracking_events")
    .select("event_type, slot_name, occurred_at")
    .eq("package_id", pkg.id)
    .order("occurred_at", { ascending: false });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const publicUrl = `${siteUrl}/s/${pkg.slug}`;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
            {pkg.prospect_name}
          </h2>
          {pkg.prospect_company && (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">{pkg.prospect_company}</p>
          )}
        </div>
        {pkg.created_by === profile.id && (
          <Link
            href={`/packages/${pkg.slug}/edit`}
            className="shrink-0 rounded-md border border-neutral-300 dark:border-neutral-600 px-3 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:border-neutral-400 dark:border-neutral-500"
          >
            Edit
          </Link>
        )}
      </div>

      <div className="flex items-center gap-2 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-3">
        <code className="flex-1 truncate text-sm text-neutral-700 dark:text-neutral-300">
          {publicUrl}
        </code>
        <CopyLinkButton url={publicUrl} />
      </div>

      {pkg.private_note && (
        <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 p-3 text-sm text-amber-900 dark:text-amber-200">
          <strong>Private note:</strong> {pkg.private_note}
        </div>
      )}

      <div>
        <h3 className="mb-2 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
          Activity
        </h3>
        {(events ?? []).length === 0 ? (
          <p className="text-sm text-neutral-400 dark:text-neutral-500">Not opened yet.</p>
        ) : (
          <ul className="space-y-1 text-sm text-neutral-600 dark:text-neutral-400">
            {(events ?? []).map((e, i) => (
              <li key={i}>
                {new Date(e.occurred_at).toLocaleString()} — {e.event_type}
                {e.slot_name ? ` (${e.slot_name})` : ""}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
