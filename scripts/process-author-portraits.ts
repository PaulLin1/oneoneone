import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const SOURCE_DIR = path.join(process.cwd(), "public", "authors", "_source");
const OUTPUT_DIR = path.join(process.cwd(), "public", "authors");
const SIZE = 900;
const THRESHOLD = 128;
// Sources vary wildly in native resolution (a tight 683x910 crop next to a
// 2400x3059 scan) — resizing everyone down to the same working size first
// means a fixed blur radius removes a comparable amount of noise for all of
// them, rather than doing nothing on a huge source and then getting
// reapplied on top of crop-magnified noise later.
const WORKING_SIZE = 1200;
const BLUR_SIGMA = 2.2;
// A row/column counts as "content" once at least this fraction of it is ink
// — filters out stray speckle noise from defining the crop box.
const CONTENT_DENSITY = 0.004;
// How much room to leave around the tight content box so a crop doesn't
// clip right up against hair/shoulders.
const CROP_PADDING = 1.35;

type Box = { left: number; top: number; width: number; height: number };

/**
 * Which of {0, 255} is background rather than subject, by simple majority
 * of the whole buffer. Corner-only sampling breaks once a crop has zoomed
 * in tight enough that the crop's own corners land on the subject instead
 * of background (hair/shoulders reaching the frame edge, or — as with one
 * source photo here — a dark vignette baked into the original print);
 * background reliably occupies more than half the frame at the padding
 * this script crops with, even for a tight portrait.
 */
function backgroundValue(buf: Buffer): 0 | 255 {
  let count255 = 0;
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] === 255) count255++;
  }
  return count255 > buf.length / 2 ? 255 : 0;
}

/**
 * Tight bounding box of "ink" (non-background) pixels. sharp's `cover` +
 * attention gravity never zooms — it only picks which slice of the
 * already-framed source to keep — so a source photo with a lot of blank
 * mount/backdrop around a small subject stays small forever. Finding the
 * actual content and cropping to it is what makes zooming in possible.
 */
