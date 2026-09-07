import Link from "next/link";

export default function DashboardPage() {
  return (
    <div>
      <h2 className="text-xl font-semibold text-neutral-900">Dashboard</h2>
      <p className="mt-2 mb-6 text-neutral-600">
        Build a personalized package for a prospect, or manage the shared
        asset library.
      </p>
      <div className="flex gap-3">
        <Link
          href="/packages/new"
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
        >
          New Package
        </Link>
        <Link
          href="/library"
          className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700"
        >
          Asset Library
        </Link>
        <Link
          href="/packages"
          className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700"
        >
          My Sites
        </Link>
      </div>
    </div>
  );
}
