type Author = { id: string; name: string; title: string };
type Post = {
  id: string;
  slug: string;
  title: string;
  seo_title: string | null;
  excerpt: string;
  meta_description: string | null;
  image_alt_text: string | null;
  content: string;
  cover_image_url: string | null;
  author_id: string | null;
  status: string;
};

const inputClasses =
  "mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100";
const labelClasses = "block text-sm text-neutral-600 dark:text-neutral-400";

export function PostForm({
  authors,
  post,
  action,
}: {
  authors: Author[];
  post?: Post;
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <form action={action} className="space-y-4">
      {post && <input type="hidden" name="id" value={post.id} />}
      <div>
        <label className={labelClasses}>Slug</label>
        <input
          name="slug"
          defaultValue={post?.slug}
          required
          readOnly={Boolean(post)}
          className={`${inputClasses} ${post ? "opacity-60" : ""}`}
        />
      </div>
      <div>
        <label className={labelClasses}>Title</label>
        <input name="title" defaultValue={post?.title} required className={inputClasses} />
      </div>
      <div>
        <label className={labelClasses}>SEO title (optional, falls back to title)</label>
        <input
          name="seo_title"
          defaultValue={post?.seo_title ?? ""}
          maxLength={65}
          className={inputClasses}
        />
      </div>
      <div>
        <label className={labelClasses}>Excerpt</label>
        <textarea
          name="excerpt"
          defaultValue={post?.excerpt}
          required
          rows={2}
          className={inputClasses}
        />
      </div>
      <div>
        <label className={labelClasses}>Meta description (optional, falls back to excerpt)</label>
        <textarea
          name="meta_description"
          defaultValue={post?.meta_description ?? ""}
          rows={2}
          className={inputClasses}
        />
      </div>
      <div>
        <label className={labelClasses}>Content (markdown)</label>
        <textarea
          name="content"
          defaultValue={post?.content}
          required
          rows={16}
          className={`${inputClasses} font-mono`}
        />
      </div>
      <div>
        <label className={labelClasses}>Cover image URL (optional)</label>
        <input
          name="cover_image_url"
          defaultValue={post?.cover_image_url ?? ""}
          className={inputClasses}
        />
      </div>
      <div>
        <label className={labelClasses}>Cover image alt text (optional, under 125 characters)</label>
        <input
          name="image_alt_text"
          defaultValue={post?.image_alt_text ?? ""}
          maxLength={124}
          className={inputClasses}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClasses}>Author</label>
          <select
            name="author_id"
            defaultValue={post?.author_id ?? ""}
            required
            className={inputClasses}
          >
            <option value="" disabled>
              Select an author
            </option>
            {authors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.title})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClasses}>Status</label>
          <select name="status" defaultValue={post?.status ?? "draft"} className={inputClasses}>
            <option value="draft">Draft</option>
            <option value="pending_review">Pending review</option>
            <option value="published">Published</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>
      <div>
        <label className={labelClasses}>
          Scheduled publish date (optional — only used if Status above is set to Published;
          leave blank to auto-assign the next open slot)
        </label>
        <input type="date" name="scheduled_publish_date" className={inputClasses} />
      </div>
      <button
        type="submit"
        className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
      >
        Save post
      </button>
    </form>
  );
}
