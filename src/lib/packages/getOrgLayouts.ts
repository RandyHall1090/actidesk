import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DESK_LAYOUTS, getLayout, type DeskLayout, type SlotPosition } from "./layouts";

// Server-only (imports next/headers transitively via lib/supabase/server) --
// never import this from a "use client" file. layouts.ts stays plain
// data/types so client components (NewPackageForm.tsx, TemplatesClient.tsx)
// can keep importing DESK_LAYOUTS/DeskLayout directly.

type LayoutRow = {
  id: string;
  label: string;
  background_image: string;
  aspect_ratio: string;
  nameplate: SlotPosition;
  slots: DeskLayout["slots"];
  letter: SlotPosition | null;
  brochures: SlotPosition[] | null;
};

function rowToLayout(row: LayoutRow): DeskLayout {
  return {
    id: row.id,
    label: row.label,
    backgroundImage: row.background_image,
    aspectRatio: row.aspect_ratio,
    nameplate: row.nameplate,
    slots: row.slots,
    letter: row.letter ?? undefined,
    brochures: row.brochures ?? undefined,
  };
}

/**
 * Every layout selectable by this org: the built-in, Securafy-authored ones
 * (DESK_LAYOUTS, shared by every tenant) plus this org's own saved custom
 * ones (T15 -- the "layouts" table, RLS-scoped to org members for read,
 * that org's own admin for write). Called from Server Components/Actions
 * only; the caller passes the resulting array down as a prop to whatever
 * client component needs to render or pick from it.
 */
export async function getOrgLayouts(orgId: string): Promise<DeskLayout[]> {
  // Service role with an explicit org filter -- the same rows layouts'
  // org-member RLS returns -- so this also works from the Outlook add-in's
  // API routes, which have no Supabase session. orgId is always a
  // server-verified profile's org, never client input.
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("layouts")
    .select(
      "id, label, background_image, aspect_ratio, nameplate, slots, letter, brochures",
    )
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  const custom = ((data ?? []) as LayoutRow[]).map(rowToLayout);
  return [...DESK_LAYOUTS, ...custom];
}

/**
 * Resolves a single layout for the public /s/[slug] page, which is
 * unauthenticated and must not be able to enumerate an org's other custom
 * layouts -- only ever look up the exact one a package's template_id
 * already points to. Checks the built-in array first (no DB round trip for
 * the common case), then falls back to the get_layout_by_id RPC (SECURITY
 * DEFINER, callable by anon -- see migration 0015) for a custom one.
 */
export async function getLayoutForPublicPage(
  templateId: string,
): Promise<DeskLayout> {
  const builtIn = DESK_LAYOUTS.find((l) => l.id === templateId);
  if (builtIn) return builtIn;

  const supabase = await createClient();
  const { data } = await supabase
    .rpc("get_layout_by_id", { p_id: templateId })
    .maybeSingle();

  if (data) return rowToLayout(data as LayoutRow);

  // Deleted custom layout, or a stray id -- fall back rather than crash the
  // public page a prospect is actually looking at.
  return getLayout(undefined);
}
