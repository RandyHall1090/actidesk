import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/profile";
import { getOutlookConnection } from "@/lib/integrations/outlook/graph";
import { getDefaultPresetForRep } from "@/lib/packages/defaultPreset";
import { ListMergeClient } from "./ListMergeClient";

export default async function ListMergePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const connection = await getOutlookConnection(profile.id);
  if (!connection) {
    return (
      <div className="max-w-2xl">
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
          List Merge (Outlook)
        </h2>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          List Merge uses your own Outlook contacts and sends from your own mailbox, so connect
          your Outlook first.
        </p>
        <Link
          href="/account"
          className="mt-4 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Connect Outlook on your Account page
        </Link>
      </div>
    );
  }

  const defaultPreset = await getDefaultPresetForRep({ id: profile.id, orgId: profile.org_id });
  return (
    <ListMergeClient
      templateId="desk-v1"
      sendingAs={connection.mailboxEmail}
      defaultTemplateName={defaultPreset?.name ?? null}
    />
  );
}
