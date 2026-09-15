import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/profile";
import { getOrgLayouts } from "@/lib/packages/getOrgLayouts";
import { LayoutDesignerClient } from "./LayoutDesignerClient";

export default async function LayoutDesignerPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") {
    return (
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Only admins can manage desk layouts.
      </p>
    );
  }

  const layouts = await getOrgLayouts(profile.org_id);

  return (
    <div>
      <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
        Layout Designer
      </h2>
      <p className="mt-1 mb-6 text-sm text-neutral-600 dark:text-neutral-400">
        Drag content onto a desk background to work out positions visually,
        then click <strong>Save</strong> to make it selectable for your own
        organization&apos;s packages right away — no developer needed.
      </p>
      <LayoutDesignerClient orgId={profile.org_id} layouts={layouts} />
    </div>
  );
}
