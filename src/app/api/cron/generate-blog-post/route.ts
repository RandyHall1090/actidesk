import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAnthropicClient } from "@/lib/anthropic";
import { generateCoverImage } from "@/lib/recraft";
import { nextOpenPublishDate, getOccupiedPublishDates } from "@/lib/blog";
import { slugify } from "@/lib/slugify";
import { RESOURCE_URL_OPTIONS, APPROVED_CTA } from "@/lib/blog-property-profile";
import {
  validateGeneratedPost,
  describeValidationFailure,
  resolveUniqueSlug,
  nextPostStatus,
  buildTopicPrompt,
  buildSystemPrompt,
  validateInternalLinks,
  describeInternalLinksFailure,
  validateCitations,
  describeCitationsFailure,
  dropUnverifiedCitations,
  ensureMinimumCitations,
  appendCta,
  countWords,
} from "@/lib/blog-agent";
import { generateArticle, logRun } from "@/lib/blog-generation";
import { sendReviewEmail } from "@/app/(dashboard)/admin/blog/notify";

// The research-then-write loop below can run several real web_search
// rounds before it writes anything -- each one is a genuine network call
// to Anthropic, not local compute. Matches Forge University's own
// duration bump after its first production run timed out mid-research at
// the 300s platform default.
export const maxDuration = 800;

type AdminClient = ReturnType<typeof createAdminClient>;

type Author = {
  id: string;
  slug: string;
  name: string;
  title: string;
  voicePrompt: string;
  autoPublish: boolean;
};

// Bearer-token auth against CRON_SECRET, matching every other pg_cron
// -triggered route in this repo (api/cron/follow-through,
// api/notifications/hot-lead) -- timing-safe, never a plain !== compare.
function isAuthorized(req: NextRequest): boolean {
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function getAuthorBySlug(supabase: AdminClient, slug: string): Promise<Author | null> {
  const { data } = await supabase
    .from("blog_authors")
    .select("id, slug, name, title, voice_prompt, auto_publish")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id as string,
    slug: data.slug as string,
    name: data.name as string,
    title: data.title as string,
    voicePrompt: data.voice_prompt as string,
    autoPublish: data.auto_publish as boolean,
  };
}

// Today's earlier posts must always be in the "avoid repeating this"
// context regardless of the recency cap, or a later same-day run (this
// pipeline runs 4 authors on the same weekday, an hour apart) could cover
// the same ground an earlier run already staked out.
async function getRecentPostTitles(supabase: AdminClient): Promise<string[]> {
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);

  const [{ data: recent }, { data: today }] = await Promise.all([
    supabase.from("blog_posts").select("title").order("created_at", { ascending: false }).limit(20),
    supabase.from("blog_posts").select("title").gte("created_at", startOfToday.toISOString()),
  ]);

  const titles = [...(recent ?? []), ...(today ?? [])].map((row) => row.title as string);
  return Array.from(new Set(titles));
}

