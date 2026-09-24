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
        <div className="relative mb-8 aspect-video w-full overflow-hidden rounded-sm border border-steel-line">
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
      <h1 className="font-display text-4xl font-bold text-bone">{post.title}</h1>
      <div className="mt-3 flex items-center gap-3 font-mono-brand text-sm uppercase tracking-wider text-bone-dim">
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
        className="mt-8 text-lg leading-8 text-bone/90
          [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-bone
          [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:font-display [&_h3]:text-xl [&_h3]:font-bold [&_h3]:text-bone
          [&_p]:my-4 [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6
          [&_strong]:text-bone
          [&_a]:text-electric [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-bone
          [&_table]:my-4 [&_table]:w-full [&_table]:border-collapse
          [&_th]:border [&_th]:border-steel-line [&_th]:bg-steel/40 [&_th]:p-2 [&_th]:text-left [&_th]:text-bone
          [&_td]:border [&_td]:border-steel-line [&_td]:p-2"
      >
        <ReactMarkdown>{post.content}</ReactMarkdown>
      </div>
    </article>
  );
}