function contentBox(buf: Buffer, width: number, height: number, bg: 0 | 255): Box | null {
  const rowCount = new Array(height).fill(0);
  const colCount = new Array(width).fill(0);
  for (let y = 0; y < height; y++) {
    const base = y * width;
    for (let x = 0; x < width; x++) {
      if (buf[base + x] !== bg) {
        rowCount[y]++;
        colCount[x]++;
      }
    }
  }

  const top = rowCount.findIndex((c) => c / width > CONTENT_DENSITY);
  let bottom = -1;
  for (let y = height - 1; y >= 0; y--) {
    if (rowCount[y] / width > CONTENT_DENSITY) {
      bottom = y;
      break;
    }
  }
  const left = colCount.findIndex((c) => c / height > CONTENT_DENSITY);
  let right = -1;
  for (let x = width - 1; x >= 0; x--) {
    if (colCount[x] / height > CONTENT_DENSITY) {
      right = x;
      break;
    }
  }

  if (top < 0 || bottom < 0 || left < 0 || right < 0) return null;
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

/**
 * Expands a content box into a padded square crop region, clamped to the
 * image bounds. `side` is floored and left/top derived from it with the
 * same integer arithmetic (never independently rounded) so left+side and
 * top+side can never overflow the buffer by the stray pixel that made
 * sharp's extract() throw "bad extract area" here before.
 */
function squareCropFor(box: Box, imgWidth: number, imgHeight: number): Box {
  const cx = box.left + box.width / 2;
  const cy = box.top + box.height / 2;
  const side = Math.floor(Math.min(Math.max(box.width, box.height) * CROP_PADDING, imgWidth, imgHeight));
  const left = Math.max(0, Math.min(Math.floor(cx - side / 2), imgWidth - side));
  const top = Math.max(0, Math.min(Math.floor(cy - side / 2), imgHeight - side));
  return { left, top, width: side, height: side };
}

/**
 * Produces the site's actual portrait format: solid black RGB with the
 * silhouette carried entirely in the alpha channel (opaque = ink,
 * transparent = background) — matching the 4 hand-made originals, which is
 * what components/CategoryColumn.tsx and ReadingView.tsx expect from
 * `mask-image` (browsers only fall back to luminance masking when the
 * source image has no alpha channel at all, which a plain opaque threshold
 * PNG was doing wrong before).
 */
async function processOne(sourcePath: string, destPath: string): Promise<void> {
  // One smoothing pass, done once, before any cropping decision: flatten
  // (a source PNG's own alpha would otherwise leave grayscale()'s raw
  // output at 2 bytes/pixel and break every buf[y*width+x] index below),
  // resize to a shared working scale, then blur to suppress halftone/
  // scan-dot noise before threshold() turns every stray dot into a hard
  // black speck. Cropping *this* (already-smoothed) buffer next, rather
  // than re-blurring after a crop has already magnified the noise pattern,
  // is what makes the blur actually work regardless of how tight the crop
  // ends up being.
  const smoothed = sharp(sourcePath)
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .resize({ width: WORKING_SIZE, height: WORKING_SIZE, fit: "inside", withoutEnlargement: true })
    .blur(BLUR_SIGMA)
    .grayscale()
    .normalize();
  // Threshold straight off the already-grayscale `smoothed` pipeline, not a
  // sharp instance reconstructed from a raw buffer — the latter came back
  // 3 channels instead of 1 (silently tripling the buffer length and
  // corrupting every width/height-indexed lookup below).
  const { data: roughBinary, info: roughInfo } = await smoothed
    .clone()
    .threshold(THRESHOLD)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = roughInfo;

  const roughBg = backgroundValue(roughBinary);
  const box = contentBox(roughBinary, width, height, roughBg);
  const crop = box ? squareCropFor(box, width, height) : null;

  // sharp rejects extract() -> resize() chained directly onto a pipeline
  // that already had an earlier resize() in it ("bad extract area"), so the
  // crop has to be materialized to a buffer first and the final resize run
  // as a fresh pipeline. Reloading raw bytes as a new sharp() instance
  // silently promotes them back to 3-channel sRGB unless grayscale() is
  // re-asserted immediately — same reason the rough pass above threshold()s
  // straight off `smoothed` instead of a reloaded buffer.
  const croppedGray = crop ? await smoothed.clone().extract(crop).raw().toBuffer({ resolveWithObject: true }) : null;
  const finalPipeline = croppedGray
    ? sharp(croppedGray.data, {
        raw: { width: croppedGray.info.width, height: croppedGray.info.height, channels: 1 },
      }).grayscale()
    : smoothed.clone();
  const { data: finalBinary } = await finalPipeline
    .resize(SIZE, SIZE, { fit: "cover" })
    .threshold(THRESHOLD)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const finalBg = backgroundValue(finalBinary);

  const alpha = Buffer.alloc(SIZE * SIZE);
  for (let i = 0; i < finalBinary.length; i++) {
    alpha[i] = finalBinary[i] === finalBg ? 0 : 255;
  }

  await sharp({ create: { width: SIZE, height: SIZE, channels: 3, background: { r: 0, g: 0, b: 0 } } })
    .joinChannel(alpha, { raw: { width: SIZE, height: SIZE, channels: 1 } })
    .png()
    .toFile(destPath);
}

async function main() {
  if (!existsSync(SOURCE_DIR)) {
    console.error(`No staged images in ${path.relative(process.cwd(), SOURCE_DIR)} — run fetch-author-portrait first.`);
    process.exitCode = 1;
    return;
  }

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
      `\nSkipped (public/authors/<slug>.png already exists — pass --force to regenerate): ${skipped.join(", ")}`
    );
  }
  console.log(
    `\nProcessed ${processedSlugs.length} portrait(s). This is a mechanical, unreviewed pass — glance over each ` +
      `in public/authors/ and re-crop/redo by hand if a specific one looks bad before treating it as final. ` +
      `Slugs: ${processedSlugs.join(", ") || "(none)"}`
  );
}

main();
