import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for use in Client Components (browser).
 * Call this inside the component/effect that needs it — don't module-cache
 * the instance, `createBrowserClient` is cheap and handles its own singleton.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // See server.ts for why `secure` is set explicitly here.
      cookieOptions: {
        secure: process.env.NODE_ENV === "production",
      },
    },
  );
}
