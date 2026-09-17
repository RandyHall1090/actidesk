/**
 * NEXT_PUBLIC_SITE_URL is hand-pasted into Vercel's dashboard, which has
 * twice silently added a trailing space -- invisible in the UI, but it
 * breaks every URL built from it (e.g. "https://host.tld /s/slug",
 * "https://host.tld /billing?checkout=success"). Trim once here instead
 * of at each of the ~9 call sites.
 */
export function getSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/+$/, "");
}
