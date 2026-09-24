import type { Metadata } from "next";
import { addinApiScope } from "@/lib/integrations/outlook/addinAuth";
import { TaskpaneApp } from "./TaskpaneApp";

export const metadata: Metadata = {
  title: "ActiDesk for Outlook",
  robots: { index: false, follow: false },
};

// The client ID isn't a secret (it's in every Microsoft sign-in URL); it's
// read server-side so the taskpane needs no extra NEXT_PUBLIC_ variable.
export default function TaskpanePage() {
  const clientId = process.env.OUTLOOK_CLIENT_ID ?? "";
  return <TaskpaneApp clientId={clientId} apiScope={clientId ? addinApiScope(clientId) : ""} />;
}
