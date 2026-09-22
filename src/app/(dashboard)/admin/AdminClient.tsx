"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { OneTimePasswordBanner } from "@/components/OneTimePasswordBanner";
import { SECURAFY_ORG_ID } from "@/lib/hubspot";
import type { ContentDisposition } from "@/lib/user-management";
import {
  adminCreateOrg,
  adminAddUser,
  adminResetUserPassword,
  adminSetUserActive,
  adminSetProfileRole,
  adminSetPlatformAdmin,
  adminDeleteUser,
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
export type ContentCounts = {
  packages: number;
  assets: number;
  layouts: number;
  presets: number;
};

function CreateOrgForm({
  isPending,
  onCreate,
}: {
  isPending: boolean;
  onCreate: (companyName: string, adminEmail: string, billingExempt: boolean) => void;
}) {
  const [companyName, setCompanyName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [billingExempt, setBillingExempt] = useState(false);

  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-4">
      <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
        Create new tenant
      </h3>
      <div className="mt-3 flex flex-wrap gap-2">
        <input
          type="text"
          value={companyName}
          onChange={(event) => setCompanyName(event.target.value)}
          placeholder="Company name"
          className="min-w-0 flex-1 rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 focus:border-neutral-500 dark:border-neutral-400 focus:outline-none"
        />
        <input
          type="email"
          value={adminEmail}
          onChange={(event) => setAdminEmail(event.target.value)}
          placeholder="admin@company.com"
          className="min-w-0 flex-1 rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 focus:border-neutral-500 dark:border-neutral-400 focus:outline-none"
        />
        <button
          type="button"
          disabled={isPending || !companyName || !adminEmail}
          onClick={() => {
            onCreate(companyName, adminEmail, billingExempt);
            setCompanyName("");
            setAdminEmail("");
            setBillingExempt(false);
          }}
          className="rounded-md bg-neutral-900 dark:bg-neutral-100 px-4 py-2 text-sm font-medium text-white dark:text-neutral-900 transition-opacity disabled:opacity-50"
        >
          Create
        </button>
      </div>
      <label className="mt-2 flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
        <input
          type="checkbox"
          checked={billingExempt}
          onChange={(event) => setBillingExempt(event.target.checked)}
        />
        Mark as billing-exempt (internal/demo tenant)
      </label>
    </div>
  );
}

/**
 * Confirms a permanent user delete and, if they created anything that
 * would otherwise cascade-delete with them (packages/sites, assets,
 * layouts, presets -- see user-management.ts), asks what should happen
 * to it: transfer to another active user in their own org, or delete it
 * along with the account. counts/otherOrgUsers are both already loaded
 * (AdminPage computes counts up front; otherOrgUsers comes straight from
 * the profiles this client already has), so opening this needs no
 * extra round trip.
 */
function DeleteUserDialog({
  profile,
  counts,
  otherOrgUsers,
  isPending,
  onConfirm,
  onCancel,
}: {
  profile: AdminProfile;
  counts: ContentCounts;
  otherOrgUsers: AdminProfile[];
  isPending: boolean;
  onConfirm: (disposition: ContentDisposition) => void;
  onCancel: () => void;
}) {
  const total = counts.packages + counts.assets + counts.layouts + counts.presets;
  const canTransfer = otherOrgUsers.length > 0;
  const [mode, setMode] = useState<"delete" | "transfer">(
    total > 0 && canTransfer ? "transfer" : "delete",
  );
  const [targetUserId, setTargetUserId] = useState(otherOrgUsers[0]?.id ?? "");

  const canConfirm = mode === "delete" || (mode === "transfer" && !!targetUserId);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Delete ${profile.email}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-md rounded-lg bg-white dark:bg-neutral-900 p-5 shadow-xl">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          Delete {profile.email}?
        </h3>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          This permanently deletes their account. They won&apos;t be able to sign in again.
        </p>

        {total > 0 ? (
          <>
            <p className="mt-3 text-xs text-neutral-600 dark:text-neutral-400">
              They created {counts.packages} package{counts.packages === 1 ? "" : "s"},{" "}
              {counts.assets} asset{counts.assets === 1 ? "" : "s"}, {counts.layouts} layout
              {counts.layouts === 1 ? "" : "s"}, and {counts.presets} preset
              {counts.presets === 1 ? "" : "s"}. Choose what happens to it:
            </p>
            <div className="mt-3 space-y-2">
              <label className="flex flex-wrap items-center gap-2 text-sm text-neutral-800 dark:text-neutral-200">
                <input
                  type="radio"
                  name="disposition"
                  checked={mode === "transfer"}
                  disabled={!canTransfer}
                  onChange={() => setMode("transfer")}
                />
                Transfer everything to
                <select
                  value={targetUserId}
                  disabled={mode !== "transfer" || !canTransfer}
                  onChange={(event) => setTargetUserId(event.target.value)}
                  className="min-w-0 flex-1 rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-2 py-1 text-sm text-neutral-900 dark:text-neutral-100 disabled:opacity-50"
                >
                  {otherOrgUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.email}
                    </option>
                  ))}
                </select>
              </label>
              {!canTransfer && (
                <p className="text-xs text-neutral-400 dark:text-neutral-500">
                  No other active user in this organization to transfer to.
                </p>
              )}
              <label className="flex items-center gap-2 text-sm text-neutral-800 dark:text-neutral-200">
                <input
                  type="radio"
                  name="disposition"
                  checked={mode === "delete"}
                  onChange={() => setMode("delete")}
                />
                Delete everything they created
              </label>
            </div>
          </>
        ) : (
          <p className="mt-3 text-xs text-neutral-600 dark:text-neutral-400">
            They haven&apos;t created any packages, assets, layouts, or presets.
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="rounded-md border border-neutral-300 dark:border-neutral-600 px-3 py-1.5 text-sm font-medium text-neutral-700 dark:text-neutral-300 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isPending || !canConfirm}
            onClick={() =>
              onConfirm(
                mode === "transfer" ? { mode: "transfer", targetUserId } : { mode: "delete" },
              )
            }
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-opacity disabled:opacity-50"
          >
            {isPending ? "Deleting…" : "Delete user"}
          </button>
        </div>
      </div>
    </div>
  );
}

