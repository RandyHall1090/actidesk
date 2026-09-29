import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/profile";
import { canActOnPost, getBlogAccess } from "@/lib/blogAccess";
import { createAdminClient } from "@/lib/supabase/admin";
import { displayStatus } from "@/lib/blog";
import { PostForm } from "./post-form";
import { approvePost, createPost, rejectPost, updateAuthorAutoPublish } from "./actions";

// Same structure and look as Forge University's /admin/blog: status filter
// pills, one auto-publish form with a checkbox per author (only your own
// enabled), a card per post with created date and status pill, one-click
// approve/reject for the posts you may act on, and "+ New post" at the end.

const STATUS_STYLES: Record<string, string> = {
  published: "bg-green-600/10 text-green-700 dark:text-green-400",
  scheduled: "bg-blue-600/10 text-blue-700 dark:text-blue-400",
  pending_review: "bg-amber-600/10 text-amber-700 dark:text-amber-400",
  rejected: "bg-red-600/10 text-red-700 dark:text-red-400",
  draft: "bg-black/[.06] text-zinc-600 dark:bg-white/[.08] dark:text-zinc-400",
};

type StatusFilter = "all" | "unposted" | "rejected" | "published";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unposted", label: "Unposted" },
  { value: "rejected", label: "Rejected" },
  { value: "published", label: "Published" },
];

function isStatusFilter(value: string | undefined): value is StatusFilter {
  return value === "all" || value === "unposted" || value === "rejected" || value === "published";
}

type Author = { name: string; title: string };
function firstAuthor(value: unknown): Author | null {
  if (Array.isArray(value)) return (value[0] as Author | undefined) ?? null;
  return (value as Author | null) ?? null;
}

export default async function AdminBlogPage({ searchParams }: PageProps<"/admin/blog">) {
  if (!(await getCurrentProfile())) redirect("/login");
  const access = await getBlogAccess();
  if (!access) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Only Securafy platform admins and blog authors can access this page.
      </p>
    );
  }
  const { isPlatformAdmin, authorId } = access;

  const { status: rawStatus } = await searchParams;
  const statusFilter: StatusFilter = isStatusFilter(typeof rawStatus === "string" ? rawStatus : undefined)
    ? (rawStatus as StatusFilter)
    : "all";

  const supabase = createAdminClient();
  let postsQuery = supabase
    .from("blog_posts")
    .select("id, slug, title, status, published_at, created_at, author_id, blog_authors(name, title)");
  // "Unposted" groups the two pre-publish states -- has it gone out or not.
  if (statusFilter === "unposted") {
    postsQuery = postsQuery.in("status", ["draft", "pending_review"]);
  } else if (statusFilter !== "all") {
    postsQuery = postsQuery.eq("status", statusFilter);
  }
  // An author who isn't a platform admin sees only their own posts.
  if (!isPlatformAdmin && authorId) postsQuery = postsQuery.eq("author_id", authorId);

  const [{ data: posts }, { data: authors }] = await Promise.all([
    postsQuery.order("created_at", { ascending: false }),
    supabase.from("blog_authors").select("id, name, title, auto_publish").eq("active", true).order("name"),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">Blog posts</h1>

      <div className="mt-4 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => (
          <Link
            key={filter.value}
            href={filter.value === "all" ? "/admin/blog" : `/admin/blog?status=${filter.value}`}
            className={`rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wide ${
              statusFilter === filter.value
                ? "border-black/[.2] bg-black/[.06] text-black dark:border-white/[.3] dark:bg-white/[.1] dark:text-zinc-50"
                : "border-black/[.08] text-zinc-500 hover:text-black dark:border-white/[.145] dark:text-zinc-400 dark:hover:text-zinc-50"
            }`}
          >
            {filter.label}
          </Link>
        ))}
      </div>

      <form
        action={updateAuthorAutoPublish}
        className="mt-4 rounded-lg border border-black/[.08] p-4 dark:border-white/[.145]"
      >
        <p className="text-sm font-medium text-black dark:text-zinc-50">
          Auto-publish AI-generated posts (skip review)
        </p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Each author controls only their own setting.</p>
        <div className="mt-3 space-y-2">
          {(authors ?? []).map((author) => {
            const isOwnSetting = author.id === authorId;
            return (
              <div key={author.id} className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id={`auto_publish_${author.id}`}
                  name={`auto_publish_${author.id}`}
                  defaultChecked={author.auto_publish}
                  disabled={!isOwnSetting}
                  className="size-4 disabled:opacity-50"
                />
                <label
                  htmlFor={`auto_publish_${author.id}`}
                  className={`text-sm ${isOwnSetting ? "text-zinc-600 dark:text-zinc-400" : "text-zinc-400 dark:text-zinc-600"}`}
                >
                  {author.name}, {author.title}
                  {isOwnSetting && <span className="ml-2 text-xs text-zinc-400">(you)</span>}
                </label>
              </div>
            );
          })}
        </div>
        {authorId && (
          <button
            type="submit"
            className="mt-3 rounded-full border border-black/[.08] px-4 py-1.5 text-sm font-medium text-zinc-800 hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-200 dark:hover:bg-white/[.06]"
          >
            Save
          </button>
        )}
      </form>

      {(posts ?? []).length === 0 && (
        <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">No posts in this filter.</p>
      )}

      <ul className="mt-6 space-y-2">
        {(posts ?? []).map((post) => {
          const author = firstAuthor(post.blog_authors);
          const status = displayStatus(post.status, post.published_at);
          const canAct = canActOnPost(access, post.author_id as string | null);
          return (
            <li key={post.id} className="overflow-hidden rounded-lg border border-black/[.08] dark:border-white/[.145]">
              <Link
                href={`/admin/blog/${post.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-black/[.03] dark:hover:bg-white/[.05]"
              >
                <span className="flex flex-col">
                  <span className="font-medium text-black dark:text-zinc-50">
                    {post.title} <span className="text-zinc-400">({post.slug})</span>
                  </span>
                  {author && (
                    <span className="text-xs text-zinc-400 dark:text-zinc-500">
                      {author.name}, {author.title}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-3">
                  {post.created_at && (
                    <span className="whitespace-nowrap text-xs text-zinc-400 dark:text-zinc-500">
                      Created{" "}
                      {new Date(post.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  )}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status] ?? STATUS_STYLES.draft}`}
                  >
                    {status === "scheduled"
                      ? `scheduled: ${new Date(post.published_at!).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                      : status}
                  </span>
                </span>
              </Link>
              {post.status === "pending_review" &&
                (canAct ? (
                  <div className="flex gap-2 border-t border-black/[.08] px-4 py-2 dark:border-white/[.145]">
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
                ) : (
                  <p className="border-t border-black/[.08] px-4 py-2 text-xs text-zinc-400 dark:border-white/[.145] dark:text-zinc-500">
                    Only {author?.name ?? "its author"} can approve or reject this post.
                  </p>
                ))}
            </li>
          );
        })}
      </ul>

      {isPlatformAdmin && (
        <details className="mt-8 rounded-lg border border-black/[.08] p-4 dark:border-white/[.145]">
          <summary className="cursor-pointer text-sm font-medium text-black dark:text-zinc-50">+ New post</summary>
          <div className="mt-4">
            <PostForm authors={authors ?? []} action={createPost} />
          </div>
        </details>
      )}
    </div>
  );
}
