import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/profile";
import { LayoutDesignerClient } from "./LayoutDesignerClient";

export default async function LayoutDesignerPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!profile.is_platform_admin) {
    return (
      <p className="text-sm text-neutral-600">
        Only Securafy platform admins can access this page.
      </p>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-neutral-900">
        Layout Designer
      </h2>
      <p className="mt-1 mb-6 text-sm text-neutral-600">
        Drag content onto a desk background to work out positions visually,
        then copy the generated code and paste it into{" "}
        <code>layouts.ts</code> for a developer to deploy — this tool
        doesn&apos;t save anything on its own.
      </p>
      <LayoutDesignerClient />
    </div>
  );
}