function OrgSection({
  org,
  profiles,
  currentUserId,
  isPending,
  onAdd,
  onReset,
  onToggleActive,
  onToggleRole,
  onTogglePlatformAdmin,
  onDelete,
}: {
  org: AdminOrg;
  profiles: AdminProfile[];
  currentUserId: string;
  isPending: boolean;
  onAdd: (orgId: string, email: string, role: "rep" | "admin") => void;
  onReset: (email: string, userId: string) => void;
  onToggleActive: (userId: string, active: boolean) => void;
  onToggleRole: (profileId: string, role: "rep" | "admin") => void;
  onTogglePlatformAdmin: (profileId: string, value: boolean) => void;
  onDelete: (profile: AdminProfile) => void;
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
              {p.id !== currentUserId && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => onDelete(p)}
                  className="rounded-md border border-red-300 dark:border-red-800 bg-white dark:bg-neutral-900 px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-400 hover:border-red-400 dark:hover:border-red-600 disabled:opacity-50"
                >
                  Delete
                </button>
              )}
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
  contentCounts,
  currentUserId,
}: {
  orgs: AdminOrg[];
  profiles: AdminProfile[];
  contentCounts: Record<string, ContentCounts>;
  currentUserId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [revealed, setRevealed] = useState<{
    email: string;
    password: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminProfile | null>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);

  // Every action here (reset password, toggle active, etc.) can be
  // triggered from a row far down the page -- with 6+ orgs now on this
  // page, Securafy's own section (where the platform's own team lives)
  // sorts last alphabetically, so its buttons sit well below the fold.
  // The result (this banner, or an error) renders at the top of the
  // page; without scrolling it into view, clicking a button down there
  // looks exactly like it did nothing.
  useEffect(() => {
    if (revealed || error) {
      feedbackRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [revealed, error]);

  const profilesByOrg = useMemo(() => {
    const map = new Map<string, AdminProfile[]>();
    for (const p of profiles) {
      const list = map.get(p.org_id) ?? [];
      list.push(p);
      map.set(p.org_id, list);
    }
    return map;
  }, [profiles]);

  function handleCreateOrg(companyName: string, adminEmail: string, billingExempt: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await adminCreateOrg(companyName, adminEmail, billingExempt);
      if (result.ok) setRevealed({ email: adminEmail, password: result.password! });
      else setError(result.error);
    });
  }

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

  function handleConfirmDelete(disposition: ContentDisposition) {
    if (!deleteTarget) return;
    setError(null);
    startTransition(async () => {
      const result = await adminDeleteUser(deleteTarget.id, disposition);
      if (result.ok) setDeleteTarget(null);
      else setError(result.error);
    });
  }

  return (
    <div className="space-y-6">
      <div ref={feedbackRef}>
        {revealed && (
          <OneTimePasswordBanner
            email={revealed.email}
            password={revealed.password}
            onDismiss={() => setRevealed(null)}
          />
        )}
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>

      <CreateOrgForm isPending={isPending} onCreate={handleCreateOrg} />

      {orgs.map((org) => (
        <OrgSection
          key={org.id}
          org={org}
          profiles={profilesByOrg.get(org.id) ?? []}
          currentUserId={currentUserId}
          isPending={isPending}
          onAdd={handleAdd}
          onReset={handleReset}
          onToggleActive={handleToggleActive}
          onToggleRole={handleToggleRole}
          onTogglePlatformAdmin={handleTogglePlatformAdmin}
          onDelete={setDeleteTarget}
        />
      ))}

      {deleteTarget && (
        <DeleteUserDialog
          profile={deleteTarget}
          counts={
            contentCounts[deleteTarget.id] ?? {
              packages: 0,
              assets: 0,
              layouts: 0,
              presets: 0,
            }
          }
          otherOrgUsers={(profilesByOrg.get(deleteTarget.org_id) ?? []).filter(
            (p) => p.id !== deleteTarget.id && p.is_active,
          )}
          isPending={isPending}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
