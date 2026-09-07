import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import type { Asset } from "@/lib/assets/types";
import { NewPackageForm } from "./NewPackageForm";

export default async function NewPackagePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const { data: assets, error } = await supabase
    .from("assets")
    .select(
      "id, org_id, owner_id, scope, kind, name, storage_path, external_url, file_size_bytes, created_at",
    )
    .order("name");

  if (error) {
    return (
      <p className="text-sm text-red-600">
        Couldn&apos;t load your assets: {error.message}
      </p>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-neutral-900">New Package</h2>
      <p className="mt-1 mb-6 text-sm text-neutral-600">
        Pick assets for this prospect, then send them the link yourself once
        it&apos;s created.
      </p>
      <NewPackageForm assets={(assets ?? []) as Asset[]} />
    </div>
  );
}
