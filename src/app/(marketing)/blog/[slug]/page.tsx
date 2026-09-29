import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { PostPreview } from "@/components/blog/PostPreview";

// generateMetadata and the page both need this row; the Supabase client
// isn't plain fetch, so Next won't dedupe it on its own -- cache() makes it
// one query per request.
const getPublishedPost = cache(async (slug: string) => {
  const supabase = createAdminClient();
  const { data } = await supabase
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
  return data;
});

function authorOf(post: NonNullable<Awaited<ReturnType<typeof getPublishedPost>>>) {
  return Array.isArray(post.blog_authors) ? post.blog_authors[0] : post.blog_authors;
}

// The generation pipeline writes a distinct seo_title (<=65 chars) and
// meta_description (70-160 chars) per the SOP -- this is what puts them in
// <head>. Falls back to title/excerpt for manually written posts that leave
// the SEO fields blank.
export async function generateMetadata({ params }: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  if (!post) return {};

  const title = post.seo_title || post.title;
  const description = post.meta_description || post.excerpt;
  const author = authorOf(post);
  const images = post.cover_image_url
    ? [{ url: post.cover_image_url, alt: post.image_alt_text ?? "" }]
    : undefined;

  return {
    title,
    description,
    alternates: { canonical: `/blog/${slug}` },
    openGraph: {
      type: "article",
      title,
      description,
      url: `/blog/${slug}`,
      siteName: "ActiDesk",
      locale: "en_US",
      publishedTime: post.published_at ?? undefined,
      authors: author ? [author.name] : undefined,
      images,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: images?.map((image) => image.url),
    },
  };
}

export default async function BlogPostPage({ params }: PageProps<"/blog/[slug]">) {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  if (!post) notFound();

  const author = authorOf(post);

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <PostPreview
        title={post.title}
        publishedAt={post.published_at}
        authorName={author?.name}
        authorTitle={author?.title}
        coverImageUrl={post.cover_image_url}
        imageAltText={post.image_alt_text}
        content={post.content}
        priorityImage
      />
    </div>
  );
}
