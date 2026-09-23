import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { PostForm } from "../post-form";
import { createPost } from "../actions";

export default async function NewPostPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!profile.is_platform_admin) {
    return (
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Only Securafy platform admins can access this page.
      </p>
    );
  }

  const supabase = createAdminClient();
  const { data: authors } = await supabase.from("blog_authors").select("id, name, title").order("name");

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">New post</h2>
      <div className="mt-6">
        <PostForm authors={authors ?? []} action={createPost} />
      </div>
    </div>
  );
}
