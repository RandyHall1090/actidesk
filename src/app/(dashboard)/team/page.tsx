import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import { setProfileRole } from "./actions";

export default async function TeamPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") {
    return (
      <p className="text-sm text-neutral-600">
        Only admins can manage the team.
      </p>
    );
  }

  const supabase = await createClient();
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, email, role, full_name, created_at")
    .order("created_at");

  if (error) {
    return (
      <p className="text-sm text-red-600">
        Couldn&apos;t load the team: {error.message}
      </p>
    );
  }

  const signupUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/signup`;

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-semibold text-neutral-900">Team</h2>
      <p className="mt-1 mb-2 text-sm text-neutral-600">
        Share this link so a teammate can create their own account — matching
        email domains automatically join this organization:
      </p>
      <code className="mb-6 block rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700">
        {signupUrl}
      </code>
      <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
        {(profiles ?? []).map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between px-4 py-3"
          >
            <div>
              <p className="text-sm font-medium text-neutral-900">
                {p.email}
              </p>
              {p.full_name && (
                <p className="text-xs text-neutral-500">{p.full_name}</p>
              )}
            </div>
            <form
              action={setProfileRole.bind(
                null,
                p.id,
                p.role === "admin" ? "rep" : "admin",
              )}
            >
              <button
                type="submit"
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:border-neutral-400"
              >
                {p.role === "admin" ? "Admin — make rep" : "Rep — make admin"}
              </button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
