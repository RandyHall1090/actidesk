import type { MetadataRoute } from "next";
import { MARKETING_SITE_URL } from "@/lib/marketing";

export default function robots(): MetadataRoute.Robots {
  return {
    // Marketing site and blog are meant to be found; personalized prospect
    // pages (/s/) and API routes are not. App routes need no rule -- they
    // redirect a signed-out crawler to /login anyway.
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/s/", "/api/"],
    },
    sitemap: `${MARKETING_SITE_URL}/sitemap.xml`,
  };
}
