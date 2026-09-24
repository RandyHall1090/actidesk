import type { MetadataRoute } from "next";
import { MARKETING_PATHS, MARKETING_SITE_URL } from "@/lib/marketing";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", ...MARKETING_PATHS, "/blog"].map((path) => ({
    url: `${MARKETING_SITE_URL}${path}`,
    lastModified: new Date(),
  }));
}
