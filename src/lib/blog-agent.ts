// Pure, DB-free validation and prompt-text helpers for the AI blog agent --
// duplicates Forge University's lib/blog-agent.ts validation rules exactly
// (prohibited-word list, banned punctuation, emoji, H1, cite-artifact
// defense, citation floor, relative internal links). The one deliberate
// adaptation is validateInternalLinks: ActiDesk's "supporting resource"
// role picks from several real industry pages rather than one fixed URL
// (see blog-property-profile.ts).

import type { PostStatus } from "./blog";
import {
  PRIMARY_OFFERING_URL,
  PILLAR_CONVERSION_URL,
  RESOURCE_URL_OPTIONS,
  IMAGE_DIRECTION,
  PROHIBITED_CLAIMS,
} from "./blog-property-profile";

export const PROHIBITED_TERMS = [
  "accordingly",
  "additionally",
  "moreover",
  "thus",
  "robust",
  "seamless",
  "innovative",
  "cutting-edge",
  "game changer",
  "circle back",
  "touch base",
  "in today's fast-paced world",
  "unlock",
  "delve",
  "navigate the complexities",
] as const;

export function findProhibitedLanguage(body: string): string[] {
  const lower = body.toLowerCase();
  return PROHIBITED_TERMS.filter((term) => lower.includes(term));
}

// Only this narrow subset gets mechanically repaired before validation
// runs; every other prohibited term still hard-fails -- matches FU exactly.
const AUTO_REPAIRABLE_WORDS = ["accordingly", "additionally", "moreover", "thus"];

export function autoRepairProhibitedLanguage(body: string): string {
  let result = body;
  for (const word of AUTO_REPAIRABLE_WORDS) {
    // Sentence-initial (capitalized, followed by comma): drop the word and
    // the comma, re-capitalize whatever follows.
    result = result.replace(
      new RegExp(`\\b${word.charAt(0).toUpperCase()}${word.slice(1)},\\s+(\\w)`, "g"),
      (_match, nextChar: string) => nextChar.toUpperCase(),
    );
    // Mid-sentence or bare occurrence, any case, optional surrounding comma.
    result = result.replace(new RegExp(`,?\\s*\\b${word}\\b,?\\s*`, "gi"), " ");
  }
  return result.replace(/\s{2,}/g, " ").trim();
}

export function hasBannedPunctuation(body: string): boolean {
  return body.includes("—") || body.includes(";");
}

const EMOJI_PATTERN = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
export function hasEmoji(body: string): boolean {
  return EMOJI_PATTERN.test(body);
}

export function hasMarkdownH1(body: string): boolean {
  return /^#\s+/m.test(body);
}

/** Anthropic's web_search tool citations are always-on, structured
 * metadata attached to text content blocks -- never literal inline
 * markup. A model can hallucinate/imitate the format as literal
 * `<cite index="N-M">claim</cite>` wrapper tags in the article body; this
 * mechanically unwraps well-formed pairs (safe -- the wrapped text is
 * always supplementary to, never a replacement for, the article's
 * separately required real markdown citation links). */
export function stripCiteArtifacts(body: string): string {
  return body.replace(/<cite[^>]*>([\s\S]*?)<\/cite>/gi, "$1");
}

/** Backstop for stripCiteArtifacts failing to fully clean a malformed or
 * unclosed <cite> tag -- run this AFTER stripCiteArtifacts and hard-reject
 * if anything survived. */
export function hasCiteArtifact(body: string): boolean {
  return /<cite\b/i.test(body);
}

/** Normalizes a URL to host+path (no protocol, no query string, no trailing
 * slash) so a citation link the model wrote and the raw URL a web_search
 * result returned compare equal even if they differ in http/https, a
 * tracking query string, or a trailing slash. Matches Forge University's
 * exactly -- ensureMinimumCitations relies on the protocol being stripped. */
