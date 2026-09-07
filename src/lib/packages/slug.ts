export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "") // strip diacritics after NFKD decomposition
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const SUFFIX_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";

export function randomSuffix(length = 5): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += SUFFIX_CHARS[Math.floor(Math.random() * SUFFIX_CHARS.length)];
  }
  return out;
}
