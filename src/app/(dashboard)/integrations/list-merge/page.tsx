import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/profile";
import { ListMergeClient } from "./ListMergeClient";

export default async function ListMergePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  return <ListMergeClient templateId="desk-v1" />;
}
