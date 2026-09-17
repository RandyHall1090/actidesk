import { createClient } from "@/lib/supabase/server";

export type Org = {
  id: string;
  name: string;
  subscription_status: string;
  trial_ends_at: string;
  billing_exempt: boolean;
};

export async function getOrg(orgId: string): Promise<Org | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orgs")
    .select("id, name, subscription_status, trial_ends_at, billing_exempt")
    .eq("id", orgId)
    .single();
  return data;
}
