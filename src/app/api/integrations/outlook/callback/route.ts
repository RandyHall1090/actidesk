import { createAdminClient } from "@/lib/supabase/admin";
import { exchangeCodeForTokens } from "@/lib/integrations/outlook/oauth";
import { encryptCredentials } from "@/lib/integrations/crypto";
import { getSiteUrl } from "@/lib/env";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const orgId = url.searchParams.get("state");
  const siteUrl = getSiteUrl();

  if (!code || !orgId) {
    return Response.redirect(`${siteUrl}/integrations?error=missing_code`, 302);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const supabase = createAdminClient();
    await supabase.from("integrations").upsert(
      {
        org_id: orgId,
        provider: "outlook",
        status: "connected",
        encrypted_credentials: encryptCredentials(tokens),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id,provider" },
    );
    return Response.redirect(`${siteUrl}/integrations?connected=outlook`, 302);
  } catch (error) {
    console.error("Outlook OAuth callback failed:", error);
    return Response.redirect(`${siteUrl}/integrations?error=outlook_connect_failed`, 302);
  }
}
