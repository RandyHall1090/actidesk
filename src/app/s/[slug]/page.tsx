// Public, unauthenticated renderer for a single prospect's package.
// Reachable at /s/[slug] — no login required, this is what the prospect opens.
//
// TODO (M3): fetch the package + package_assets by slug, render the
// desk-flat-lay template with the chosen video/audio/documents, and log a
// `page_view` tracking event on load.

export default async function PackagePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-neutral-100 px-4">
      <p className="text-neutral-500">
        Package <code className="font-mono">{slug}</code> — template renderer
        not built yet.
      </p>
    </div>
  );
}
