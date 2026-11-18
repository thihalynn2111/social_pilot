const API = "https://api.anthropic.com/v1/messages";

async function ask(system: string, user: string, maxTokens = 1200): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
  const res = await fetch(API, {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { content: { type: string; text?: string }[] };
  return data.content.map((c) => c.text ?? "").join("");
}

const lang = () => process.env.CONTENT_LANGUAGE ?? "Burmese";

export type IdeaDraft = { title: string; hook: string };

export async function generateIdeas(topic: string, count = 5): Promise<IdeaDraft[]> {
  const text = await ask(
    `You are a short-form social media strategist. Reply with ONLY a JSON array, no markdown fences.`,
    `Give ${count} distinct short-video/image post ideas about: "${topic}".
Write in ${lang()}. Each item: {"title": short title, "hook": the opening line / angle in one or two sentences}.`,
  );
  const clean = text.replace(/```json|```/g, "").trim();
  const arr = JSON.parse(clean) as IdeaDraft[];
  return arr.slice(0, count);
}

export async function writeCaption(idea: IdeaDraft): Promise<string> {
  return (
    await ask(
      `You write captions for Facebook Reels and TikTok. Output only the caption text with 3-5 relevant hashtags at the end. No preamble.`,
      `Write a caption in ${lang()} for this post idea.\nTitle: ${idea.title}\nHook: ${idea.hook}\nKeep it under 300 characters before hashtags.`,
      600,
    )
  ).trim();
}
