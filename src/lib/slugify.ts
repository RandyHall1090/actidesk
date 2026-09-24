// Derives a URL-safe slug from a title. Used instead of trusting a slug
// field the AI generation call might produce inconsistently (wrong case,
// stray punctuation) -- the slug is always computed deterministically from
// the title, same as any manually-created post's slug would be typed by a
// human.
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
