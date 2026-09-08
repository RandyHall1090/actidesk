import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase auth session on every request and redirects
 * unauthenticated visitors away from the dashboard. The public package
 * renderer (/s/[slug]) and the login/auth routes are always allowed through.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
  const isPublicRoute =
    pathname.startsWith("/s/") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup");

  if (!user && !isPublicRoute) {
    // Fresh URL, not .clone() — a clone carries over the original request's
    // query string, which previously leaked unrelated params onto /login.
    const url = new URL("/login", request.url);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
