import Anthropic from "@anthropic-ai/sdk";

// Model for AI blog agent article generation -- duplicates Forge
// University's lib/anthropic.ts exactly (BLOG_MODEL/BLOG_MAX_TOKENS):
// Sonnet, not a cheaper model, since this is published brand-facing
// content, not a quota-capped chat reply. 16000 tokens covers a full
// research-then-write turn (web_search tool use + a ~1,500-word article
// body plus the submit_blog_article schema's other required fields).
export const BLOG_MODEL = "claude-sonnet-5";
export const BLOG_MAX_TOKENS = 16000;

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not set");
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}
