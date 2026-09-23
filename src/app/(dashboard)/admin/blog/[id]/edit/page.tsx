import { redirect, notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { PostForm } from "../../post-form";
import { updatePost, deletePost } from "../../actions";

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!profile.is_platform_admin) {
    return (
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Only Securafy platform admins can access this page.
      </p>
    );
  }

  const { id } = await params;
  const supabase = createAdminClient();
  const [{ data: post }, { data: authors }] = await Promise.all([
    supabase
      .from("blog_posts")
      .select(
        "id, slug, title, seo_title, excerpt, meta_description, image_alt_text, content, cover_image_url, author_id, status"
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("blog_authors").select("id, name, title").order("name"),
  ]);

  if (!post) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Edit post</h2>
        <form action={deletePost}>
          <input type="hidden" name="id" value={post.id} />
          <button
            type="submit"
            className="text-xs font-medium text-neutral-400 hover:text-red-600 dark:text-neutral-500 dark:hover:text-red-400"
          >
            Delete
          </button>
        </form>
      </div>
      <div className="mt-6">
        <PostForm authors={authors ?? []} post={post} action={updatePost} />
      </div>
    </div>
  );
}
