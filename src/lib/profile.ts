import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  org_id: string;
  role: "rep" | "admin";
  full_name: string | null;
};

/** The signed-in user's profile row, or null if not signed in. */
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, org_id, role, full_name")
    .eq("id", user.id)
    .single();

  return profile;
}
