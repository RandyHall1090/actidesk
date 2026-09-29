import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/profile";
import { canActOnPost, getBlogAccess } from "@/lib/blogAccess";
import { createAdminClient } from "@/lib/supabase/admin";
import { PostPreview } from "@/components/blog/PostPreview";
import { PostForm } from "../post-form";
import { approvePost, deletePost, rejectPost, updatePost } from "../actions";

type Author = { name: string; title: string };
function firstAuthor(value: unknown): Author | null {
  if (Array.isArray(value)) return (value[0] as Author | undefined) ?? null;
  return (value as Author | null) ?? null;
}

// Same layout as Forge University's /admin/blog/[postId]: a rendered preview
// (exactly what readers will see once it's live), then the edit form.
export default async function AdminBlogPostPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentProfile())) redirect("/login");
  const access = await getBlogAccess();
  const denied = (
    <p className="text-sm text-zinc-500 dark:text-zinc-400">
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
        "id, slug, title, seo_title, excerpt, meta_description, image_alt_text, content, cover_image_url, author_id, status, published_at, blog_authors(name, title)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("blog_authors").select("id, name, title").order("name"),
  ]);

  if (!post) notFound();
  if (!access.isPlatformAdmin && post.author_id !== access.authorId) return denied;

  const author = firstAuthor(post.blog_authors);
  // An author can't reassign their post, so only offer them their own name.
  const authorChoices = access.isPlatformAdmin
    ? (authors ?? [])
    : (authors ?? []).filter((choice) => choice.id === access.authorId);
  const canAct = canActOnPost(access, post.author_id as string | null);

  return (
    <div>
      <Link href="/admin/blog" className="text-sm text-zinc-500 hover:underline dark:text-zinc-500">
        ← All posts
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-black dark:text-zinc-50">Edit post</h1>
      {author && (
        <p className="mt-1 text-sm text-zinc-400 dark:text-zinc-500">
          By {author.name}, {author.title}
        </p>
      )}

      {/* The review email lands here, so the one-click decision sits on top. */}
      {post.status === "pending_review" &&
        (canAct ? (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-amber-600/30 bg-amber-600/10 px-4 py-3">
            <p className="flex-1 text-sm text-amber-800 dark:text-amber-300">
              This post is waiting for review. Read the preview below, edit if you like, then approve or reject it.
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
        ) : (
          <p className="mt-4 text-xs text-zinc-400 dark:text-zinc-500">
            Only {author?.name ?? "its author"} can approve or reject this post.
          </p>
        ))}

      {/* marketing-shell gives the preview the public site's own dark look and fonts. */}
      <div className="marketing-shell mt-6 rounded-lg border border-steel-line p-6">
        <p className="mb-4 text-xs font-medium uppercase tracking-wide text-bone-dim">Preview</p>
        <PostPreview
          title={post.title}
          publishedAt={post.status === "published" ? post.published_at : null}
          authorName={author?.name}
          authorTitle={author?.title}
          coverImageUrl={post.cover_image_url}
          imageAltText={post.image_alt_text}
          content={post.content}
        />
      </div>

      <div className="mt-6">
        <PostForm authors={authorChoices} post={post} action={updatePost} />
      </div>

      {access.isPlatformAdmin && (
        <form action={deletePost} className="mt-6">
          <input type="hidden" name="id" value={post.id} />
          <button
            type="submit"
            className="rounded-full border border-red-600/30 px-5 py-2 text-sm font-medium text-red-600 hover:bg-red-600/10 dark:text-red-400"
          >
            Delete post
          </button>
        </form>
      )}
    </div>
  );
}
