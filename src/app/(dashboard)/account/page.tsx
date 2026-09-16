import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/profile";
import { ChangePasswordForm } from "./ChangePasswordForm";
import { CalendarLinkForm } from "./CalendarLinkForm";

export default async function AccountPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  return (
    <div className="max-w-sm">
      <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Account</h2>
      <p className="mt-1 mb-6 text-sm text-neutral-600 dark:text-neutral-400">{profile.email}</p>
      <ChangePasswordForm />
      <CalendarLinkForm initialUrl={profile.calendar_url} />
    </div>
  );
}
