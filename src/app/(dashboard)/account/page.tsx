import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/profile";
import { getOutlookConnection } from "@/lib/integrations/outlook/graph";
import { ChangePasswordForm } from "./ChangePasswordForm";
import { CalendarLinkForm } from "./CalendarLinkForm";
import { OutlookConnectionCard } from "./OutlookConnectionCard";

export default async function AccountPage({ searchParams }: PageProps<"/account">) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const [{ outlook }, connection] = await Promise.all([
    searchParams,
    getOutlookConnection(profile.id),
  ]);

  return (
    <div className="max-w-sm">
      <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Account</h2>
      <p className="mt-1 mb-6 text-sm text-neutral-600 dark:text-neutral-400">{profile.email}</p>
      <OutlookConnectionCard
        connection={connection}
        outcome={typeof outlook === "string" ? outlook : null}
      />
      <ChangePasswordForm />
      <CalendarLinkForm initialUrl={profile.calendar_url} />
    </div>
  );
}
