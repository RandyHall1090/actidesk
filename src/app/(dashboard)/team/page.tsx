import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import { TeamClient, type TeamProfile } from "./TeamClient";

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
    .select("id, email, role, full_name, is_active, created_at")
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
      <p className="mt-1 mb-6 text-sm text-neutral-600">
        Manage who&apos;s on your team, their role, and their access.
      </p>
      <TeamClient
        profiles={(profiles ?? []) as TeamProfile[]}
        signupUrl={signupUrl}
      />
    </div>
  );
}
