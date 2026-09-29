import { redirect } from "next/navigation";

// Review emails sent before the post page moved to /admin/blog/[id] still
// link here -- send them on to the same post.
export default async function LegacyEditPostPage({ params }: PageProps<"/admin/blog/[id]/edit">) {
  const { id } = await params;
  redirect(`/admin/blog/${id}`);
}