async function getExistingSlugs(supabase: AdminClient): Promise<string[]> {
  const { data } = await supabase.from("blog_posts").select("slug");
  return (data ?? []).map((row) => row.slug as string);
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authorSlug = request.nextUrl.searchParams.get("authorSlug");
  if (!authorSlug) {
    return NextResponse.json({ error: "Missing authorSlug" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const author = await getAuthorBySlug(supabase, authorSlug);
  if (!author) {
    return NextResponse.json({ error: "Unknown or inactive author" }, { status: 400 });
  }

  const recentTitles = await getRecentPostTitles(supabase);
  const topicPrompt = buildTopicPrompt(recentTitles);

  let draft;
  let verifiedUrls: Set<string>;
  try {
    const anthropic = getAnthropicClient();
    const generated = await generateArticle(anthropic, buildSystemPrompt(author.voicePrompt), topicPrompt);

    if (!generated) {
      await logRun(supabase, {
        status: "failed",
        authorSlug: author.slug,
        errorMessage: "Model did not call submit_blog_article within the iteration budget",
      });
      return NextResponse.json({ error: "Article generation failed" }, { status: 500 });
    }

    // Declining is the correct, intended outcome when nothing clears the
    // bar today, not a failure -- logged as success, no post created.
    if (generated.outcome === "declined") {
      await logRun(supabase, {
        status: "success",
        authorSlug: author.slug,
        errorMessage: `Declined: ${generated.reason}`,
      });
      return NextResponse.json({ status: "declined", reason: generated.reason, author: author.slug });
    }

    draft = validateGeneratedPost(generated.input);
    verifiedUrls = generated.verifiedUrls;

    if (!draft) {
      await logRun(supabase, {
        status: "failed",
        authorSlug: author.slug,
        errorMessage: `Generated content failed validation: ${describeValidationFailure(generated.input)}`,
      });
      return NextResponse.json({ error: "Generated content failed validation" }, { status: 500 });
    }
  } catch (err) {
    await logRun(supabase, {
      status: "failed",
      authorSlug: author.slug,
      errorMessage: err instanceof Error ? err.message : "Article generation failed",
    });
    return NextResponse.json({ error: "Article generation failed" }, { status: 500 });
  }

  if (!validateInternalLinks(draft.body)) {
    await logRun(supabase, {
      status: "failed",
      authorSlug: author.slug,
      topic: draft.title,
      errorMessage: `Body did not contain exactly the three required internal links: ${describeInternalLinksFailure(draft.body)}`,
    });
    return NextResponse.json({ error: "Generated content failed validation" }, { status: 500 });
  }

  // First un-link any cited URL that isn't a verified web_search result (a
  // single bad citation shouldn't sink an otherwise well-researched
  // draft), then top up from already-verified sources if that dropped the
  // count below the minimum -- both fixes before the hard check.
  const unverifiedDropped = dropUnverifiedCitations(draft.body, verifiedUrls);
  const citedBody = ensureMinimumCitations(unverifiedDropped, verifiedUrls);

  if (!validateCitations(citedBody, verifiedUrls)) {
    await logRun(supabase, {
      status: "failed",
      authorSlug: author.slug,
      topic: draft.title,
      errorMessage: `Body did not contain 4+ verified external citations: ${describeCitationsFailure(citedBody, verifiedUrls)}`,
    });
    return NextResponse.json({ error: "Generated content failed validation" }, { status: 500 });
  }

  const finalBody = appendCta(citedBody, APPROVED_CTA.url, APPROVED_CTA.label);
  const wordCount = countWords(finalBody);

  const existingSlugs = await getExistingSlugs(supabase);
  const slug = resolveUniqueSlug(slugify(draft.title), existingSlugs);

  let coverImageUrl: string | null = null;
  let imageGenerated = false;
  try {
    const imageBuffer = await generateCoverImage(draft.imagePrompt);
    const imagePath = `${slug}.webp`;
    const { error: uploadError } = await supabase.storage
      .from("blog-covers")
      .upload(imagePath, imageBuffer, { contentType: "image/webp", upsert: true });
    if (uploadError) throw new Error(uploadError.message);
    const { data: publicUrlData } = supabase.storage.from("blog-covers").getPublicUrl(imagePath);
    coverImageUrl = publicUrlData.publicUrl;
    imageGenerated = true;
  } catch (err) {
    console.error("Cover image generation failed, continuing without one:", err);
  }

  const status = nextPostStatus(author.autoPublish);

  // "Approval date != publication date." Even in auto-publish mode, a post
  // doesn't just go live the instant it's generated -- it gets the next
  // open weekday slot this author hasn't already used.
  let publishedAt: string | null = null;
  if (status === "published") {
    const occupied = await getOccupiedPublishDates(supabase, author.id);
    publishedAt = nextOpenPublishDate(occupied, new Date()).toISOString();
  }

  const resourceLink = RESOURCE_URL_OPTIONS.find((r) => r.industry === draft.resourceIndustry);

  const { data: created, error: insertError } = await supabase
    .from("blog_posts")
    .insert({
      slug,
      title: draft.title,
      seo_title: draft.seoTitle,
      excerpt: draft.excerpt,
      meta_description: draft.metaDescription,
      image_alt_text: draft.imageAltText,
      content: finalBody,
      cover_image_url: coverImageUrl,
      author_id: author.id,
      status,
      published_at: publishedAt,
    })
    .select("id")
    .single();

  if (insertError || !created) {
    await logRun(supabase, {
      status: "failed",
      authorSlug: author.slug,
      topic: draft.title,
      imageGenerated,
      errorMessage: `Failed to insert post: ${insertError?.message}`,
    });
    return NextResponse.json({ error: "Failed to create post" }, { status: 500 });
  }

  let emailSent = false;
  if (status === "pending_review") {
    try {
      await sendReviewEmail(supabase, created.id as string);
      emailSent = true;
    } catch (err) {
      console.error("Notification email failed:", err);
    }
  }

  await logRun(supabase, {
    status: "success",
    postId: created.id as string,
    authorSlug: author.slug,
    topic: draft.title,
    imageGenerated,
    emailSent,
  });

  return NextResponse.json({
    postId: created.id,
    status,
    imageGenerated,
    emailSent,
    author: author.slug,
    resourceIndustry: resourceLink?.industry,
    wordCount,
  });
}
