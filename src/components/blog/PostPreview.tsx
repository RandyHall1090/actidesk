import Image from "next/image";
import ReactMarkdown from "react-markdown";

// Shared by the public post page (/blog/[slug]) and the admin review page
// (/admin/blog/[id]) -- a reviewer sees exactly what a reader will see once
// the post is live (cover image, headings, links), not just the raw
// markdown form fields. Same arrangement as Forge University.
export function PostPreview({
  title,
  publishedAt,
  authorName,
  authorTitle,
  coverImageUrl,
  imageAltText,
  content,
  priorityImage = false,
}: {
  title: string;
  /** ISO date, or null for a post not yet published. */
  publishedAt?: string | null;
  authorName?: string | null;
  authorTitle?: string | null;
  coverImageUrl?: string | null;
  imageAltText?: string | null;
  content: string;
  priorityImage?: boolean;
}) {
  return (
    <article>
      {coverImageUrl && (
        <div className="relative mb-8 aspect-video w-full overflow-hidden rounded-sm border border-steel-line">
          <Image
            src={coverImageUrl}
            alt={imageAltText ?? ""}
            fill
            sizes="(min-width: 768px) 42rem, 100vw"
            className="object-cover"
            priority={priorityImage}
          />
        </div>
      )}
      <h1 className="font-display text-4xl font-bold text-bone">{title}</h1>
      <div className="mt-3 flex items-center gap-3 font-mono-brand text-sm uppercase tracking-wider text-bone-dim">
        {authorName && (
          <span>
            {authorName}
            {authorTitle ? `, ${authorTitle}` : ""}
          </span>
        )}
        <span>
          {publishedAt
            ? new Date(publishedAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })
            : "Not yet published"}
        </span>
      </div>
      {/* No Tailwind typography plugin installed in this repo -- targeted
          arbitrary variants instead of the `prose` classes, which would be
          no-ops without it. */}
      <div
        className="mt-8 text-lg leading-8 text-bone/90
          [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-bone
          [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:font-display [&_h3]:text-xl [&_h3]:font-bold [&_h3]:text-bone
          [&_p]:my-4 [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6
          [&_strong]:text-bone
          [&_a]:text-electric [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-bone
          [&_table]:my-4 [&_table]:w-full [&_table]:border-collapse
          [&_th]:border [&_th]:border-steel-line [&_th]:bg-steel/40 [&_th]:p-2 [&_th]:text-left [&_th]:text-bone
          [&_td]:border [&_td]:border-steel-line [&_td]:p-2"
      >
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </article>
  );
}
