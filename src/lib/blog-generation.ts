// The I/O-facing half of the blog agent pipeline -- the Anthropic
// generation loop and the Supabase writes around it -- duplicates Forge
// University's lib/blog-generation.ts exactly, adapted for ActiDesk's
// fixed primary/pillar links + topic-matched resource link (no course-slug
// catalog to choose a primary offering from) and blog_authors/blog_posts
// schema (0036/0037). blog-agent.ts stays the pure, DB-free
// validation/prompt-text half of the pipeline.

import type Anthropic from "@anthropic-ai/sdk";
import type { createAdminClient } from "@/lib/supabase/admin";
import { BLOG_MODEL, BLOG_MAX_TOKENS } from "@/lib/anthropic";
import { collectWebSearchUrls } from "@/lib/blog-agent";
import { RESOURCE_URL_OPTIONS } from "@/lib/blog-property-profile";

type AdminClient = ReturnType<typeof createAdminClient>;

// Server-side web search -- runs entirely on Anthropic's infrastructure.
// Declaring it here is enough; Claude calls it autonomously and the
// search itself never produces a pending tool_use we have to execute.
export const WEB_SEARCH_TOOL = { type: "web_search_20260209" as const, name: "web_search" as const };

// "Do not force a minimum number of articles -- if nothing worthwhile
// clears the bar, generate nothing." Only usable on a non-final iteration
// (see generateArticle) -- the final iteration still forces
// submit_blog_article as the existing safety valve against an unresolved
// research loop.
export const DECLINE_TOPIC_TOOL = {
  name: "decline_topic",
  description:
    "Call this INSTEAD of submit_blog_article when, after real research, nothing you found clears the bar for a genuinely distinct, well-supported article today -- not merely to save effort. Do not force a topic just to fill today's slot.",
  input_schema: {
    type: "object" as const,
    properties: {
      reason: {
        type: "string",
        description: "One or two sentences on why no candidate topic qualified today.",
      },
    },
    required: ["reason"],
  },
};

export const ARTICLE_TOOL = {
  name: "submit_blog_article",
  description:
    "Submit the finished, review-ready blog article for ActiDesk's blog, per the Multi-Brand Blog Writing SOP. Call this only after researching with web_search.",
  input_schema: {
    type: "object" as const,
    properties: {
      title: { type: "string", description: "Article title, plain text, no markdown formatting." },
      seo_title: {
        type: "string",
        description:
          "A distinct SEO title, worded differently from title. Target 55 characters or fewer -- 65 is a hard ceiling that gets truncated, so leave real margin rather than writing right up to it.",
      },
      excerpt: {
        type: "string",
        description:
          "A 2-4 sentence summary for the blog list page. Must read differently from meta_description, not just a shorter copy of it.",
      },
      meta_description: {
        type: "string",
        description:
          "SEO meta description, 70-160 characters, includes the primary keyword naturally and states the reader benefit.",
      },
      body: {
        type: "string",
        description:
          "The full article body in markdown, following every structure and voice rule in the system prompt exactly. Must include exactly three internal links and 4-7 external citation links, woven naturally into the prose.",
      },
      image_prompt: {
        type: "string",
        description:
          "A short, vivid prompt describing a landscape cover image illustrating this article's specific argument, suitable for an AI image generator.",
      },
      image_alt_text: {
        type: "string",
        description:
          "Alt text describing what the cover image shows, not a repeat of the title. Target 100 characters or fewer -- 125 is a hard ceiling that gets truncated, so leave real margin rather than writing right up to it.",
      },
      distinct_angle: {
        type: "string",
        description:
          "One sentence stating what is new, different, more useful, or more current about this article versus this blog's existing coverage.",
      },
      resource_industry: {
        type: "string",
        description:
          `The industry, exactly as given in the prompt, that this article's supporting-resource internal link points to. One of: ${RESOURCE_URL_OPTIONS.map((r) => r.industry).join(", ")}.`,
      },
    },
    required: [
      "title",
      "seo_title",
      "excerpt",
      "meta_description",
      "body",
      "image_prompt",
      "image_alt_text",
      "distinct_angle",
      "resource_industry",
    ],
  },
};

// Generation may take a few research-and-write round trips (web_search can
// pause_turn internally on heavy research); bounded so a stuck run fails
// closed instead of looping indefinitely. On the final iteration,
// tool_choice is forced to submit_blog_article as a safety valve --
// validateCitations/validateInternalLinks still reject the draft if that
// forced call skipped real research or the required links.
const MAX_GENERATION_ITERATIONS = 4;

export type GenerateArticleResult =
  | { outcome: "submitted"; input: unknown; verifiedUrls: Set<string> }
  | { outcome: "declined"; reason: string };

// Runs the research-then-write agentic loop: Claude may call the
// server-side web_search tool freely (resolved entirely on Anthropic's
// infrastructure, never producing a pending tool_use of our own to
// execute), and on any but the last iteration may call decline_topic
// instead of writing anything (see DECLINE_TOPIC_TOOL). Returns the
// submit_blog_article tool input plus every URL a real web_search result
// returned during the run, so the caller can verify citations weren't
// invented. Returns null if the model never calls either tool within the
// iteration budget.
export async function generateArticle(
  anthropic: Anthropic,
  systemPrompt: string,
  topicPrompt: string,
): Promise<GenerateArticleResult | null> {
  const verifiedUrls = new Set<string>();
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: topicPrompt }];

  for (let iteration = 0; iteration < MAX_GENERATION_ITERATIONS; iteration++) {
    const isLastIteration = iteration === MAX_GENERATION_ITERATIONS - 1;

    const response = await anthropic.messages.create({
      model: BLOG_MODEL,
      max_tokens: BLOG_MAX_TOKENS,
      system: systemPrompt,
      tools: [WEB_SEARCH_TOOL, ARTICLE_TOOL, DECLINE_TOPIC_TOOL],
      tool_choice: isLastIteration ? { type: "tool", name: "submit_blog_article" } : { type: "any" },
      messages,
    });

    for (const url of collectWebSearchUrls(response.content)) {
      verifiedUrls.add(url);
    }

    if (response.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: response.content });
      continue;
    }

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
    );

    if (toolUse?.name === "submit_blog_article") {
      return { outcome: "submitted", input: toolUse.input, verifiedUrls };
    }

    if (toolUse?.name === "decline_topic") {
      const rawReason = (toolUse.input as { reason?: unknown } | null)?.reason;
      return { outcome: "declined", reason: typeof rawReason === "string" ? rawReason : "No reason given" };
    }

    // Not submit_blog_article, not decline_topic, and not a pause --
    // nothing more to resume toward completion (web_search never leaves a
    // pending tool_use of its own), so stop rather than spend the
    // remaining iteration budget.
    break;
  }

  return null;
}

export async function logRun(
  supabase: AdminClient,
  fields: {
    status: "success" | "failed";
    postId?: string;
    authorSlug?: string;
    topic?: string;
    imageGenerated?: boolean;
    emailSent?: boolean;
    errorMessage?: string;
  },
) {
  await supabase.from("blog_generation_runs").insert({
    status: fields.status,
    post_id: fields.postId ?? null,
    author_slug: fields.authorSlug ?? null,
    topic: fields.topic ?? null,
    image_generated: fields.imageGenerated ?? false,
    email_sent: fields.emailSent ?? false,
    error_message: fields.errorMessage ?? null,
    model: BLOG_MODEL,
  });
}
