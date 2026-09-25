import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/profile";
import { getBlogAccess } from "@/lib/blogAccess";
import { createAdminClient } from "@/lib/supabase/admin";
import { displayStatus } from "@/lib/blog";
import { approvePost, rejectPost, updateAuthorAutoPublish } from "./actions";

const STATUS_STYLES: Record<string, string> = {
  published: "bg-green-600/10 text-green-700 dark:text-green-400",
  scheduled: "bg-blue-600/10 text-blue-700 dark:text-blue-400",
  pending_review: "bg-amber-600/10 text-amber-700 dark:text-amber-400",
  rejected: "bg-red-600/10 text-red-700 dark:text-red-400",
  draft: "bg-neutral-500/10 text-neutral-600 dark:text-neutral-400",
};

export default async function AdminBlogPage() {
  if (!(await getCurrentProfile())) redirect("/login");
  const access = await getBlogAccess();
  if (!access) {
    return (
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Only Securafy platform admins and blog authors can access this page.
      </p>
    );
  }
  const { isPlatformAdmin, authorId } = access;

  // An author who isn't a platform admin sees only their own posts and setting.
  const supabase = createAdminClient();
  let postsQuery = supabase
    .from("blog_posts")
    .select("id, slug, title, status, published_at, author_id, blog_authors(name, title)")
    .order("created_at", { ascending: false });
  let authorsQuery = supabase.from("blog_authors").select("id, name, title, auto_publish").order("name");
  if (!isPlatformAdmin && authorId) {
    postsQuery = postsQuery.eq("author_id", authorId);
    authorsQuery = authorsQuery.eq("id", authorId);
  }
  const [{ data: posts }, { data: authors }] = await Promise.all([postsQuery, authorsQuery]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
          {isPlatformAdmin ? "Blog posts" : "Your blog posts"}
        </h2>
        {isPlatformAdmin && (
          <Link
            href="/admin/blog/new"
            className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
          >
            + New post
          </Link>
        )}
      </div>

      <div className="mt-6 rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          Auto-publish (AI-generated posts)
        </h3>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          Off means a generated post waits in Pending review for that author to approve. Each
          author controls only their own setting.
        </p>
        <ul className="mt-3 space-y-2">
          {(authors ?? []).map((author) => {
            const isOwnSetting = author.id === authorId;
            return (
              <li
                key={author.id}
                className="flex items-center justify-between rounded-md border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-700"
              >
                <span className="text-neutral-700 dark:text-neutral-300">
                  {author.name} <span className="text-neutral-400">({author.title})</span>
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-medium ${author.auto_publish ? "text-green-700 dark:text-green-400" : "text-neutral-500 dark:text-neutral-400"}`}
                  >
                    {author.auto_publish ? "On" : "Off"}
                  </span>
                  <form action={updateAuthorAutoPublish}>
                    <input type="hidden" name="autoPublish" value={(!author.auto_publish).toString()} />
                    <button
                      type="submit"
                      disabled={!isOwnSetting}
                      title={isOwnSetting ? undefined : "Only this author can change their own setting."}
                      className="rounded-full border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800"
                    >
                      {author.auto_publish ? "Turn off" : "Turn on"}
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <ul className="mt-6 space-y-2">
        {(posts ?? []).map((post) => {
          const author = Array.isArray(post.blog_authors) ? post.blog_authors[0] : post.blog_authors;
          const status = displayStatus(post.status, post.published_at);
          return (
            <li
              key={post.id}
              className="overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-700"
            >
              <Link
                href={`/admin/blog/${post.id}/edit`}
                className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-800"
              >
                <span className="flex flex-col">
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">
                    {post.title} <span className="text-neutral-400">({post.slug})</span>
                  </span>
                  {author && (
                    <span className="text-xs text-neutral-400 dark:text-neutral-500">
                      {author.name}, {author.title}
                    </span>
                  )}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status] ?? STATUS_STYLES.draft}`}
                >
                  {status === "scheduled"
                    ? `scheduled: ${new Date(post.published_at!).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                    : status}
                </span>
              </Link>
              {post.status === "pending_review" && post.author_id === authorId && (
                <div className="flex gap-2 border-t border-neutral-200 px-4 py-2 dark:border-neutral-700">
                  <form action={approvePost}>
                    <input type="hidden" name="id" value={post.id} />
                    <button
                      type="submit"
                      className="rounded-full bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700"
                    >
                      Approve
                    </button>
                  </form>
                  <form action={rejectPost}>
                    <input type="hidden" name="id" value={post.id} />
                    <button
                      type="submit"
                      className="rounded-full border border-red-600 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-600/10"
                    >
                      Reject
                    </button>
                  </form>
                </div>
              )}
            </li>
          );
        })}
        {(posts ?? []).length === 0 && (
          <li className="rounded-lg border border-neutral-200 px-4 py-8 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
            No posts yet.
          </li>
        )}
      </ul>
    </div>
  );
}
