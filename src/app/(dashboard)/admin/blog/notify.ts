import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.actidesk.ai";

/** Notifies only the post's own author that it's ready for their review --
 * "each author approves only their own posts" applies to the notification
 * too, not just the approve/reject gate, matching every sibling property. */
export async function sendReviewEmail(supabase: SupabaseClient, postId: string): Promise<void> {
  const { data: post } = await supabase
    .from("blog_posts")
    .select("title, blog_authors(email, name)")
    .eq("id", postId)
    .maybeSingle();
  if (!post) return;

  const author = Array.isArray(post.blog_authors) ? post.blog_authors[0] : post.blog_authors;
  if (!author?.email) return;

  await sendEmail({
    to: author.email,
    subject: `Blog post pending review: ${post.title}`,
    html: `<p>A blog post is ready for your review.</p>
<p><strong>${post.title}</strong></p>
<p>Only you can approve or reject it, since you're its assigned author.</p>
<p><a href="${APP_URL}/admin/blog/${postId}/edit">Review it here</a></p>`,
  });
}
