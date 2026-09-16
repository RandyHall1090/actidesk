export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "") // strip diacritics after NFKD decomposition
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * This suffix is the *entire* access control on a package's public
 * /s/[slug] page (see 0004_public_package_lookup.sql) -- there is no other
 * check. It previously drew 5 characters from Math.random(), a
 * non-cryptographic PRNG, giving only ~26 bits of entropy: brute-forceable
 * in hours once an attacker knows the human-readable prefix (the
 * prospect's name, which is otherwise easy to learn). crypto.randomUUID()
 * is a CSPRNG source -- the same one storage-path.ts already uses for
 * unguessable asset paths -- and the default length gives 80 bits from a
 * 16-symbol alphabet, well beyond any practical brute force.
 */
export function randomSuffix(length = 20): string {
  let out = "";
  while (out.length < length) {
    out += crypto.randomUUID().replace(/-/g, "");
  }
  return out.slice(0, length);
}
