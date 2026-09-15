import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { getCurrentProfile } from "@/lib/profile";
import { HELP_CHAT_INSTRUCTIONS } from "@/lib/helpChat/content";

export async function POST(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile || !profile.is_active) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: "anthropic/claude-sonnet-5",
    instructions: HELP_CHAT_INSTRUCTIONS,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
