// Public marketing-site pages (besides "/" itself) -- read by the auth
// middleware's public allowlist and the sitemap, so a new marketing page
// added here is public and indexed in one place.
export const MARKETING_PATHS = [
  "/real-estate",
  "/property-management",
  "/manufacturing",
  "/financial-services",
  "/home-services",
  "/privacy",
  "/webinar",
] as const;

// Canonical marketing domain. The same pages also answer on app.actidesk.ai
// and premeeting.actiforge.ai (one deployment, several domains); metadata
// and the sitemap always point search engines at this one.
export const MARKETING_SITE_URL = "https://www.actidesk.ai";

// Public tag IDs (not secrets -- they ship in page source by design), loaded
// only on marketing pages and only after a visitor accepts cookies
// (consent-banner.tsx). A null ID loads nothing; fill it in to switch that
// tag on.
export const TRACKING_IDS: {
  ga4: string;
  hubspotPortal: string;
  metaPixel: string | null;
  linkedinPartner: string | null;
} = {
  ga4: "G-VP96DFFTXT",
  hubspotPortal: "46124718",
  metaPixel: null,
  linkedinPartner: null,
};
