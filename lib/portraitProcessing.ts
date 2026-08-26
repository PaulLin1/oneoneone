import sharp from "sharp";

/**
 * The actual crop + threshold + speck-cleanup algorithm — extracted from
 * scripts/process-author-portraits.ts so app/api/admin/upload-portrait can
 * run it too, on a buffer straight from a browser upload rather than a
 * file staged on disk. This is the whole reason the port was tractable:
 * sharp's pipeline is buffer-in/buffer-out internally already (raw() /
 * toBuffer() throughout) — only the very first read and the final write in
 * the original script touched the filesystem, and both have a direct
 * buffer equivalent (sharp(buffer) / .toBuffer() instead of .toFile()).
 * Auto-discovered portraits (scripts/fetch-author-portrait.ts's Wikipedia
 * lookup, and Commons search in author-portraits.yml) still need a real
 * VM to stage/QA multiple attempts and so stay in that separate workflow —
 * this function is only for a single image a reviewer already chose, where
 * there's nothing to search for.
 */

const SIZE = 900;
const THRESHOLD = 128;
const WORKING_SIZE = 1200;
const BLUR_SIGMA = 2.2;
const CONTENT_DENSITY = 0.004;
const CROP_PADDING = 1.35;
const MIN_SPECK_PIXELS = 10;

type Box = { left: number; top: number; width: number; height: number };

function removeSpecks(buf: Buffer, width: number, height: number, bg: 0 | 255): void {
  const visited = new Uint8Array(buf.length);
  const stack: number[] = [];

  for (let start = 0; start < buf.length; start++) {
    if (visited[start] || buf[start] === bg) continue;

    const component: number[] = [];
    stack.push(start);
    visited[start] = 1;

    while (stack.length > 0) {
      const idx = stack.pop()!;
      component.push(idx);
      const x = idx % width;
      const y = (idx - x) / width;

      if (x > 0 && !visited[idx - 1] && buf[idx - 1] !== bg) {
        visited[idx - 1] = 1;
        stack.push(idx - 1);
      }
      if (x < width - 1 && !visited[idx + 1] && buf[idx + 1] !== bg) {
        visited[idx + 1] = 1;
        stack.push(idx + 1);
      }
      if (y > 0 && !visited[idx - width] && buf[idx - width] !== bg) {
        visited[idx - width] = 1;
        stack.push(idx - width);
      }
      if (y < height - 1 && !visited[idx + width] && buf[idx + width] !== bg) {
        visited[idx + width] = 1;
        stack.push(idx + width);
      }
    }

    if (component.length < MIN_SPECK_PIXELS) {
      for (const idx of component) buf[idx] = bg;
    }
  }
}

function backgroundValue(buf: Buffer): 0 | 255 {
  let count255 = 0;
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] === 255) count255++;
  }
  return count255 > buf.length / 2 ? 255 : 0;
}

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

function squareCropFor(box: Box, imgWidth: number, imgHeight: number): Box {
  const cx = box.left + box.width / 2;
  const cy = box.top + box.height / 2;
  const side = Math.floor(Math.min(Math.max(box.width, box.height) * CROP_PADDING, imgWidth, imgHeight));
  const left = Math.max(0, Math.min(Math.floor(cx - side / 2), imgWidth - side));
  const top = Math.max(0, Math.min(Math.floor(cy - side / 2), imgHeight - side));
  return { left, top, width: side, height: side };
}

/** Buffer in (any format sharp reads), PNG buffer out — same stencil format AuthorMark's mask-image expects. */
export async function processPortraitBuffer(source: Buffer): Promise<Buffer> {
  const smoothed = sharp(source)
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .resize({ width: WORKING_SIZE, height: WORKING_SIZE, fit: "inside", withoutEnlargement: true })
    .blur(BLUR_SIGMA)
    .grayscale()
    .normalize();

  const { data: roughBinary, info: roughInfo } = await smoothed
    .clone()
    .threshold(THRESHOLD)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = roughInfo;

  const roughBg = backgroundValue(roughBinary);
  removeSpecks(roughBinary, width, height, roughBg);
  const box = contentBox(roughBinary, width, height, roughBg);
  const crop = box ? squareCropFor(box, width, height) : null;

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
  removeSpecks(finalBinary, SIZE, SIZE, finalBg);

  const alpha = Buffer.alloc(SIZE * SIZE);
  for (let i = 0; i < finalBinary.length; i++) {
    alpha[i] = finalBinary[i] === finalBg ? 0 : 255;
  }

  return sharp({ create: { width: SIZE, height: SIZE, channels: 3, background: { r: 0, g: 0, b: 0 } } })
    .joinChannel(alpha, { raw: { width: SIZE, height: SIZE, channels: 1 } })
    .png()
    .toBuffer();
}
