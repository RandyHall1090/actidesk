/**
 * Minimal Resend sender via plain fetch -- no SDK dependency needed for
 * one endpoint. Server-only; RESEND_API_KEY must never reach the browser.
 * Reuses the same Resend account/domain already verified for Supabase
 * Auth's SMTP relay (see spec/plan.md) -- this is a platform-level
 * notification (ActiDesk notifying its own rep), not tenant-branded
 * outbound mail, so one shared sending domain for every tenant is correct.
 */
export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("RESEND_API_KEY is not set -- email not sent.");
    return { ok: false, error: "Email is not configured." };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.NOTIFICATIONS_FROM_EMAIL ?? "ActiDesk <no-reply@mail.securafyai.com>",
      to,
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error("Resend send failed:", response.status, body);
    return { ok: false, error: "Failed to send email." };
  }
  return { ok: true };
}
