export type AssetKind =
  | "video"
  | "audio"
  | "image"
  | "document"
  | "business_card"
  | "logo";

export type AssetScope = "personal" | "company";

export type Asset = {
  id: string;
  org_id: string;
  owner_id: string;
  scope: AssetScope;
  kind: AssetKind;
  name: string;
  storage_path: string | null;
  external_url: string | null;
  file_size_bytes: number | null;
  created_at: string;
};

// Video/audio are Vimeo links (external_url); everything else is an
// uploaded file living in Supabase Storage (storage_path).
export const ASSET_KINDS: { value: AssetKind; label: string }[] = [
  { value: "video", label: "Video" },
  { value: "audio", label: "Audio" },
  { value: "image", label: "Images" },
  { value: "document", label: "Documents" },
  { value: "business_card", label: "Business Cards" },
  { value: "logo", label: "Logo" },
];

export function isLinkKind(kind: AssetKind): boolean {
  return kind === "video" || kind === "audio";
}
