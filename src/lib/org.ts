import { createClient } from "@/lib/supabase/server";

export type Org = {
  id: string;
  name: string;
};

export async function getOrg(orgId: string): Promise<Org | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orgs")
    .select("id, name")
    .eq("id", orgId)
    .single();
  return data;
}
