import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/profile";
import { getOutlookConnection } from "@/lib/integrations/outlook/graph";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDefaultPresetId } from "@/lib/packages/defaultPreset";
import { getSignatureForRep } from "@/lib/signature/signature";
import { ChangePasswordForm } from "./ChangePasswordForm";
import { CalendarLinkForm } from "./CalendarLinkForm";
import { OutlookConnectionCard } from "./OutlookConnectionCard";
import { SignatureCard } from "./SignatureCard";

// Creating or refreshing a signature screenshots the desk in a headless
// browser, which can take well past the default action timeout.
export const maxDuration = 60;

export default async function AccountPage({ searchParams }: PageProps<"/account">) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  const rep = { id: profile.id, orgId: profile.org_id };

  const [{ outlook }, connection, signature, defaultPresetId, { data: presets }] = await Promise.all([
    searchParams,
    getOutlookConnection(profile.id),
    getSignatureForRep(rep),
    getDefaultPresetId(profile.id),
    // Service role, so restate presets_select_org: company-shared plus the rep's own.
    createAdminClient()
      .from("presets")
      .select("id, name")
      .eq("org_id", profile.org_id)
      .or(`scope.eq.company,created_by.eq.${profile.id}`)
      .order("name"),
  ]);
  const presetList = presets ?? [];

  return (
    <div className="max-w-sm">
      <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Account</h2>
      <p className="mt-1 mb-6 text-sm text-neutral-600 dark:text-neutral-400">{profile.email}</p>
      <OutlookConnectionCard
        connection={connection}
        outcome={typeof outlook === "string" ? outlook : null}
      />
      <SignatureCard
        signature={signature}
        presets={presetList}
        defaultPresetId={presetList.some((p) => p.id === defaultPresetId) ? defaultPresetId : null}
      />
      <ChangePasswordForm />
      <CalendarLinkForm initialUrl={profile.calendar_url} />
    </div>
  );
}
