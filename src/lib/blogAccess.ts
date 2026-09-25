import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile, type Profile } from "@/lib/profile";

// Who may use the blog admin pages. Platform admins manage everything;
// a blog author who isn't one may still see, edit, approve, or reject
// their OWN posts -- the review email sends each author there, and "each
// author approves only their own posts" is the rule the actions enforce.

export type BlogAccess = {
  profile: Profile;
  isPlatformAdmin: boolean;
  /** This person's blog_authors row, matched by email (case-insensitive). */
  authorId: string | null;
};

export async function getBlogAuthorId(email: string | null | undefined): Promise<string | null> {
  if (!email) return null;
  // Four-ish rows; compared in JS so casing ("Ric.Hall@Securafy.com") and
  // LIKE wildcards in an address can't cause a wrong match.
  const { data } = await createAdminClient().from("blog_authors").select("id, email");
  const target = email.toLowerCase();
  return (data ?? []).find((author) => (author.email as string | null)?.toLowerCase() === target)?.id ?? null;
}

/** Null when signed out, or signed in with no blog role at all. */
export async function getBlogAccess(): Promise<BlogAccess | null> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.is_active) return null;
  const authorId = await getBlogAuthorId(profile.email);
  if (!profile.is_platform_admin && !authorId) return null;
  return { profile, isPlatformAdmin: profile.is_platform_admin, authorId };
}