function normalizeForCompare(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname}`.replace(/\/+$/, "").toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

// Site-relative markdown links only -- absolute http(s) links are
// citations, handled separately. `*`, not FU's `+`, so the bare "/"
// homepage link counts too.
const RELATIVE_LINK_PATTERN = /\]\((\/[^\s)]*)\)/g;

function findRelativeLinks(body: string): string[] {
  return Array.from(body.matchAll(RELATIVE_LINK_PATTERN), (m) => m[1]);
}

/** Exactly 3 internal links, no more, no fewer, no duplicates: the primary
 * offering page, one matching industry resource page, and the
 * signup/conversion pillar -- every one a site-relative path from
 * blog-property-profile.ts, never invented by the model. */
export function validateInternalLinks(body: string): boolean {
  const found = findRelativeLinks(body);
  if (found.length !== 3) return false;
  const linkSet = new Set(found);
  if (linkSet.size !== 3) return false; // no duplicates

  if (!linkSet.has(PRIMARY_OFFERING_URL) || !linkSet.has(PILLAR_CONVERSION_URL)) return false;
  const resourceOptions = new Set<string>(RESOURCE_URL_OPTIONS.map((r) => r.url));
  return found.filter((url) => resourceOptions.has(url)).length === 1;
}

/** Every citation must match a URL Anthropic's web_search tool actually
 * returned during this generation run -- never the model's own memory.
 * Matches FU's real code exactly: a floor of 4, no ceiling enforced (the
 * SOP's "4-7" is prompt guidance only in the reference implementation,
 * not a hard rejection above 7 -- ported as-is, not "improved"). */
export function validateCitations(body: string, verifiedUrls: Set<string>): boolean {
  const externalLinkPattern = /\]\((https?:\/\/[^\s)]+)\)/g;
  const found = Array.from(body.matchAll(externalLinkPattern), (m) => normalizeForCompare(m[1]));
  const distinct = Array.from(new Set(found));
  if (distinct.length < 4) return false;
  return distinct.every((url) => verifiedUrls.has(url));
}

/** Un-links (doesn't delete) any citation whose URL never appeared in a
 * real web_search result -- run before validateCitations. */
export function dropUnverifiedCitations(body: string, verifiedUrls: Set<string>): string {
  return body.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (match, text: string, url: string) => {
    return verifiedUrls.has(normalizeForCompare(url)) ? match : text;
  });
}

export function truncateAtWordBoundary(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated).trim();
}

/** Builds the verified-URL set from Anthropic's web_search_tool_result
 * content blocks in a Messages API response -- never the model's own text. */
export function collectWebSearchUrls(content: Array<{ type: string; content?: unknown }>): Set<string> {
  const urls = new Set<string>();
  for (const block of content) {
    if (block.type !== "web_search_tool_result" || !Array.isArray(block.content)) continue;
    for (const result of block.content as Array<{ url?: string }>) {
      if (typeof result.url === "string") urls.add(normalizeForCompare(result.url));
    }
  }
  return urls;
}

/** Duplicates Forge University's buildSystemPrompt structure and rules
 * exactly (STRUCTURE / VOICE / LENGTH / INTERNAL LINKS / IMAGE / FINAL
 * SELF-CHECK), reframed for ActiDesk's subject matter (B2B sales-enablement
 * SaaS, not certification exam-prep) and property profile (a fixed primary
 * + pillar link plus a topic-matched resource link, not a course slug
 * catalog). voicePrompt is the calling author's own lens (blog_authors.
 * voice_prompt, migration 0037). */
export function buildSystemPrompt(voicePrompt: string): string {
  const resourceList = RESOURCE_URL_OPTIONS.map((r) => `${r.url} (${r.industry})`).join(", ");
  return [
    "You are the automated content generator for ActiDesk's blog. ActiDesk is a B2B SaaS tool that lets any sales rep, in any industry, build a personalized, trackable prospect page in minutes -- video, audio, business card, magazine, letter, and brochures on a branded desk-scene template -- ahead of a meeting.",
    "This is a real, published editorial property, not a demo -- every article must arrive review-ready under Securafy's Multi-Brand Blog Writing SOP. A human reviewer (the article's own byline author) approves or rejects your draft; your job is to need zero repair.",
    "ActiDesk's positioning is deliberately horizontal -- any rep, any industry -- so do not write as if the reader is only in one vertical, even when the article's example or resource link happens to be industry-specific.",
    "",
    voicePrompt,
    "",
    "PROHIBITED CLAIMS (hard rules, not style guidance):",
    ...PROHIBITED_CLAIMS.map((c) => `- ${c}`),
    "",
    "STRUCTURE (required, in order):",
    "- No H1 heading in the body -- the publishing platform supplies the page's H1 from the title. Start directly with a short lead paragraph.",
    "- That opening paragraph is a direct-answer paragraph: in 40-60 words, answer the article's main question without requiring the reader to scan further.",
    "- Use descriptive H2 sections (## in markdown) and H3 subsections only where they aid the reader.",
    "- Include at least two H2 headings phrased as a buyer would ask an assistant or search engine a question, each answered directly in the first two or three sentences beneath it.",
    "- Paragraphs of two to four sentences, main point first, then evidence or implications.",
    "- At most two bulleted lists and one table in the whole article. Prose is the default -- use a list or table only where it genuinely makes the information easier to follow.",
    "- Use descriptive anchor text for every link (e.g. \"a branded prospect page\"), never a bare URL.",
    "",
    "VOICE:",
    "- Direct, concise, active, natural, authoritative, practical. Address the reader as 'you'.",
    "- Specific about the consequences that matter to a sales leader or rep here -- win rate, rep productivity, pipeline visibility, or time-to-send, whichever actually fits this article.",
    "- Never write an introduction that just restates the title, a recap section, a generic definition paragraph, or filler written to pad length.",
    "- Never use corporate buzzwords, AI cliches, hype, hashtags, emojis, semicolons, em dashes, or asterisks used as visible formatting.",
    "- Never use these words: accordingly, additionally, moreover, thus, robust, seamless, innovative, cutting-edge, game changer, circle back, touch base.",
    "- Never use these phrases: \"in today's fast-paced world\", \"unlock\", \"delve\", \"navigate the complexities\".",
    "- Never name or reference a competitor by name.",
    "",
    "LENGTH: approximately 1,500 words. Use the length the topic actually needs -- do not pad, and do not submit a thin draft.",
    "",
    "CITATIONS: 4-7 external citation links, woven naturally into the prose as descriptive anchor text, each one a URL a web_search call in this same conversation actually returned -- never a URL from memory. Never write a literal citation-tracking tag like `<cite index=\"2-6\">...</cite>` in the body; if you have a specific claim to attribute, just write a normal [text](url) markdown link.",
    "",
    `INTERNAL LINKS: weave exactly three internal links into the body as natural anchor text, using exactly these site-relative paths (starting with "/", no domain) and no others -- never invent one, never link the same path twice, never add a fourth:`,
    `1. Primary offering -- link to ${PRIMARY_OFFERING_URL} once, wherever the article makes the product case most naturally.`,
    `2. Supporting resource -- link to exactly ONE of these real industry pages, whichever best matches this article's topic or example (set resource_industry to that page's industry name): ${resourceList}.`,
    `3. Pillar/conversion -- link to ${PILLAR_CONVERSION_URL} once, where a reader ready to act would naturally click through.`,
    "Before calling submit_blog_article, count your own internal [text](/...) links in the body: there must be exactly 3. If you count 2 or 4, fix it before submitting.",
    "",
    `IMAGE: image_prompt must describe a landscape cover image illustrating this article's specific argument, matching this direction: ${IMAGE_DIRECTION} Must not ask for any visible text, letters, numbers, logos, human faces, charts, diagrams, or interface elements in the image.`,
    "",
    "Before calling submit_blog_article, confirm in your own reasoning that this article's angle is genuinely different from what a reader could already find on this blog -- that is what the distinct_angle field is for.",
    "",
    "FINAL SELF-CHECK -- re-read your own body text against this list before submitting, and fix anything you find (don't just note it, actually rewrite the sentence):",
    "- Search your body for these exact words and remove or replace every occurrence: accordingly, additionally, moreover, thus, robust, seamless, innovative, cutting-edge, game changer, circle back, touch base.",
    "- Search for an em dash (—) or a semicolon (;) and rewrite around them if found.",
    "- Search for any emoji and remove it if found.",
    "- Search your body for the literal text \"<cite\" and remove any such tag if found, keeping only the real [text](url) link.",
    "- Count your internal [text](/...) links one more time: exactly 3, including the pillar/conversion link.",
    "- Confirm nothing in the body violates a PROHIBITED CLAIMS rule above.",
    "Always finish by calling the submit_blog_article tool with your result -- do not respond with plain text as your final answer.",
  ].join("\n");
}

