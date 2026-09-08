"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

// Internal tool — restrict self-service signup to Securafy work emails.
// This is a light client-side guard, not real access control; the RLS
// policies (org_id / role on profiles) are what actually govern access.
const ALLOWED_DOMAIN = "@securafy.com";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<
    "idle" | "sending" | "error" | "check-email"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErrorMessage(null);

    if (!email.toLowerCase().endsWith(ALLOWED_DOMAIN)) {
      setStatus("error");
      setErrorMessage(`Use your ${ALLOWED_DOMAIN} work email to sign up.`);
      return;
    }
    if (password.length < 8) {
      setStatus("error");
      setErrorMessage("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setStatus("error");
      setErrorMessage("Passwords don't match.");
      return;
    }

    setStatus("sending");
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }

    if (data.session) {
      // Email confirmation is off for this project — signed in immediately.
      router.replace("/");
      router.refresh();
    } else {
      // Email confirmation is required — same link-scanning risk as magic
      // links, but only hit once at account creation instead of every login.
      setStatus("check-email");
    }
  }

  if (status === "check-email") {
    return (
      <div className="flex flex-1 items-center justify-center bg-neutral-50 px-4">
        <div className="w-full max-w-sm space-y-2 rounded-lg border border-neutral-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-neutral-900">
            Check your email
          </h1>
          <p className="text-sm text-neutral-500">
            Click the confirmation link sent to {email}, then{" "}
            <Link href="/login" className="font-medium text-neutral-900 underline">
              sign in
            </Link>
            .
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-neutral-50 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-lg border border-neutral-200 bg-white p-8 shadow-sm"
      >
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">
            Create an account
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Securafy Shock-and-Awe Portal
          </p>
        </div>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@securafy.com"
          className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none"
        />
        <input
          type="password"
          required
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password (min. 8 characters)"
          className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none"
        />
        <input
          type="password"
          required
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="Confirm password"
          className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={status === "sending"}
          className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-50"
        >
          {status === "sending" ? "Creating account…" : "Create account"}
        </button>
        {status === "error" && (
          <p className="text-sm text-red-600">{errorMessage}</p>
        )}
        <p className="text-center text-sm text-neutral-500">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-neutral-900 underline">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
