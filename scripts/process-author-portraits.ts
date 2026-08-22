import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const SOURCE_DIR = path.join(process.cwd(), "public", "authors", "_source");
const OUTPUT_DIR = path.join(process.cwd(), "public", "authors");
const SIZE = 900;
const THRESHOLD = 128;

/**
 * Turns a raw Wikipedia portrait into the site's flat black-and-white mark:
 * square crop biased toward the most "interesting" region (sharp's built-in
 * attention strategy — a reasonable stand-in for face-centering without
 * running actual face detection), normalized contrast, then a hard
 * black/white threshold. Source photos vary — some have a dark background
 * (old daguerreotypes/engravings), some light — so after thresholding, the
 * four corners are sampled and the image is inverted if they came out
 * mostly black, so every output reads as "black mark on white ground" like
 * the hand-curated originals, regardless of the source's own polarity.
 */
async function processOne(sourcePath: string, destPath: string): Promise<void> {
  const thresholded = await sharp(sourcePath)
    .resize({ width: SIZE, height: SIZE, fit: "cover", position: sharp.strategy.attention })
    .grayscale()
    .normalize()
    .threshold(THRESHOLD)
    .png()
    .toBuffer();

  const corner = 60;
  const img = sharp(thresholded);
  const corners = await Promise.all(
    [
      { left: 0, top: 0 },
      { left: SIZE - corner, top: 0 },
      { left: 0, top: SIZE - corner },
      { left: SIZE - corner, top: SIZE - corner },
    ].map(({ left, top }) =>
      img
        .clone()
        .extract({ left, top, width: corner, height: corner })
        .stats()
        .then((s) => s.channels[0].mean)
    )
  );
  const cornerMean = corners.reduce((a, b) => a + b, 0) / corners.length;
  const backgroundIsDark = cornerMean < 128;

  const pipeline = sharp(thresholded);
  await (backgroundIsDark ? pipeline.negate({ alpha: false }) : pipeline).png().toFile(destPath);
}

async function main() {
  if (!existsSync(SOURCE_DIR)) {
    console.error(`No staged images in ${path.relative(process.cwd(), SOURCE_DIR)} — run fetch-author-portrait first.`);
    process.exitCode = 1;
    return;
  }

  const files = readdirSync(SOURCE_DIR).filter((f) => /\.(jpe?g|png)$/i.test(f));
  const processedSlugs: string[] = [];
  const skipped: string[] = [];

  for (const file of files) {
    const slug = path.basename(file, path.extname(file));
    const destPath = path.join(OUTPUT_DIR, `${slug}.png`);

    if (existsSync(destPath)) {
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
    console.log(`\nSkipped (already have a hand-reviewed public/authors/<slug>.png): ${skipped.join(", ")}`);
  }
  console.log(
    `\nProcessed ${processedSlugs.length} portrait(s). This is a mechanical, unreviewed pass (attention-crop + ` +
      `threshold, no human judgment on framing) — glance over each in public/authors/ and re-crop/redo by hand ` +
      `if a specific one looks bad before treating it as final. Slugs: ${processedSlugs.join(", ") || "(none)"}`
  );
}

main();
