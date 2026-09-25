import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @sparticuz/chromium unpacks its browser from bin/ at run time, which the
  // file tracer can't see -- without this the Account page's signature
  // screenshot fails on Vercel with "input directory ... does not exist".
  outputFileTracingIncludes: {
    "/account": ["./node_modules/@sparticuz/chromium/bin/**/*"],
  },
  // next/image refuses any remote host not listed here -- without this, the
  // first blog post with an AI-generated cover would error instead of
  // rendering. Scoped to exactly the public blog-covers bucket (see
  // api/cron/generate-blog-post), not the whole Supabase project.
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "fywmrqbxjlocjsdopjep.supabase.co",
        pathname: "/storage/v1/object/public/blog-covers/**",
      },
    ],
  },
  // Security headers (2026-09-16 audit): the app previously set none at
  // all, which left every response -- including the public, unauthenticated
  // /s/[slug] prospect page -- frameable by any third-party site
  // (clickjacking / phishing-shell risk). Applied app-wide except the
  // Outlook add-in's pages, which Microsoft's Office hosts must be able to
  // frame -- and only they may.
  async headers() {
    return [
      {
        // Every page except the Outlook add-in's: no third-party framing.
        source: "/:path((?!outlook-addin/).*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
        ],
      },
      {
        // Outlook on the web (and the new Outlook, which hosts it) shows the
        // taskpane in a frame on Microsoft's own domains. X-Frame-Options has
        // no allow-list form, so it's omitted here and frame-ancestors names
        // only Microsoft's Office hosts.
        source: "/outlook-addin/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors 'self' https://*.office.com https://*.office365.com https://*.cloud.microsoft https://*.officeapps.live.com https://*.outlook.com https://outlook.live.com",
          },
        ],
      },
      {
        // Prospect pages are for one recipient, but their links get forwarded
        // and pasted into email signatures -- keep them out of search results.
        // robots.ts deliberately does not Disallow /s/, or crawlers would
        // never fetch the page and see this.
        source: "/s/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
