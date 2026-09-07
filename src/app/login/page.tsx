"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Tick while a cooldown is active so the "wait Ns" button label counts down.
  useEffect(() => {
    if (!cooldownUntil) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [cooldownUntil]);

  const cooldownSeconds = cooldownUntil
    ? Math.max(0, Math.ceil((cooldownUntil - now) / 1000))
    : 0;
  const inCooldown = cooldownSeconds > 0;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (inCooldown) return;
    setStatus("sending");
    setErrorMessage(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
    });
    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      // Supabase returns a 429 with a "retry after N seconds" style message
      // for both the per-address cooldown and the (very low, default-email-
      // provider) project-wide send rate limit. Either way, don't let the
      // button be smashed into a worse rate-limit state.
      const match = error.message.match(/(\d+)\s*seconds?/i);
      const waitSeconds = match ? parseInt(match[1], 10) : 60;
      setCooldownUntil(Date.now() + waitSeconds * 1000);
    } else {
      setStatus("sent");
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-neutral-50 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-lg border border-neutral-200 bg-white p-8 shadow-sm"
      >
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">Sign in</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Securafy Shock-and-Awe Portal — enter your work email for a login
            link.
          </p>
        </div>
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@securafy.com"
          className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={status === "sending" || inCooldown}
          className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-50"
        >
          {status === "sending"
            ? "Sending…"
            : inCooldown
              ? `Try again in ${cooldownSeconds}s`
              : "Send login link"}
        </button>
        {status === "sent" && (
          <p className="text-sm text-green-600">
            Check your email for the link (and your spam folder — it comes
            from noreply@mail.app.supabase.io).
          </p>
        )}
        {status === "error" && (
          <p className="text-sm text-red-600">{errorMessage}</p>
        )}
      </form>
    </div>
  );
}
