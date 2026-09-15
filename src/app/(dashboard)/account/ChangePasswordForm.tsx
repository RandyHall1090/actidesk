"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export function ChangePasswordForm() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "error" | "done">(
    "idle",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErrorMessage(null);

    if (newPassword.length < 8) {
      setStatus("error");
      setErrorMessage("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setStatus("error");
      setErrorMessage("Passwords don't match.");
      return;
    }

    setStatus("sending");
    const supabase = createClient();
    // Changing a password for an already-signed-in user needs no email --
    // that's only needed for the separate "forgot password" flow
    // (/forgot-password, /reset-password), which uses an emailed 6-digit
    // code rather than a clickable link, for the same link-scanning
    // reason login uses email+password instead of magic links.
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }
    setStatus("done");
    setNewPassword("");
    setConfirmPassword("");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-4"
    >
      <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
        Change password
      </h3>
      <input
        type="password"
        required
        autoComplete="new-password"
        value={newPassword}
        onChange={(event) => setNewPassword(event.target.value)}
        placeholder="New password (min. 8 characters)"
        className="w-full rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 focus:border-neutral-500 dark:border-neutral-400 focus:outline-none"
      />
      <input
        type="password"
        required
        autoComplete="new-password"
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.target.value)}
        placeholder="Confirm new password"
        className="w-full rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 focus:border-neutral-500 dark:border-neutral-400 focus:outline-none"
      />
      <button
        type="submit"
        disabled={status === "sending"}
        className="rounded-md bg-neutral-900 dark:bg-neutral-100 px-4 py-2 text-sm font-medium text-white dark:text-neutral-900 transition-opacity disabled:opacity-50"
      >
        {status === "sending" ? "Updating…" : "Update password"}
      </button>
      {status === "error" && (
        <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
      )}
      {status === "done" && (
        <p className="text-sm text-green-600 dark:text-green-400">Password updated.</p>
      )}
    </form>
  );
}
