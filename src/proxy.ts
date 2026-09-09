import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // /library is excluded: its file-upload Server Actions (business
    // card/image/document/logo, up to 20-50MB) hit a hard 413 from
    // Vercel's platform-level request-size cap on the middleware/proxy
    // routing hop itself -- separate from and not fixable via
    // next.config.ts's serverActions.bodySizeLimit or
    // proxyClientMaxBodySize, since proxy.ts never even reads the body.
    // Safe to exclude: (dashboard)/layout.tsx already redirects
    // unauthenticated visitors independently (belt-and-suspenders), so
    // auth enforcement on /library doesn't depend on this middleware.
    "/((?!_next/static|_next/image|favicon.ico|library|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
