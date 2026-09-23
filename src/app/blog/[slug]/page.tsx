import { notFound } from "next/navigation";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = createAdminClient();

  const { data: post } = await supabase
    .from("blog_posts")
    .select(
      "title, seo_title, excerpt, meta_description, content, cover_image_url, image_alt_text, published_at, blog_authors(name, title)"
    )
    .eq("slug", slug)
    .eq("status", "published")
    // Same "approval date != publication date" guard as the index page --
    // a scheduled-but-not-yet-live post must 404, not render early.
    .lte("published_at", new Date().toISOString())
    .maybeSingle();

  if (!post) notFound();

  const author = Array.isArray(post.blog_authors) ? post.blog_authors[0] : post.blog_authors;

  return (
    <article className="mx-auto max-w-2xl px-6 py-16">
      {post.cover_image_url && (
        <div className="relative mb-8 aspect-video w-full overflow-hidden rounded-lg">
          <Image
            src={post.cover_image_url}
            alt={post.image_alt_text ?? ""}
            fill
            sizes="(min-width: 768px) 42rem, 100vw"
            className="object-cover"
            priority
          />
        </div>
      )}
      <h1 className="text-4xl font-bold text-neutral-900 dark:text-neutral-100">{post.title}</h1>
      <div className="mt-3 flex items-center gap-3 text-sm text-neutral-500 dark:text-neutral-400">
        {author && (
          <span>
            {author.name}, {author.title}
          </span>
        )}
        {post.published_at && (
          <span>
            {new Date(post.published_at).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </span>
        )}
      </div>
      {/* No Tailwind typography plugin installed in this repo -- targeted
          arbitrary variants instead of the `prose` classes, which would be
          no-ops without it. */}
      <div
        className="mt-8 text-base leading-7 text-neutral-800 dark:text-neutral-200
          [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-neutral-900 dark:[&_h2]:text-neutral-100
          [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-neutral-900 dark:[&_h3]:text-neutral-100
          [&_p]:my-4 [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6
          [&_a]:text-neutral-900 [&_a]:underline dark:[&_a]:text-neutral-100
          [&_table]:my-4 [&_table]:w-full [&_table]:border-collapse
          [&_th]:border [&_th]:border-neutral-300 [&_th]:p-2 dark:[&_th]:border-neutral-700
          [&_td]:border [&_td]:border-neutral-300 [&_td]:p-2 dark:[&_td]:border-neutral-700"
      >
        <ReactMarkdown>{post.content}</ReactMarkdown>
      </div>
    </article>
  );
}