export function countWords(body: string): number {
  return body.trim().split(/\s+/).filter(Boolean).length;
}

// Diagnostic companion to validateInternalLinks, for logging only -- names
// the actual internal links found and how they diverge from what was
// required, instead of just "false".
export function describeInternalLinksFailure(body: string): string {
  const internalLinks = findRelativeLinks(body);
  const required = [
    PRIMARY_OFFERING_URL,
    PILLAR_CONVERSION_URL,
    `one of [${RESOURCE_URL_OPTIONS.map((r) => r.url).join(", ")}]`,
  ];
  return `found [${internalLinks.join(", ") || "none"}], required [${required.join(", ")}]`;
}

// Diagnostic companion to validateCitations, for logging only -- names the
// actual cited links, which ones weren't in the verified web_search set,
// and how many real search results were captured this run at all.
export function describeCitationsFailure(body: string, verifiedUrls: Set<string>): string {
  const externalLinkPattern = /\]\((https?:\/\/[^\s)]+)\)/g;
  const found = Array.from(body.matchAll(externalLinkPattern), (m) => normalizeForCompare(m[1]));
  const distinct = Array.from(new Set(found));
  const unverified = distinct.filter((url) => !verifiedUrls.has(url));
  return `cited [${distinct.join(", ") || "none"}] (${distinct.length} distinct), unverified [${unverified.join(", ") || "none"}], ${verifiedUrls.size} real web_search URL(s) captured this run: [${Array.from(verifiedUrls).join(", ") || "none"}]`;
}

