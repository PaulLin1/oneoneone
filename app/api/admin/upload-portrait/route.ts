import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { authorSlug } from "@/lib/authorPortraits";
import { uploadAuthorPortrait } from "@/lib/r2";
import { processPortraitBuffer } from "@/lib/portraitProcessing";

// Image processing (crop/blur/threshold) can take a few seconds on a large
// source photo — default 10s Hobby timeout is cutting it close.
export const maxDuration = 30;

/**
 * "Upload your own" on /account's Catalog card — the guaranteed-to-work
 * path when auto-discovery (fetch-author-portrait.ts, via the
 * author-portraits.yml workflow) hasn't found anything usable for an
 * author yet. Runs the exact same digitization pass
 * (lib/portraitProcessing.ts) a reviewer already picking their own source
 * image, so there's no search/retry loop to run unattended — just process
 * and publish.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "reviewer" && session.user.role !== "admin")) {
    return Response.json({ error: "Not authorized." }, { status: 403 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  const authorName = formData?.get("authorName");
  if (!(file instanceof File) || typeof authorName !== "string" || !authorName.trim()) {
    return Response.json({ error: "Missing file or authorName." }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return Response.json({ error: "That file isn't an image." }, { status: 400 });
  }

  let processed: Buffer;
  try {
    processed = await processPortraitBuffer(Buffer.from(await file.arrayBuffer()));
  } catch (err) {
    return Response.json(
      { error: `Couldn't process that image: ${err instanceof Error ? err.message : String(err)}` },
      { status: 400 }
    );
  }

  const slug = authorSlug(authorName);
  const portraitUrl = await uploadAuthorPortrait(slug, processed);

  const sql = getDb();
  await sql`
    insert into authors (name, portrait_url)
    values (${authorName}, ${portraitUrl})
    on conflict (name) do update set portrait_url = excluded.portrait_url
  `;

  return Response.json({ ok: true, portraitUrl });
}
