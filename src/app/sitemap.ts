import type { MetadataRoute } from "next";
import { MARKETING_PATHS, MARKETING_SITE_URL } from "@/lib/marketing";
import { createAdminClient } from "@/lib/supabase/admin";

// Rebuilt hourly so a newly published post is listed without a redeploy.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = ["", ...MARKETING_PATHS, "/blog"].map((path) => ({
    url: `${MARKETING_SITE_URL}${path}`,
    lastModified: new Date(),
  }));

  // Same "published and already live" rule as /blog/[slug] -- a scheduled
  // post must not be advertised before it would render.
  const { data: posts } = await createAdminClient()
    .from("blog_posts")
    .select("slug, published_at")
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false });

  const postEntries = (posts ?? []).map((post) => ({
    url: `${MARKETING_SITE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.published_at as string),
  }));

  return [...pages, ...postEntries];
}