/** Tops back up from already-verified-but-uncited URLs if dropping
 * unverified citations pushed the count below the minimum -- a single bad
 * citation shouldn't sink an otherwise well-researched draft. */
export function ensureMinimumCitations(body: string, verifiedUrls: Set<string>, minCount = 4): string {
  const externalLinkPattern = /\]\((https?:\/\/[^\s)]+)\)/g;
  const cited = new Set(Array.from(body.matchAll(externalLinkPattern), (m) => normalizeForCompare(m[1])));
  if (cited.size >= minCount) return body;

  const additions = Array.from(verifiedUrls)
    .filter((url) => !cited.has(url))
    .slice(0, minCount - cited.size);
  if (additions.length === 0) return body;

  const list = additions.map((url) => `- [${url.split("/")[0]}](https://${url})`).join("\n");
  return `${body.trim()}\n\n## Further Reading\n\n${list}`;
}

/** Appends the property profile's fixed CTA link after the model's own
 * closing paragraph -- guaranteed correct by never letting the model
 * supply the URL at all. */
export function appendCta(body: string, ctaUrl: string, ctaLabel: string): string {
  return `${body.trim()}\n\n[${ctaLabel}](${ctaUrl})`;
}

export type GeneratedArticle = {
  title: string;
  seoTitle: string;
  excerpt: string;
  metaDescription: string;
  body: string;
  imagePrompt: string;
  imageAltText: string;
  distinctAngle: string;
  resourceIndustry: string;
};

const VALID_RESOURCE_INDUSTRIES: Set<string> = new Set(RESOURCE_URL_OPTIONS.map((r) => r.industry));

