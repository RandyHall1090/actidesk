import { redirect, notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/profile";
import { getBlogAccess } from "@/lib/blogAccess";
import { createAdminClient } from "@/lib/supabase/admin";
import { PostForm } from "../../post-form";
import { updatePost, deletePost, approvePost, rejectPost } from "../../actions";

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await getCurrentProfile())) redirect("/login");
  const access = await getBlogAccess();
  const denied = (
    <p className="text-sm text-neutral-600 dark:text-neutral-400">
      Only Securafy platform admins and this post&apos;s author can access this page.
    </p>
  );
  if (!access) return denied;

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
  if (!access.isPlatformAdmin && post.author_id !== access.authorId) return denied;
  // An author can't reassign their post, so only offer them their own name.
  const authorChoices = access.isPlatformAdmin
    ? (authors ?? [])
    : (authors ?? []).filter((author) => author.id === access.authorId);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Edit post</h2>
        {access.isPlatformAdmin && (
          <form action={deletePost}>
            <input type="hidden" name="id" value={post.id} />
            <button
              type="submit"
              className="text-xs font-medium text-neutral-400 hover:text-red-600 dark:text-neutral-500 dark:hover:text-red-400"
            >
              Delete
            </button>
          </form>
        )}
      </div>
      {post.status === "pending_review" && post.author_id === access.authorId && (
        <div className="mt-4 flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-950">
          <p className="flex-1 text-sm text-amber-900 dark:text-amber-200">
            This post is waiting for your review. Read it below, edit if you like, then approve or reject it.
          </p>
          <form action={approvePost}>
            <input type="hidden" name="id" value={post.id} />
            <button type="submit" className="rounded-full bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700">
              Approve
            </button>
          </form>
          <form action={rejectPost}>
            <input type="hidden" name="id" value={post.id} />
            <button
              type="submit"
              className="rounded-full border border-red-600 px-4 py-1.5 text-sm font-medium text-red-600 hover:bg-red-600/10"
            >
              Reject
            </button>
          </form>
        </div>
      )}
      <div className="mt-6">
        <PostForm authors={authorChoices} post={post} action={updatePost} />
      </div>
    </div>
  );
}
