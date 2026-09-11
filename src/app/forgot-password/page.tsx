"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus("sending");
    const supabase = createClient();
    // No redirectTo -- this deliberately doesn't rely on a clickable email
    // link at all (see reset-password/page.tsx): the Recovery email
    // template sends a numeric code instead, avoiding the corporate
    // email-link-scanning problem that already broke magic-link login
    // once for this app.
    await supabase.auth.resetPasswordForEmail(email);
    // Same message regardless of whether the email exists -- don't reveal
    // account existence.
    setStatus("done");
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-neutral-50 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-lg border border-neutral-200 bg-white p-8 shadow-sm"
      >
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">
            Forgot your password?
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Enter your email and we&apos;ll send you a code to reset it.
          </p>
        </div>

        {status === "done" ? (
          <p className="text-sm text-green-600">
            If an account exists for that email, a code is on its way. Check
            your inbox, then{" "}
            <Link
              href="/reset-password"
              className="font-medium text-neutral-900 underline"
            >
              enter it here
            </Link>
            .
          </p>
        ) : (
          <>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={status === "sending"}
              className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-50"
            >
              {status === "sending" ? "Sending…" : "Send reset code"}
            </button>
          </>
        )}

        <p className="text-center text-sm text-neutral-500">
          <Link href="/login" className="font-medium text-neutral-900 underline">
            Back to sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