// Mirrors validateGeneratedPost's checks to name which one actually
// failed, for logging only -- validateGeneratedPost itself stays a simple
// pass/null gate.
export function describeValidationFailure(input: unknown): string {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return "submit_blog_article input was not an object";
  }
  const obj = input as Record<string, unknown>;
  const field = (key: string): string => (typeof obj[key] === "string" ? (obj[key] as string).trim() : "");

  const required = [
    "title",
    "seo_title",
    "excerpt",
    "meta_description",
    "body",
    "image_prompt",
    "image_alt_text",
    "distinct_angle",
    "resource_industry",
  ];
  const missing = required.filter((key) => !field(key));
  if (missing.length > 0) return `missing or empty field(s): ${missing.join(", ")}`;

  const metaDescription = truncateAtWordBoundary(field("meta_description"), 160);
  const resourceIndustry = field("resource_industry");
  const body = stripCiteArtifacts(autoRepairProhibitedLanguage(field("body")));

  if (metaDescription.length < 70) return `meta_description is ${metaDescription.length} chars, under the 70 floor`;
  if (!VALID_RESOURCE_INDUSTRIES.has(resourceIndustry))
    return `resource_industry "${resourceIndustry}" is not one of the real industry pages`;
  if (hasMarkdownH1(body)) return "body contains an H1 heading";
  if (hasBannedPunctuation(body)) return "body contains an em dash or semicolon";
  if (hasEmoji(body)) return "body contains an emoji";
  if (hasCiteArtifact(body)) return "body contains an unclosed or malformed <cite> tag after cleanup";
  const prohibited = findProhibitedLanguage(body);
  if (prohibited.length > 0) return `body contains prohibited language: ${prohibited.join(", ")}`;
  return "internal links or citations failed -- checked separately after this gate";
}

/** The main validation gate: null means "reject, do not create a post."
 * A too-long seo_title/image_alt_text/meta_description is truncated at a
 * word boundary rather than rejected; a too-short meta_description still
 * hard-fails since there's no safe way to pad it. */
export function validateGeneratedPost(input: unknown): GeneratedArticle | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return null;
  const obj = input as Record<string, unknown>;
  const field = (key: string): string => (typeof obj[key] === "string" ? (obj[key] as string).trim() : "");

  const title = field("title");
  const rawSeoTitle = field("seo_title");
  const excerpt = field("excerpt");
  const rawMetaDescription = field("meta_description");
  const rawBody = field("body");
  const imagePrompt = field("image_prompt");
  const rawImageAltText = field("image_alt_text");
  const distinctAngle = field("distinct_angle");
  const resourceIndustry = field("resource_industry");

  if (
    !title ||
    !rawSeoTitle ||
    !excerpt ||
    !rawMetaDescription ||
    !rawBody ||
    !imagePrompt ||
    !rawImageAltText ||
    !distinctAngle ||
    !resourceIndustry
  ) {
    return null;
  }

  const body = stripCiteArtifacts(autoRepairProhibitedLanguage(rawBody));
  const seoTitle = truncateAtWordBoundary(rawSeoTitle, 65);
  const imageAltText = truncateAtWordBoundary(rawImageAltText, 124);
  const metaDescription = truncateAtWordBoundary(rawMetaDescription, 160);

  if (metaDescription.length < 70) return null;
  if (!VALID_RESOURCE_INDUSTRIES.has(resourceIndustry)) return null;
  if (hasMarkdownH1(body)) return null;
  if (hasBannedPunctuation(body)) return null;
  if (hasEmoji(body)) return null;
  if (hasCiteArtifact(body)) return null;
  if (findProhibitedLanguage(body).length > 0) return null;

  return { title, seoTitle, excerpt, metaDescription, body, imagePrompt, imageAltText, distinctAngle, resourceIndustry };
}

// Appends -2, -3, ... on collision with an existing slug.
export function resolveUniqueSlug(baseSlug: string, existingSlugs: string[]): string {
  if (!existingSlugs.includes(baseSlug)) return baseSlug;
  let suffix = 2;
  while (existingSlugs.includes(`${baseSlug}-${suffix}`)) {
    suffix++;
  }
  return `${baseSlug}-${suffix}`;
}

/** The one piece of business logic behind the per-author auto-publish
 * toggle: on, a generated post goes straight to published; off, it waits
 * for human review. No other status is ever chosen by the agent. */
export function nextPostStatus(autoPublish: boolean): PostStatus {
  return autoPublish ? "published" : "pending_review";
}

/** Formats the recent-posts context fed into the generation prompt -- a
 * fresh angle to pick from, so the model doesn't repeat an angle another
 * author (or this same author) already covered recently or earlier today. */
export function buildTopicPrompt(recentTitles: string[]): string {
  const recentList =
    recentTitles.length > 0 ? recentTitles.map((title) => `- ${title}`).join("\n") : "(no posts published yet)";
  return [
    "Recent post titles to avoid repeating -- pick a genuinely different angle:",
    recentList,
  ].join("\n");
}
