"use client";

import { useMemo, useState, useTransition } from "react";
import { OneTimePasswordBanner } from "@/components/OneTimePasswordBanner";
import { SECURAFY_ORG_ID } from "@/lib/hubspot";
import {
  adminAddUser,
  adminResetUserPassword,
  adminSetUserActive,
  adminSetProfileRole,
  adminSetPlatformAdmin,
} from "./actions";

export type AdminOrg = { id: string; name: string };
export type AdminProfile = {
  id: string;
  org_id: string;
  email: string | null;
  role: "rep" | "admin";
  full_name: string | null;
  is_active: boolean;
  is_platform_admin: boolean;
  created_at: string;
};

function OrgSection({
  org,
  profiles,
  isPending,
  onAdd,
  onReset,
  onToggleActive,
  onToggleRole,
  onTogglePlatformAdmin,
}: {
  org: AdminOrg;
  profiles: AdminProfile[];
  isPending: boolean;
  onAdd: (orgId: string, email: string, role: "rep" | "admin") => void;
  onReset: (email: string, userId: string) => void;
  onToggleActive: (userId: string, active: boolean) => void;
  onToggleRole: (profileId: string, role: "rep" | "admin") => void;
  onTogglePlatformAdmin: (profileId: string, value: boolean) => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"rep" | "admin">("rep");
  const isSecurafy = org.id === SECURAFY_ORG_ID;

  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-4">
      <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
        {org.name}
        {isSecurafy && (
          <span className="ml-2 rounded bg-neutral-900 dark:bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white dark:text-neutral-900">
            Platform operator
          </span>
        )}
      </h3>

      <div className="mt-3 flex flex-wrap gap-2">
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="email@company.com"
          className="min-w-0 flex-1 rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 focus:border-neutral-500 dark:border-neutral-400 focus:outline-none"
        />
        <select
          value={role}
          onChange={(event) => setRole(event.target.value as "rep" | "admin")}
          className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-2 py-2 text-sm text-neutral-900 dark:text-neutral-100"
        >
          <option value="rep">Rep</option>
          <option value="admin">Admin</option>
        </select>
        <button
          type="button"
          disabled={isPending || !email}
          onClick={() => {
            onAdd(org.id, email, role);
            setEmail("");
          }}
          className="rounded-md bg-neutral-900 dark:bg-neutral-100 px-4 py-2 text-sm font-medium text-white dark:text-neutral-900 transition-opacity disabled:opacity-50"
        >
          Add
        </button>
      </div>

      <ul className="mt-3 divide-y divide-neutral-200 dark:divide-neutral-700">
        {profiles.map((p) => (
          <li
            key={p.id}
            className="flex flex-wrap items-center justify-between gap-3 py-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                {p.email}
                {!p.is_active && (
                  <span className="ml-2 rounded bg-neutral-200 dark:bg-neutral-700 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-neutral-600 dark:text-neutral-400">
                    Deactivated
                  </span>
                )}
                {p.is_platform_admin && (
                  <span className="ml-2 rounded bg-amber-200 dark:bg-amber-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-900 dark:text-amber-200">
                    Platform admin
                  </span>
                )}
              </p>
              {p.full_name && (
                <p className="text-xs text-neutral-500 dark:text-neutral-400">{p.full_name}</p>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={() =>
                  onToggleRole(p.id, p.role === "admin" ? "rep" : "admin")
                }
                className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-3 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:border-neutral-400 dark:hover:border-neutral-500 disabled:opacity-50"
              >
                {p.role === "admin" ? "Admin — make rep" : "Rep — make admin"}
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => onReset(p.email ?? "", p.id)}
                className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-3 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:border-neutral-400 dark:hover:border-neutral-500 disabled:opacity-50"
              >
                Reset password
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => onToggleActive(p.id, !p.is_active)}
                className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-3 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:border-neutral-400 dark:hover:border-neutral-500 disabled:opacity-50"
              >
                {p.is_active ? "Deactivate" : "Reactivate"}
              </button>
              {isSecurafy && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() =>
                    onTogglePlatformAdmin(p.id, !p.is_platform_admin)
                  }
                  className="rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950 px-3 py-1.5 text-xs font-medium text-amber-900 dark:text-amber-200 hover:border-amber-400 dark:hover:border-amber-600 disabled:opacity-50"
                >
                  {p.is_platform_admin
                    ? "Revoke platform admin"
                    : "Grant platform admin"}
                </button>
              )}
            </div>
          </li>
        ))}
        {profiles.length === 0 && (
          <p className="py-2 text-sm text-neutral-400 dark:text-neutral-500">No users yet.</p>
        )}
      </ul>
    </div>
  );
}

export function AdminClient({
  orgs,
  profiles,
}: {
  orgs: AdminOrg[];
  profiles: AdminProfile[];
}) {
  const [isPending, startTransition] = useTransition();
  const [revealed, setRevealed] = useState<{
    email: string;
    password: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const profilesByOrg = useMemo(() => {
    const map = new Map<string, AdminProfile[]>();
    for (const p of profiles) {
      const list = map.get(p.org_id) ?? [];
      list.push(p);
      map.set(p.org_id, list);
    }
    return map;
  }, [profiles]);

  function handleAdd(orgId: string, email: string, role: "rep" | "admin") {
    setError(null);
    startTransition(async () => {
      const result = await adminAddUser(orgId, email, role);
      if (result.ok) setRevealed({ email, password: result.password! });
      else setError(result.error);
    });
  }

  function handleReset(email: string, userId: string) {
    setError(null);
    startTransition(async () => {
      const result = await adminResetUserPassword(userId);
      if (result.ok) setRevealed({ email, password: result.password! });
      else setError(result.error);
    });
  }

  function handleToggleActive(userId: string, active: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await adminSetUserActive(userId, active);
      if (!result.ok) setError(result.error);
    });
  }

  function handleToggleRole(profileId: string, role: "rep" | "admin") {
    setError(null);
    startTransition(async () => {
      const result = await adminSetProfileRole(profileId, role);
      if (!result.ok) setError(result.error);
    });
  }

  function handleTogglePlatformAdmin(profileId: string, value: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await adminSetPlatformAdmin(profileId, value);
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
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {orgs.map((org) => (
        <OrgSection
          key={org.id}
          org={org}
          profiles={profilesByOrg.get(org.id) ?? []}
          isPending={isPending}
          onAdd={handleAdd}
          onReset={handleReset}
          onToggleActive={handleToggleActive}
          onToggleRole={handleToggleRole}
          onTogglePlatformAdmin={handleTogglePlatformAdmin}
        />
      ))}
    </div>
  );
}
