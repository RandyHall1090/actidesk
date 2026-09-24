// Public marketing-site pages (besides "/" itself) -- read by the auth
// middleware's public allowlist and the sitemap, so a new industry page
// added here is public and indexed in one place.
export const MARKETING_PATHS = [
  "/real-estate",
  "/property-management",
  "/manufacturing",
  "/financial-services",
  "/home-services",
] as const;

// Canonical marketing domain. The same pages also answer on app.actidesk.ai
// and premeeting.actiforge.ai (one deployment, several domains); metadata
// and the sitemap always point search engines at this one.
export const MARKETING_SITE_URL = "https://www.actidesk.ai";
