import type { AssetScope } from "./types";

/**
 * Builds the Storage object path for an uploaded asset. The shape
 * ({org_id}/{scope}/{owner_id}/...) matches what the `assets_storage_*`
 * RLS policies (supabase/migrations/0003_assets_storage_bucket.sql)
 * expect — changing this without updating those policies will break
 * uploads or deletes.
 */
export function buildAssetStoragePath(params: {
  orgId: string;
  scope: AssetScope;
  ownerId: string;
  fileName: string;
}): string {
  const { orgId, scope, ownerId, fileName } = params;
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${orgId}/${scope}/${ownerId}/${crypto.randomUUID()}-${safeName}`;
}
