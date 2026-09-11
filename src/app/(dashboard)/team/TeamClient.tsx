"use client";

import { useState, useTransition } from "react";
import { OneTimePasswordBanner } from "@/components/OneTimePasswordBanner";
import {
  setProfileRole,
  addTeamMember,
  resetTeamMemberPassword,
  setTeamMemberActive,
} from "./actions";

export type TeamProfile = {
  id: string;
  email: string | null;
  role: "rep" | "admin";
  full_name: string | null;
  is_active: boolean;
};

export function TeamClient({
  profiles,
  signupUrl,
}: {
  profiles: TeamProfile[];
  signupUrl: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [revealed, setRevealed] = useState<{
    email: string;
    password: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState<"rep" | "admin">("rep");

  function handleAdd() {
    setError(null);
    const email = addEmail;
    startTransition(async () => {
      const result = await addTeamMember(email, addRole);
      if (result.ok) {
        setRevealed({ email, password: result.password! });
        setAddEmail("");
      } else {
        setError(result.error);
      }
    });
  }

  function handleReset(email: string, userId: string) {
    setError(null);
    startTransition(async () => {
      const result = await resetTeamMemberPassword(userId);
      if (result.ok) setRevealed({ email, password: result.password! });
      else setError(result.error);
    });
  }

  function handleToggleActive(userId: string, active: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await setTeamMemberActive(userId, active);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="space-y-6">
      {revealed && (
        <OneTimePasswordBanner
          email={revealed.email}
          password={revealed.password}
          onDismiss={() => setRevealed(null)}
        />
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <h3 className="mb-2 text-sm font-semibold text-neutral-700">
          Add a teammate
        </h3>
        <div className="flex flex-wrap gap-2">
          <input
            type="email"
            value={addEmail}
            onChange={(event) => setAddEmail(event.target.value)}
            placeholder="email@company.com"
            className="min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none"
          />
          <select
            value={addRole}
            onChange={(event) =>
              setAddRole(event.target.value as "rep" | "admin")
            }
            className="rounded-md border border-neutral-300 bg-white px-2 py-2 text-sm text-neutral-900"
          >
            <option value="rep">Rep</option>
            <option value="admin">Admin</option>
          </select>
          <button
            type="button"
            onClick={handleAdd}
            disabled={isPending || !addEmail}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-50"
          >
            {isPending ? "Adding…" : "Add"}
          </button>
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          This generates a temporary password for you to relay directly — no
          email needed. Or share this link so they create their own account
          (matching email domains automatically join this organization):
        </p>
        <code className="mt-1 block rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-700">
          {signupUrl}
        </code>
      </div>

      <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
        {profiles.map((p) => (
          <li
            key={p.id}
            className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-neutral-900">
                {p.email}
                {!p.is_active && (
                  <span className="ml-2 rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-neutral-600">
                    Deactivated
                  </span>
                )}
              </p>
              {p.full_name && (
                <p className="text-xs text-neutral-500">{p.full_name}</p>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <form
                action={setProfileRole.bind(
                  null,
                  p.id,
                  p.role === "admin" ? "rep" : "admin",
                )}
              >
                <button
                  type="submit"
                  className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:border-neutral-400"
                >
                  {p.role === "admin" ? "Admin — make rep" : "Rep — make admin"}
                </button>
              </form>
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleReset(p.email ?? "", p.id)}
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:border-neutral-400 disabled:opacity-50"
              >
                Reset password
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleToggleActive(p.id, !p.is_active)}
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:border-neutral-400 disabled:opacity-50"
              >
                {p.is_active ? "Deactivate" : "Reactivate"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
