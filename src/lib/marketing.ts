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
  clarity: string | null;
} = {
  ga4: "G-BLDZM22HWT",
  hubspotPortal: "46124718",
  metaPixel: "4478049348995490",
  linkedinPartner: "7429900",
  clarity: "ytg61ba24q",
};

// Bing Webmaster Tools site ownership. A meta tag, not tracking, so it is
// rendered in the page head regardless of cookie consent.
export const BING_SITE_VERIFICATION = "19DC1DEFB6AA112973E5547E17AE38EC";
