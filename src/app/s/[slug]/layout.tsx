// Scoped to /s/[slug] only, not the dashboard -- same structural pattern as
// (dashboard)/layout.tsx's own background wrapper, just black instead of
// bg-neutral-50. Randy asked for the whitespace around the desk photo to be
// black, matching Securafy's own branding (and the real TMT reference this
// page is modeled on, which uses the same solid black backdrop).
export default function PublicPackageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="flex min-h-full flex-1 flex-col bg-black">{children}</div>;
}
