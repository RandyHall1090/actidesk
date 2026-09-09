import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/profile";
import { getOrg } from "@/lib/org";
import { signOut } from "./actions";

const NAV_LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/library", label: "Asset Library" },
  { href: "/packages", label: "My Sites" },
  { href: "/account", label: "Account" },
  { href: "/help", label: "Help" },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();

  // Belt-and-suspenders: middleware already redirects unauthenticated
  // visitors, this guards direct navigation during dev/edge cases.
  if (!profile) {
    redirect("/login");
  }

  const navLinks = profile.role === "admin"
    ? [...NAV_LINKS, { href: "/team", label: "Team" }]
    : NAV_LINKS;
  const org = await getOrg(profile.org_id);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-neutral-900">
              {org?.name ?? "Shock-and-Awe Portal"}
            </h1>
            <p className="text-xs text-neutral-400">Shock-and-Awe Portal</p>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-sm text-neutral-500">{profile.email}</p>
            <form action={signOut}>
              <button
                type="submit"
                className="text-sm font-medium text-neutral-500 hover:text-neutral-900"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
        <nav className="mt-3 flex gap-4">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
