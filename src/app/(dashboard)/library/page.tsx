import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import type { Asset } from "@/lib/assets/types";
import { LibraryClient } from "./LibraryClient";

export default async function LibraryPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const { data: assets, error } = await supabase
    .from("assets")
    .select(
      "id, org_id, owner_id, scope, kind, name, storage_path, external_url, file_size_bytes, created_at",
    )
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <p className="text-sm text-red-600">
        Couldn&apos;t load the asset library: {error.message}
      </p>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-neutral-900">
        Asset Library
      </h2>
      <p className="mt-1 mb-6 text-sm text-neutral-600">
        Video and audio are Vimeo links. Images, documents, business cards,
        and your logo are uploaded here.
      </p>
      <LibraryClient
        assets={(assets ?? []) as Asset[]}
        currentUserId={profile.id}
        isAdmin={profile.role === "admin"}
      />
    </div>
  );
}
