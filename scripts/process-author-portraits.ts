import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { processPortraitBuffer } from "@/lib/portraitProcessing";

const SOURCE_DIR = path.join(process.cwd(), "public", "authors", "_source");
// Staged, not final: nothing under public/authors/ is committed or served
// directly anymore (see db/migrations/0006_portrait_urls.sql) — this is a
// local scratch space for a human or agent to glance over the mechanical
// output before scripts/publish-author-portrait.ts uploads the good ones
// to R2 and updates authors.portrait_url.
const OUTPUT_DIR = path.join(process.cwd(), "public", "authors", "_staging");

/**
 * File-in, file-out wrapper — the actual crop/threshold/speck-cleanup
 * algorithm lives in lib/portraitProcessing.ts now, shared with
 * app/api/admin/upload-portrait (a browser upload has no file on this
 * machine's disk to point sharp at, just a buffer).
 */
async function processOne(sourcePath: string, destPath: string): Promise<void> {
  const result = await processPortraitBuffer(readFileSync(sourcePath));
  writeFileSync(destPath, result);
}

async function main() {
  if (!existsSync(SOURCE_DIR)) {
    console.error(`No staged images in ${path.relative(process.cwd(), SOURCE_DIR)} — run fetch-author-portrait first.`);
    process.exitCode = 1;
    return;
  }

  mkdirSync(OUTPUT_DIR, { recursive: true });

  const force = process.argv.includes("--force");
  const files = readdirSync(SOURCE_DIR).filter((f) => /\.(jpe?g|png)$/i.test(f));
  const processedSlugs: string[] = [];
  const skipped: string[] = [];

  for (const file of files) {
    const slug = path.basename(file, path.extname(file));
    const destPath = path.join(OUTPUT_DIR, `${slug}.png`);

    if (existsSync(destPath) && !force) {
      skipped.push(slug);
      continue;
    }

    try {
      await processOne(path.join(SOURCE_DIR, file), destPath);
      processedSlugs.push(slug);
      console.log(`  ✓ ${slug}`);
    } catch (err) {
      console.error(`  ✗ ${slug}:`, err instanceof Error ? err.message : err);
    }
  }

  if (skipped.length > 0) {
    console.log(
      `\nSkipped (already staged — pass --force to regenerate): ${skipped.join(", ")}`
    );
  }
  console.log(
    `\nProcessed ${processedSlugs.length} portrait(s) into public/authors/_staging/. This is a mechanical, ` +
      `unreviewed pass — glance over each one before treating it as final, then run ` +
      `\`npm run publish-author-portrait -- "Author Name"\` (or --all) to upload the good ones to R2 and update ` +
      `authors.portrait_url. Delete a bad one from _staging/ rather than publishing it. ` +
      `Slugs: ${processedSlugs.join(", ") || "(none)"}`
  );
}

main();
