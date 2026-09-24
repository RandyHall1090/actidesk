// ActiDesk's SOP property profile (Multi-Brand Blog Writing SOP §2/§13):
// audience, approved internal-link targets, CTA, image direction, and
// prohibited claims. CEO-approved 2026-09-24 in place of the formal CMO
// sign-off the SOP otherwise calls for.
//
// Internal links are site-relative paths, same as Forge University's: the
// marketing site, blog, and app are one deployment, so a relative link
// resolves correctly whichever of its domains a reader arrived on. This
// also keeps them out of citation handling, which only ever looks at
// absolute http(s) links (see blog-agent.ts).

export const PRIMARY_OFFERING_URL = "/";

export const PILLAR_CONVERSION_URL = "/signup";

// ActiDesk's product is deliberately horizontal (any rep, any industry --
// see spec/blog-sop-compliance-instructions.md), so the "supporting
// resource" role isn't one fixed page: the model picks whichever real
// industry page best matches the post's own topic/example, and the
// validator (blog-agent.ts's validateInternalLinks) accepts any one of
// these, never more than one.
export const RESOURCE_URL_OPTIONS = [
  { url: "/real-estate", industry: "real estate" },
  { url: "/property-management", industry: "property management" },
  { url: "/manufacturing", industry: "manufacturing" },
  { url: "/financial-services", industry: "financial services" },
  { url: "/home-services", industry: "home services and contractors" },
] as const;

export const APPROVED_CTA = {
  label: "Get Started →",
  url: PILLAR_CONVERSION_URL,
};

export const IMAGE_DIRECTION =
  "Dark background (#0a0c10), electric-cyan accent (#00c8ff), modern B2B " +
  "SaaS/tech aesthetic matching actidesk.ai's own visual identity -- not " +
  "generic corporate stock photography, not a literal desk-scene render " +
  "(that's the product's own template, not blog cover art).";

export const PROHIBITED_CLAIMS = [
  "No specific ROI, win-rate, or close-rate guarantees or promises.",
  "No named customer results or case-study specifics without that customer's explicit permission on file.",
  "No claim that ActiDesk or Securafy holds a security/compliance certification it does not actually hold.",
  "No competitor callouts by name (matches the SOP's existing baseline).",
] as const;
