import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { createAdminClient } from "@/lib/supabase/admin";

// Without this, /blog inherited the homepage's title and description.
export const metadata: Metadata = {
  title: "ActiDesk Blog — Sales Enablement, Straight Talk",
  description:
    "Practical articles on personalized outbound, pre-meeting prospect packages, and running a sales team that gets remembered, from Securafy's leadership team.",
  alternates: { canonical: "/blog" },
};

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
        <p className="font-mono-brand text-xs uppercase tracking-[0.2em] text-electric">
          Blog
        </p>
        <h1 className="mt-2 font-display text-4xl font-bold text-bone">
          Sales enablement, straight talk.
        </h1>
      </div>

      <form
        method="get"
        className="mt-10 flex flex-col gap-4 rounded-sm border border-steel-line bg-steel/20 p-4"
      >
        <div>
          <label htmlFor="q" className="mb-1 block font-mono-brand text-xs uppercase tracking-wider text-bone-dim">
            Search
          </label>
          <input
            id="q"
            name="q"
            type="text"
            defaultValue={q ?? ""}
            placeholder="Search by keyword..."
            className="w-full rounded-sm border border-steel-line bg-ink/60 px-3 py-2 text-sm text-bone placeholder:text-bone-dim/70 focus:border-electric focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="author" className="mb-1 block font-mono-brand text-xs uppercase tracking-wider text-bone-dim">
              Author
            </label>
            <select
              id="author"
              name="author"
              defaultValue={author ?? ""}
              className="w-full rounded-sm border border-steel-line bg-ink/60 px-3 py-2 text-sm text-bone focus:border-electric focus:outline-none"
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
            <label htmlFor="from" className="mb-1 block font-mono-brand text-xs uppercase tracking-wider text-bone-dim">
              From date
            </label>
            <input
              id="from"
              name="from"
              type="date"
              defaultValue={from ?? ""}
              className="w-full rounded-sm border border-steel-line bg-ink/60 px-3 py-2 text-sm text-bone focus:border-electric focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="to" className="mb-1 block font-mono-brand text-xs uppercase tracking-wider text-bone-dim">
              To date
            </label>
            <input
              id="to"
              name="to"
              type="date"
              defaultValue={to ?? ""}
              className="w-full rounded-sm border border-steel-line bg-ink/60 px-3 py-2 text-sm text-bone focus:border-electric focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            className="btn-angled bg-electric px-6 py-2 font-mono-brand text-xs font-medium uppercase tracking-wider text-ink hover:bg-electric/90"
          >
            Search
          </button>
          {hasFilters && (
            <Link href="/blog" className="text-sm text-bone-dim underline hover:text-bone">
              Clear filters
            </Link>
          )}
        </div>
      </form>

      {(posts ?? []).length === 0 && (
        <p className="mt-10 text-center text-sm text-bone-dim">
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
              <article className="rounded-sm border border-steel-line bg-steel/20 p-5 transition-colors hover:border-electric">
                {post.cover_image_url && (
                  <div className="relative mb-4 aspect-video w-full overflow-hidden rounded-sm">
                    <Image
                      src={post.cover_image_url}
                      alt=""
                      fill
                      sizes="(min-width: 640px) 60vw, 100vw"
                      className="object-cover"
                    />
                  </div>
                )}
                <h2 className="font-display text-xl font-bold text-bone">
                  {post.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-bone-dim">
                  {post.excerpt}
                </p>
                <div className="mt-3 flex items-center justify-between font-mono-brand text-xs uppercase tracking-wider text-bone-dim">
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
