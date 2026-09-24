// Duplicates Forge University's lib/recraft.ts exactly -- same endpoint,
// same negative-prompt-as-dedicated-field approach (FU hit garbled
// text/glyphs leaking through until moving "no X" phrasing out of the
// positive prompt, since Recraft's own docs warn that "no X" in the
// positive prompt can confuse the model into producing the opposite),
// same size (Recraft's size enum has no exact 1600x900 option -- 1820x1024
// is its closest 16:9 preset to the SOP's required landscape orientation).

const RECRAFT_API_URL = "https://external.api.recraft.ai/v1/images/generations";

const NEGATIVE_PROMPT =
  "text, typography, letters, numbers, words, writing, logos, watermarks, " +
  "human faces, charts, diagrams, user interface elements";

/** Recraft's generations endpoint only ever returns WebP -- there is no PNG
 * option. `response_format` only chooses `url` vs `b64_json`, never the
 * container format, so the caller stores/serves this as image/webp. */
export async function generateCoverImage(prompt: string): Promise<Buffer> {
  const apiKey = process.env.RECRAFT_API_KEY;
  if (!apiKey) {
    throw new Error("RECRAFT_API_KEY is not set");
  }

  const generateResponse = await fetch(RECRAFT_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      negative_prompt: NEGATIVE_PROMPT,
      style: "digital_illustration",
      size: "1820x1024",
      response_format: "url",
    }),
  });

  if (!generateResponse.ok) {
    const body = await generateResponse.text();
    throw new Error(`Recraft generation failed (${generateResponse.status}): ${body}`);
  }

  const { data } = (await generateResponse.json()) as { data?: { url?: string }[] };
  const imageUrl = data?.[0]?.url;
  if (!imageUrl) {
    throw new Error("Recraft response had no image URL.");
  }

  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to download generated cover image (${imageResponse.status}).`);
  }
  return Buffer.from(await imageResponse.arrayBuffer());
}
