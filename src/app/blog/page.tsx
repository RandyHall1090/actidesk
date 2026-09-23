import Link from "next/link";
import Image from "next/image";
import { createAdminClient } from "@/lib/supabase/admin";

type BlogSearchParams = {
  q?: string;
  author?: string;
  category?: string;
  from?: string;
  to?: string;
};

export default async function BlogIndexPage({
  searchParams,
}: {
  searchParams: Promise<BlogSearchParams>;
}) {
  const { q, author, from, to } = await searchParams;
  const supabase = createAdminClient();

  let postsQuery = supabase
    .from("blog_posts")
    .select("slug, title, excerpt, cover_image_url, published_at, blog_authors(name, title)")
    .eq("status", "published")
    // "Approval date != publication date": a published row can carry a
    // future published_at (its assigned editorial-calendar slot) --
    // without this filter it would be publicly visible the moment it's
    // approved instead of on its scheduled date.
    .lte("published_at", new Date().toISOString());

  const trimmedQuery = q?.trim();
  const safeQuery = trimmedQuery?.replace(/[,()%]/g, " ").replace(/\s+/g, " ").trim();
  if (safeQuery) {
    postsQuery = postsQuery.or(`title.ilike.%${safeQuery}%,excerpt.ilike.%${safeQuery}%`);
  }
  if (author) postsQuery = postsQuery.eq("author_id", author);
  if (from) postsQuery = postsQuery.gte("published_at", new Date(from).toISOString());
  if (to) {
    const endOfDay = new Date(to);
    endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);
    postsQuery = postsQuery.lt("published_at", endOfDay.toISOString());
  }

  const [{ data: posts }, { data: authors }] = await Promise.all([
    postsQuery.order("published_at", { ascending: false }),
    supabase.from("blog_authors").select("id, name").order("name"),
  ]);

  const hasFilters = Boolean(safeQuery || author || from || to);

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
          Blog
        </p>
        <h1 className="mt-2 text-4xl font-bold text-neutral-900 dark:text-neutral-100">
          Sales enablement, straight talk.
        </h1>
      </div>

      <form
        method="get"
        className="mt-10 flex flex-col gap-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-700"
      >
        <div>
          <label htmlFor="q" className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500">
            Search
          </label>
          <input
            id="q"
            name="q"
            type="text"
            defaultValue={q ?? ""}
            placeholder="Search by keyword..."
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="author" className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500">
              Author
            </label>
            <select
              id="author"
              name="author"
              defaultValue={author ?? ""}
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100"
            >
              <option value="">All authors</option>
              {(authors ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="from" className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500">
              From date
            </label>
            <input
              id="from"
              name="from"
              type="date"
              defaultValue={from ?? ""}
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100"
            />
          </div>
          <div>
            <label htmlFor="to" className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500">
              To date
            </label>
            <input
              id="to"
              name="to"
              type="date"
              defaultValue={to ?? ""}
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100"
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            className="rounded-full border border-neutral-300 px-5 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 dark:border-neutral-600 dark:text-neutral-100 dark:hover:bg-neutral-800"
          >
            Search
          </button>
          {hasFilters && (
            <Link href="/blog" className="text-sm text-neutral-500 underline dark:text-neutral-400">
              Clear filters
            </Link>
          )}
        </div>
      </form>

      {(posts ?? []).length === 0 && (
        <p className="mt-10 text-center text-sm text-neutral-500 dark:text-neutral-400">
          {hasFilters
            ? "No posts match these filters — try broadening your search."
            : "No posts published yet — check back soon."}
        </p>
      )}

      <div className="mt-10 flex flex-col gap-4">
        {(posts ?? []).map((post) => {
          const postAuthor = Array.isArray(post.blog_authors)
            ? post.blog_authors[0]
            : post.blog_authors;
          return (
            <Link key={post.slug} href={`/blog/${post.slug}`}>
              <article className="rounded-lg border border-neutral-200 p-5 transition-colors hover:border-neutral-400 dark:border-neutral-700 dark:hover:border-neutral-500">
                {post.cover_image_url && (
                  <div className="relative mb-4 aspect-video w-full overflow-hidden rounded-md">
                    <Image
                      src={post.cover_image_url}
                      alt=""
                      fill
                      sizes="(min-width: 640px) 60vw, 100vw"
                      className="object-cover"
                    />
                  </div>
                )}
                <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                  {post.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
                  {post.excerpt}
                </p>
                <div className="mt-3 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
                  {postAuthor && (
                    <p>
                      {postAuthor.name}, {postAuthor.title}
                    </p>
                  )}
                  {post.published_at && (
                    <p>
                      {new Date(post.published_at).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  )}
                </div>
              </article>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
