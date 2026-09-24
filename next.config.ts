import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
  // (clickjacking / phishing-shell risk). Applied app-wide rather than
  // per-route since none of this app's pages need to be embedded
  // cross-origin.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
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
