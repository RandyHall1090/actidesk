import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // .mjs added for public/pdf.worker.min.mjs (MagazineViewer's PDF.js
    // worker) -- confirmed live that an anonymous request for it was
    // getting 307-redirected to /login like any other non-public route,
    // since it doesn't match any of updateSession's public-route prefixes
    // and previously wasn't excluded here either. pdf.js silently falls
    // back to a slower "fake worker" (main-thread) mode when its real
    // worker script fails to load, so the magazine reader still worked
    // during testing -- but every real, unauthenticated prospect was
    // hitting this exact path.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mjs)$).*)",
  ],
};
