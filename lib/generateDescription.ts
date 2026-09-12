import type { WorkCategory } from "@/lib/types";

/**
 * Best-effort 1-2 sentence catalog description for a work. Used by
 * scripts/add-daily.ts when the caller doesn't pass --description, so the
 * daily pipeline doesn't have to write one by hand for every pick.
 *
 * Returns null (never throws) on a missing/invalid ANTHROPIC_API_KEY or a
 * request error — add-daily then requires an explicit --description rather
 * than publishing a work with no description.
 */
export async function generateDescription(params: {
  title: string;
  authorName: string;
  category: WorkCategory;
  text: string;
}): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  // Enough of the work to write an honest description without paying to
  // send (or read back in review) the whole thing — most poems/essays fit
  // entirely within this anyway.
  const excerpt = params.text.slice(0, 4000);

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 150,
        messages: [
          {
            role: "user",
            content:
              `Write a 1-2 sentence description of this ${params.category} for a reading app's catalog page. ` +
              `No clichés, no back-cover-blurb language — plain, specific, true to the text. ` +
              `Reply with only the description, nothing else.\n\n` +
              `Title: ${params.title}\nAuthor: ${params.authorName}\n\nText:\n${excerpt}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      console.error(`  ! description generation failed for "${params.title}": HTTP ${res.status}`);
      return null;
    }

    const json = (await res.json()) as { content?: { type: string; text?: string }[] };
    const description = json.content?.find((block) => block.type === "text")?.text?.trim();
    return description || null;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`  ! description generation failed for "${params.title}": ${message}`);
    return null;
  }
}
