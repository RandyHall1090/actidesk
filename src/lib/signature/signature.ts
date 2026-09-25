import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteUrl } from "@/lib/env";
import { createPackageForRep } from "@/lib/packages/createPackageForRep";
import { getUsablePreset } from "@/lib/packages/defaultPreset";
import { captureSignatureImage } from "./screenshot";

// A rep's email-signature link: one generic package of their own, plus a
// screenshot of its desk stored in the public signature-images bucket.
// Service role throughout, so every read and write is scoped here to the
// rep's own row and their own package.

type Rep = { id: string; orgId: string };
type Result = { ok: true } | { ok: false; error: string };

export type Signature = {
  packageUrl: string;
  nameplate: string;
  imageUrl: string | null;
};

const BUCKET = "signature-images";

function imagePath(rep: Rep) {
  return `${rep.orgId}/${rep.id}.jpg`;
}

export async function getSignatureForRep(rep: Rep): Promise<Signature | null> {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("signature_package_id, signature_image_url")
    .eq("id", rep.id)
    .maybeSingle();
  if (!profile?.signature_package_id) return null;

  // profiles_update_own lets a rep write these columns directly, so only
  // trust a package that really is theirs.
  const { data: pkg } = await admin
    .from("packages")
    .select("slug, prospect_name")
    .eq("id", profile.signature_package_id)
    .eq("org_id", rep.orgId)
    .eq("created_by", rep.id)
    .maybeSingle();
  if (!pkg) return null;

  return {
    packageUrl: `${getSiteUrl()}/s/${pkg.slug}`,
    nameplate: pkg.prospect_name,
    imageUrl: profile.signature_image_url,
  };
}

async function captureAndStore(rep: Rep, packageUrl: string): Promise<Result> {
  let image;
  try {
    image = await captureSignatureImage(packageUrl);
  } catch (error) {
    console.error("Signature screenshot failed:", error);
    return { ok: false, error: "Couldn't take the picture of your desk. Try Refresh image in a minute." };
  }

  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(imagePath(rep), image.jpeg, { contentType: "image/jpeg", upsert: true, cacheControl: "300" });
  if (uploadError) {
    console.error("Signature upload failed:", uploadError);
    return { ok: false, error: "Couldn't save your signature image. Try again." };
  }

  // A new ?v= each time, so email clients and Outlook's editor don't keep
  // showing the old picture after a refresh.
  const { data } = admin.storage.from(BUCKET).getPublicUrl(imagePath(rep));
  const { error } = await admin
    .from("profiles")
    .update({ signature_image_url: `${data.publicUrl}?v=${Date.now()}` })
    .eq("id", rep.id);
  return error ? { ok: false, error: "Couldn't save your signature image. Try again." } : { ok: true };
}

export async function createSignatureForRep(
  rep: Rep,
  input: { presetId: string; nameplate: string },
): Promise<Result> {
  const nameplate = input.nameplate.trim() || "Our Next Client";
  const preset = await getUsablePreset(rep, input.presetId);
  if (!preset) return { ok: false, error: "Pick a template you can use." };

  const created = await createPackageForRep(rep, {
    prospectName: nameplate,
    letterBody: preset.letterBody,
    slots: preset.slots,
  });
  if (!created.ok) return created;

  const { data: pkg } = await createAdminClient()
    .from("packages")
    .select("id")
    .eq("slug", created.slug)
    .single();
  const { error } = await createAdminClient()
    .from("profiles")
    .update({ signature_package_id: pkg?.id ?? null, signature_image_url: null })
    .eq("id", rep.id);
  if (error || !pkg) return { ok: false, error: "Couldn't save your signature. Try again." };

  return captureAndStore(rep, created.url);
}

export async function refreshSignatureImage(rep: Rep): Promise<Result> {
  const signature = await getSignatureForRep(rep);
  if (!signature) return { ok: false, error: "You don't have a signature yet." };
  return captureAndStore(rep, signature.packageUrl);
}

/** Unlinks the signature and deletes its image. The package itself stays,
 * so links in emails already sent keep working. */
export async function removeSignatureForRep(rep: Rep): Promise<Result> {
  const admin = createAdminClient();
  await admin.storage.from(BUCKET).remove([imagePath(rep)]);
  const { error } = await admin
    .from("profiles")
    .update({ signature_package_id: null, signature_image_url: null })
    .eq("id", rep.id);
  return error ? { ok: false, error: "Couldn't remove your signature. Try again." } : { ok: true };
}
