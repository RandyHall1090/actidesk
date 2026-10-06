import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { SALES_CHAT_INSTRUCTIONS } from "@/lib/helpChat/content";

// Public (no sign-in), unlike /api/help-chat -- so these caps are the only
// thing standing between an anonymous script and the model bill.
const MAX_MESSAGES = 20;
const MAX_PAYLOAD_CHARS = 12_000;
const MAX_OUTPUT_TOKENS = 600;
const REQUESTS_PER_WINDOW = 15;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_TRACKED_CLIENTS = 5_000;

// Per-instance memory: Fluid Compute reuses instances, so this stops a
// single visitor hammering the endpoint, but it is not a global limit
// across every instance.
const recentRequests = new Map<string, number[]>();

function isRateLimited(clientKey: string, now: number) {
  const windowStart = now - WINDOW_MS;
  const timestamps = (recentRequests.get(clientKey) ?? []).filter((t) => t > windowStart);
  const limited = timestamps.length >= REQUESTS_PER_WINDOW;
  if (!limited) timestamps.push(now);
  recentRequests.set(clientKey, timestamps);

  if (recentRequests.size > MAX_TRACKED_CLIENTS) {
    for (const [key, times] of recentRequests) {
      if (times.every((t) => t <= windowStart)) recentRequests.delete(key);
    }
    // Still over (e.g. rotating IPv6 addresses): drop the oldest-inserted
    // keys so memory stays bounded.
    while (recentRequests.size > MAX_TRACKED_CLIENTS) {
      const oldestKey = recentRequests.keys().next().value;
      if (oldestKey === undefined) break;
      recentRequests.delete(oldestKey);
    }
  }
  return limited;
}

// Visitors only ever type text. Rebuilding messages from text parts alone
// stops a crafted request from attaching file URLs (which the model would
// fetch as large inputs, slipping past the size cap) or other part types.
function toTextOnlyMessages(messages: UIMessage[]): UIMessage[] {
  return messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => ({
      id: String(message.id ?? ""),
      role: message.role,
      parts: (Array.isArray(message.parts) ? message.parts : [])
        .filter((part) => part?.type === "text")
        .map((part) => ({ type: "text" as const, text: String((part as { text?: unknown }).text ?? "") })),
    }));
}

export async function POST(req: Request) {
  const clientKey =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  if (isRateLimited(clientKey, Date.now())) {
    return new Response("Too many questions in a short time. Try again in a few minutes.", {
      status: 429,
    });
  }

  try {
    const { messages: rawMessages }: { messages: UIMessage[] } = await req.json();

    if (!Array.isArray(rawMessages) || rawMessages.length > MAX_MESSAGES) {
      return new Response("Too many messages.", { status: 400 });
    }
    const messages = toTextOnlyMessages(rawMessages);
    if (JSON.stringify(messages).length > MAX_PAYLOAD_CHARS) {
      return new Response("Message payload too large.", { status: 400 });
    }

    const result = streamText({
      model: "anthropic/claude-sonnet-5",
      instructions: SALES_CHAT_INSTRUCTIONS,
      messages: await convertToModelMessages(messages),
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("sales-chat request failed:", error);
    return new Response("Something went wrong. Please try again.", {
      status: 500,
    });
  }
}
