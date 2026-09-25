import type { MetadataRoute } from "next";
import { MARKETING_SITE_URL } from "@/lib/marketing";

export default function robots(): MetadataRoute.Robots {
  return {
    // Marketing site and blog are meant to be found; API routes are not.
    // Prospect pages (/s/) are kept out of results by their X-Robots-Tag:
    // noindex header (next.config.ts) instead of a Disallow here -- a
    // disallowed URL can still be listed from a link elsewhere, since the
    // crawler never fetches it to see the noindex. App routes need no rule
    // -- they redirect a signed-out crawler to /login anyway.
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/"],
    },
    sitemap: `${MARKETING_SITE_URL}/sitemap.xml`,
  };
}
