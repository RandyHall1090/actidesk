import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { getCurrentProfile } from "@/lib/profile";
import { HELP_CHAT_INSTRUCTIONS } from "@/lib/helpChat/content";

export async function POST(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile || !profile.is_active) {
    return new Response("Unauthorized", { status: 401 });
  }

  const MAX_MESSAGES = 50;
  const MAX_PAYLOAD_CHARS = 50_000;

  try {
    const { messages }: { messages: UIMessage[] } = await req.json();

    // Authenticated-only, so this isn't a security boundary -- just cost
    // control against an oversized/malformed request driving up model usage.
    if (!Array.isArray(messages) || messages.length > MAX_MESSAGES) {
      return new Response("Too many messages.", { status: 400 });
    }
    if (JSON.stringify(messages).length > MAX_PAYLOAD_CHARS) {
      return new Response("Message payload too large.", { status: 400 });
    }

    const result = streamText({
      model: "anthropic/claude-sonnet-5",
      instructions: HELP_CHAT_INSTRUCTIONS,
      messages: await convertToModelMessages(messages),
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("help-chat request failed:", error);
    return new Response("Something went wrong. Please try again.", {
      status: 500,
    });
  }
}
