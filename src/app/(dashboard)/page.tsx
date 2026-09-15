import Link from "next/link";

export default function DashboardPage() {
  return (
    <div>
      <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Dashboard</h2>
      <p className="mt-2 mb-6 text-neutral-600 dark:text-neutral-400">
        Build a personalized package for a prospect, or manage the shared
        asset library.
      </p>
      <div className="flex gap-3">
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
    </div>
  );
}
