"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { syncSeatCountAfterJoin, linkCheckoutSession } from "./actions";

type Step =
  | { name: "email" }
  | { name: "join"; email: string; orgName: string }
  | { name: "create"; email: string };

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const checkoutSessionId = searchParams.get("checkout_session_id");
  const [step, setStep] = useState<Step>({ name: "email" });
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Set once signUp() succeeds, so a failed complete_signup() can be
  // retried without re-running signUp (the auth account already exists).
  const [pendingAction, setPendingAction] = useState<{
    action: "join" | "create";
    company?: string;
  } | null>(null);

  async function handleEmailSubmit(event: FormEvent) {
    event.preventDefault();
    setErrorMessage(null);
    setStatus("sending");
    const supabase = createClient();
    const { data, error } = await supabase.rpc("find_org_by_email_domain", {
      p_email: email,
    });
    setStatus("idle");
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    const match = data?.[0];
    if (match) {
      setStep({ name: "join", email, orgName: match.org_name });
    } else {
      setStep({ name: "create", email });
    }
  }

  async function completeSignup(
    action: "join" | "create",
    company?: string,
  ) {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("complete_signup", {
      p_action: action,
      p_company_name: company ?? null,
    });
    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      setPendingAction({ action, company });
      return;
    }
    // Joining an existing org is the one seat-count change that doesn't
    // go through team/actions.ts's own syncOrgSeatCount calls -- fire
    // this without blocking the redirect on it finishing.
    if (action === "join" && data?.org_id) {
      void syncSeatCountAfterJoin();
    }
    // Only the org creator owns billing -- a stray checkout_session_id on
    // a "join" link is ignored. Await this so a paying signup lands on
    // the dashboard already billed, but never block the account on it:
    // any failure here just leaves the org on its normal free trial.
    if (action === "create" && checkoutSessionId) {
      const result = await linkCheckoutSession(checkoutSessionId);
      if (!result.ok) {
        console.warn("Could not link checkout session:", result.error);
      }
    }
    router.replace("/");
    router.refresh();
  }

  async function handlePasswordSubmit(event: FormEvent) {
    event.preventDefault();
    setErrorMessage(null);

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
    if (step.name === "create" && companyName.trim().length === 0) {
      setStatus("error");
      setErrorMessage("Company name is required.");
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
    if (!data.session) {
      // signUp() didn't hand back a session — most likely email
      // confirmation is still required. Don't call completeSignup with
      // whatever session this browser happens to already have (could be
      // stale/another account's); stop and tell the user what to do.
      setStatus("error");
      setErrorMessage(
        "Check your email to confirm your account, then sign in.",
      );
      return;
    }

    if (step.name === "join") {
      await completeSignup("join");
    } else {
      await completeSignup("create", companyName);
    }
  }

  if (step.name === "email") {
    return (
      <div className="flex flex-1 items-center justify-center bg-neutral-50 px-4">
        <form
          onSubmit={handleEmailSubmit}
          className="w-full max-w-sm space-y-4 rounded-lg border border-neutral-200 bg-white p-8 shadow-sm"
        >
          <div>
            <h1 className="text-lg font-semibold text-neutral-900">
              Create an account
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              Enter your work email to get started.
            </p>
          </div>
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
            {status === "sending" ? "Checking…" : "Continue"}
          </button>
          {errorMessage && (
            <p className="text-sm text-red-600">{errorMessage}</p>
          )}
          <p className="text-center text-sm text-neutral-500">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-neutral-900 underline"
            >
              Sign in
            </Link>
          </p>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-neutral-50 px-4">
      <form
        onSubmit={handlePasswordSubmit}
        className="w-full max-w-sm space-y-4 rounded-lg border border-neutral-200 bg-white p-8 shadow-sm"
      >
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">
            {step.name === "join"
              ? `Join ${step.orgName}`
              : "Create your company"}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">{email}</p>
        </div>
        {step.name === "create" && (
          <input
            required
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            placeholder="Company name"
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none"
          />
        )}
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
          <div className="space-y-2">
            <p className="text-sm text-red-600">{errorMessage}</p>
            {pendingAction && (
              <button
                type="button"
                onClick={() =>
                  completeSignup(pendingAction.action, pendingAction.company)
                }
                className="text-sm font-medium text-neutral-900 underline"
              >
                Retry
              </button>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={() => setStep({ name: "email" })}
          className="w-full text-center text-sm text-neutral-500 hover:text-neutral-900"
        >
          ← Use a different email
        </button>
      </form>
    </div>
  );
}
