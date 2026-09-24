import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { MARKETING_PATHS } from "@/lib/marketing";

/**
 * Refreshes the Supabase auth session on every request and redirects
 * unauthenticated visitors away from the dashboard. The marketing site
 * ("/" and the industry pages), the public package renderer (/s/[slug]),
 * the public blog (/blog), and the login/auth routes are always allowed
 * through. Admin blog management stays under
 * (dashboard)/admin, which is not in this allowlist -- it keeps the
 * existing auth + is_platform_admin gate.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // See lib/supabase/server.ts for why `secure` is set explicitly.
      cookieOptions: {
        secure: process.env.NODE_ENV === "production",
      },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  // Boundary-safe: a bare `startsWith("/login")` would also match a future
  // route like `/login-history` and silently make it public. `/s/` is the
  // one legitimate prefix (it's meant to match many slugs); every other
  // public route is matched exactly or as an explicit sub-path.
  const isPublicPath = (base: string) =>
    pathname === base || pathname.startsWith(`${base}/`);
  const isMarketingRoute =
    pathname === "/" ||
    MARKETING_PATHS.some((path) => isPublicPath(path)) ||
    pathname === "/sitemap.xml" ||
    pathname === "/robots.txt";

  // Forge University's pattern: "/" is the public marketing homepage, the
  // app lives at "/dashboard". A signed-in rep who still has the old
  // app.actidesk.ai/ bookmark lands in the app, not on a sales page.
  if (user && pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const isPublicRoute =
    isMarketingRoute ||
    pathname.startsWith("/s/") ||
    isPublicPath("/blog") ||
    isPublicPath("/login") ||
    isPublicPath("/signup") ||
    isPublicPath("/forgot-password") ||
    isPublicPath("/reset-password") ||
    isPublicPath("/api/packages") ||
    // Pre-existing gap found 2026-09-20 while testing the new pre-signup
    // checkout flow: neither of these was ever in this allowlist, so
    // Stripe's webhook calls (no user session) have been getting
    // 307-redirected to /login instead of reaching the route handler --
    // subscription status changes were never actually being applied.
    isPublicPath("/api/webhooks/stripe") ||
    isPublicPath("/api/checkout") ||
    // Same gap class, found 2026-09-21 during a full security/QA sweep:
    // both of these are called with no Supabase session by design (pg_cron
    // via a Bearer token; an anonymous prospect's own browser) and were
    // getting redirected to /login before ever reaching their own auth
    // checks -- the daily follow-through job and "prospect opened it" rep
    // notifications have never actually fired in production. Each route
    // still enforces its own authorization (constant-time bearer-token
    // check / no sensitive data returned) -- this only lets the request
    // reach that check instead of being turned away earlier.
    isPublicPath("/api/cron/follow-through") ||
    // Same gap class as the two routes above: pg_cron calls this with a
    // Bearer token, no Supabase session -- CRON_SECRET auth happens inside
    // the route itself (generate-blog-post/route.ts).
    isPublicPath("/api/cron/generate-blog-post") ||
    isPublicPath("/api/notifications/hot-lead");

  if (!user && !isPublicRoute) {
    // Fresh URL, not .clone() — a clone carries over the original request's
    // query string, which previously leaked unrelated params onto /login.
    const url = new URL("/login", request.url);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
