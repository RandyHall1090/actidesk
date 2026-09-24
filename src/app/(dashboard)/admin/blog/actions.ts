"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolvePublishedAt, type PostStatus } from "@/lib/blog";
import { sendReviewEmail } from "./notify";

const VALID_STATUSES: PostStatus[] = ["draft", "pending_review", "published", "rejected"];

async function requirePlatformAdmin() {
  const profile = await getCurrentProfile();
  if (!profile?.is_platform_admin) {
    throw new Error("Only Securafy platform admins can manage the blog.");
  }
  return profile;
}

function str(formData: FormData, key: string): string {
  return (formData.get(key) as string | null)?.trim() ?? "";
}

function optionalStr(formData: FormData, key: string): string | null {
  const value = str(formData, key);
  return value === "" ? null : value;
}

function statusFromField(formData: FormData): PostStatus {
  const value = str(formData, "status");
  return (VALID_STATUSES as string[]).includes(value) ? (value as PostStatus) : "draft";
}

export async function createPost(formData: FormData) {
  await requirePlatformAdmin();
  const supabase = createAdminClient();

  const authorId = str(formData, "author_id");
  const status = statusFromField(formData);
  const publishedAt =
    status === "published"
      ? await resolvePublishedAt(supabase, authorId, optionalStr(formData, "scheduled_publish_date"))
      : null;

  const { data: created, error } = await supabase
    .from("blog_posts")
    .insert({
      slug: str(formData, "slug"),
      title: str(formData, "title"),
      seo_title: optionalStr(formData, "seo_title"),
      excerpt: str(formData, "excerpt"),
      meta_description: optionalStr(formData, "meta_description"),
      image_alt_text: optionalStr(formData, "image_alt_text"),
      content: str(formData, "content"),
      cover_image_url: optionalStr(formData, "cover_image_url"),
      author_id: authorId,
      status,
      published_at: publishedAt,
    })
    .select("id, status")
    .single();
  if (error) throw new Error(`Failed to create post: ${error.message}`);

  if (created.status === "pending_review") {
    await sendReviewEmail(supabase, created.id);
  }

  revalidatePath("/admin/blog");
  revalidatePath("/blog");
  redirect("/admin/blog");
}

export async function updatePost(formData: FormData) {
  await requirePlatformAdmin();
  const supabase = createAdminClient();
  const id = str(formData, "id");
  const status = statusFromField(formData);
  const authorId = str(formData, "author_id");

  const { data: existing } = await supabase
    .from("blog_posts")
    .select("status, published_at")
    .eq("id", id)
    .maybeSingle();
  if (!existing) throw new Error("Post not found.");

  const isNewlyPublished = status === "published" && existing.status !== "published";
  const publishedAt = isNewlyPublished
    ? await resolvePublishedAt(supabase, authorId, optionalStr(formData, "scheduled_publish_date"))
    : existing.published_at;

  const { error } = await supabase
    .from("blog_posts")
    .update({
      title: str(formData, "title"),
      seo_title: optionalStr(formData, "seo_title"),
      excerpt: str(formData, "excerpt"),
      meta_description: optionalStr(formData, "meta_description"),
      image_alt_text: optionalStr(formData, "image_alt_text"),
      content: str(formData, "content"),
      cover_image_url: optionalStr(formData, "cover_image_url"),
      author_id: authorId,
      status,
      published_at: publishedAt,
    })
    .eq("id", id);
  if (error) throw new Error(`Failed to update post: ${error.message}`);

  if (status === "pending_review" && existing.status !== "pending_review") {
    await sendReviewEmail(supabase, id);
  }

  revalidatePath("/admin/blog");
  revalidatePath(`/admin/blog/${id}`);
  revalidatePath("/blog");
  redirect("/admin/blog");
}

export async function deletePost(formData: FormData) {
  await requirePlatformAdmin();
  const supabase = createAdminClient();
  const id = str(formData, "id");
  const { error } = await supabase.from("blog_posts").delete().eq("id", id);
  if (error) throw new Error(`Failed to delete post: ${error.message}`);
  revalidatePath("/admin/blog");
  revalidatePath("/blog");
}

/** Only the post's own author may approve or reject it -- platform-admin
 * alone is not enough, matching every sibling property's gate. */
async function setPostStatus(id: string, status: "published" | "rejected") {
  const profile = await requirePlatformAdmin();
  const supabase = createAdminClient();

  const { data: post } = await supabase
    .from("blog_posts")
    .select("author_id, blog_authors(email)")
    .eq("id", id)
    .maybeSingle();
  if (!post) throw new Error("Post not found.");

  const authorEmail = (post.blog_authors as unknown as { email: string } | null)?.email;
  if (!authorEmail || !profile.email || authorEmail.toLowerCase() !== profile.email.toLowerCase()) {
    throw new Error("Only this post's own author can approve or reject it.");
  }

  const publishedAt =
    status === "published"
      ? await resolvePublishedAt(supabase, post.author_id as string, null)
      : null;

  const { error } = await supabase
    .from("blog_posts")
    .update({ status, published_at: publishedAt })
    .eq("id", id);
  if (error) throw new Error(`Failed to ${status === "published" ? "approve" : "reject"} post: ${error.message}`);

  revalidatePath("/admin/blog");
  revalidatePath("/blog");
}

export async function approvePost(formData: FormData) {
  await setPostStatus(str(formData, "id"), "published");
}

export async function rejectPost(formData: FormData) {
  await setPostStatus(str(formData, "id"), "rejected");
}

/** No author decides this for another author -- resolves the signed-in
 * admin's own blog_authors row by email match and only ever writes that
 * one row, regardless of which checkbox a raw POST might name. Matches
 * the same "only the post's own author" gate approvePost/rejectPost
 * already enforce. */
export async function updateAuthorAutoPublish(formData: FormData) {
  const profile = await requirePlatformAdmin();
  const supabase = createAdminClient();
  const autoPublish = formData.get("autoPublish") === "true";

  const { error } = await supabase
    .from("blog_authors")
    .update({ auto_publish: autoPublish })
    .eq("email", profile.email);
  if (error) throw new Error(`Failed to update auto-publish setting: ${error.message}`);

  revalidatePath("/admin/blog");
}
