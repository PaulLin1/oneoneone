import sharp from "sharp";
import { detectFace } from "@/lib/portrait/faceDetect";

/**
 * The actual crop + threshold + speck-cleanup algorithm — extracted from
 * scripts/process-author-portraits.ts so app/api/admin/upload-portrait can
 * run it too, on a buffer straight from a browser upload rather than a
 * file staged on disk. This is the whole reason the port was tractable:
 * sharp's pipeline is buffer-in/buffer-out internally already (raw() /
 * toBuffer() throughout) — only the very first read and the final write in
 * the original script touched the filesystem, and both have a direct
 * buffer equivalent (sharp(buffer) / .toBuffer() instead of .toFile()).
 *
 * Two things decide whether an auto-fetched portrait comes out usable:
 *
 *  - The crop. A pico face detector (lib/portrait/faceDetect.ts) locates
 *    the head and we crop head-and-shoulders around it. This is what fixed
 *    full-length and seated portraits — a dark Victorian coat is a bigger
 *    ink mass than the face, so the old ink-bounding-box crop centred on
 *    the chest and left the face a sliver at the top. The ink-box path is
 *    still the fallback when no face clears the detector's confidence bar.
 *
 *  - The threshold, chosen per image (Otsu's method, computeOtsu below).
 *    A fixed cutoff turned dark oil paintings and low-key photos into a
 *    near-solid blob and blew out bright engravings.
 *
 * processScored also returns a legibility score and whether a face was
 * found, so scripts/process-author-portraits.ts and
 * scripts/ensure-author-portrait.ts can pick the best of several
 * downloaded candidates — and reject a whole batch — on their own.
 */

const SIZE = 900;
const WORKING_SIZE = 1200;
/** Frame size for the face-detection pass — see the note where it's used. */
const DETECT_SIZE = 1000;
const BLUR_SIGMA = 2.2;
const CONTENT_DENSITY = 0.004;
const CROP_PADDING = 1.35;
/**
 * Ignore ink in this fraction of the frame at each edge when finding the
 * content box — a scan border, a painting's frame, or a caption strip
 * lives right at the edge and would otherwise anchor the crop to the whole
 * image and leave the actual face tiny.
 */
const EDGE_MARGIN = 0.03;
const MIN_SPECK_PIXELS = 10;
/**
 * Head-and-shoulders crop built around a detected face: a square this many
 * times the face-box side, with the face centred horizontally and sitting
 * ~40% of the way down (so the crop keeps forehead/hair above and collar/
 * shoulders below). Tuned against seated and full-length engravings where
 * the face is a small part of the frame.
 */
const FACE_CROP_SCALE = 2.8;
const FACE_CROP_TOP_BIAS = 0.42;
/** Only used if Otsu degenerates (a flat, single-value image). */
const FALLBACK_THRESHOLD = 128;

type Box = { left: number; top: number; width: number; height: number };

/**
 * Otsu's method — the 8-bit threshold that maximises between-class
 * variance, i.e. the cleanest split of this specific histogram into
 * "ink" and "paper". No parameters, no per-image tuning.
 */
function computeOtsu(gray: Buffer | Uint8Array): number {
  const histogram = new Array(256).fill(0);
  for (let i = 0; i < gray.length; i++) histogram[gray[i]]++;
  const total = gray.length;

  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * histogram[t];

  let sumB = 0;
  let weightB = 0;
  let maxBetween = -1;
  let threshold = FALLBACK_THRESHOLD;

  for (let t = 0; t < 256; t++) {
    weightB += histogram[t];
    if (weightB === 0) continue;
    const weightF = total - weightB;
    if (weightF === 0) break;

    sumB += t * histogram[t];
    const meanB = sumB / weightB;
    const meanF = (sum - sumB) / weightF;
    const between = weightB * weightF * (meanB - meanF) * (meanB - meanF);
    if (between > maxBetween) {
      maxBetween = between;
      threshold = t;
    }
  }

  return threshold;
}

/** In-place: everything at or below `threshold` becomes 0 (ink), the rest 255 (paper). */
function applyThreshold(gray: Buffer, threshold: number): void {
  for (let i = 0; i < gray.length; i++) gray[i] = gray[i] <= threshold ? 0 : 255;
}

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

  const marginY = Math.round(height * EDGE_MARGIN);
  const marginX = Math.round(width * EDGE_MARGIN);
  const rowDense = (y: number) => y >= marginY && y < height - marginY && rowCount[y] / width > CONTENT_DENSITY;
  const colDense = (x: number) => x >= marginX && x < width - marginX && colCount[x] / height > CONTENT_DENSITY;

  let top = -1;
  for (let y = 0; y < height; y++) {
    if (rowDense(y)) { top = y; break; }
  }
  let bottom = -1;
  for (let y = height - 1; y >= 0; y--) {
    if (rowDense(y)) { bottom = y; break; }
  }
  let left = -1;
  for (let x = 0; x < width; x++) {
    if (colDense(x)) { left = x; break; }
  }
  let right = -1;
  for (let x = width - 1; x >= 0; x--) {
    if (colDense(x)) { right = x; break; }
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

/**
 * Head-and-shoulders square around a detected face centre (all inputs in
 * pixels). Clamped to the frame; if the ideal square doesn't fit, it
 * shrinks rather than sliding the face off-centre.
 */
function faceCropBox(faceCx: number, faceCy: number, facePx: number, imgWidth: number, imgHeight: number): Box {
  let side = Math.round(facePx * FACE_CROP_SCALE);
  side = Math.min(side, imgWidth, imgHeight);
  const left = Math.max(0, Math.min(Math.round(faceCx - side / 2), imgWidth - side));
  const top = Math.max(0, Math.min(Math.round(faceCy - side * FACE_CROP_TOP_BIAS), imgHeight - side));
  return { left, top, width: side, height: side };
}

/**
 * How "portrait-like" a finished stencil is, 0–1. A legible head-and-
 * shoulders mark covers roughly a quarter to a half of the frame in one
 * connected mass; a near-empty frame, a solid black slab, or a scatter of
 * disconnected fragments all score low. Used only to rank candidates —
 * the final call still belongs to whoever (or whatever) reviews the
 * staged image.
 */
function legibilityScore(alpha: Buffer, size: number): number {
  let ink = 0;
  for (let i = 0; i < alpha.length; i++) {
    if (alpha[i] === 255) ink++;
  }
  const coverage = ink / alpha.length;

  // Triangular preference: peaks at ~28% coverage, zero outside 6%–62%.
  const IDEAL = 0.28;
  const coverageScore =
    coverage <= 0.06 || coverage >= 0.62
      ? 0
      : coverage < IDEAL
        ? (coverage - 0.06) / (IDEAL - 0.06)
        : (0.62 - coverage) / (0.62 - IDEAL);

  // Consolidation: what fraction of the ink is in its single largest
  // connected component. A real portrait is basically one shape.
  const visited = new Uint8Array(alpha.length);
  const stack: number[] = [];
  let largest = 0;
  for (let start = 0; start < alpha.length; start++) {
    if (visited[start] || alpha[start] !== 255) continue;
    let count = 0;
    stack.push(start);
    visited[start] = 1;
    while (stack.length > 0) {
      const idx = stack.pop()!;
      count++;
      const x = idx % size;
      if (x > 0 && !visited[idx - 1] && alpha[idx - 1] === 255) {
        visited[idx - 1] = 1;
        stack.push(idx - 1);
      }
      if (x < size - 1 && !visited[idx + 1] && alpha[idx + 1] === 255) {
        visited[idx + 1] = 1;
        stack.push(idx + 1);
      }
      if (idx - size >= 0 && !visited[idx - size] && alpha[idx - size] === 255) {
        visited[idx - size] = 1;
        stack.push(idx - size);
      }
      if (idx + size < alpha.length && !visited[idx + size] && alpha[idx + size] === 255) {
        visited[idx + size] = 1;
        stack.push(idx + size);
      }
    }
    if (count > largest) largest = count;
  }
  const consolidation = ink === 0 ? 0 : largest / ink;

  return coverageScore * (0.35 + 0.65 * consolidation);
}

export type ScoredPortrait = { png: Buffer; score: number; faceFound: boolean };

/** Buffer in (any format sharp reads), PNG stencil + legibility score out. */
export async function processPortraitScored(source: Buffer): Promise<ScoredPortrait> {
  const smoothed = sharp(source)
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .resize({ width: WORKING_SIZE, height: WORKING_SIZE, fit: "inside", withoutEnlargement: true })
    .blur(BLUR_SIGMA)
    .grayscale()
    .normalize();

  const { data: roughGray, info: roughInfo } = await smoothed
    .clone()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = roughInfo;

  // Face detection runs on its own render: no BLUR_SIGMA (the pass that
  // makes thresholding clean also softens the edges pico keys on) and
  // sized for the detector (DETECT_SIZE — pico's window has a fixed 24px
  // floor, so a smaller frame resolves a proportionally larger face).
  // Prefer a crop anchored on the detected face; fall back to the ink
  // bounding box when the detector finds nothing it's confident in.
  const { data: detectGray, info: detectInfo } = await sharp(source)
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .resize({ width: DETECT_SIZE, height: DETECT_SIZE, fit: "inside", withoutEnlargement: true })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const detected = detectFace(detectGray, detectInfo.width, detectInfo.height);
  // Map the normalised face box onto the (larger) working frame.
  const face = detected
    ? { cx: detected.cx * width, cy: detected.cy * height, px: detected.size * Math.min(width, height) }
    : null;
  let crop: Box | null;
  if (face) {
    crop = faceCropBox(face.cx, face.cy, face.px, width, height);
  } else {
    const roughBinary = Buffer.from(roughGray);
    applyThreshold(roughBinary, computeOtsu(roughGray));
    const roughBg = backgroundValue(roughBinary);
    removeSpecks(roughBinary, width, height, roughBg);
    const box = contentBox(roughBinary, width, height, roughBg);
    crop = box ? squareCropFor(box, width, height) : null;
  }

  const croppedGray = crop
    ? await smoothed.clone().extract(crop).raw().toBuffer({ resolveWithObject: true })
    : null;
  const finalPipeline = croppedGray
    ? sharp(croppedGray.data, {
        raw: { width: croppedGray.info.width, height: croppedGray.info.height, channels: 1 },
      }).grayscale()
    : smoothed.clone();
  const { data: finalGray } = await finalPipeline
    .resize(SIZE, SIZE, { fit: "cover" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const finalBinary = Buffer.from(finalGray);
  applyThreshold(finalBinary, computeOtsu(finalGray));
  const finalBg = backgroundValue(finalBinary);
  removeSpecks(finalBinary, SIZE, SIZE, finalBg);

  const alpha = Buffer.alloc(SIZE * SIZE);
  for (let i = 0; i < finalBinary.length; i++) {
    alpha[i] = finalBinary[i] === finalBg ? 0 : 255;
  }

  const png = await sharp({ create: { width: SIZE, height: SIZE, channels: 3, background: { r: 0, g: 0, b: 0 } } })
    .joinChannel(alpha, { raw: { width: SIZE, height: SIZE, channels: 1 } })
    .png()
    .toBuffer();

  return { png, score: legibilityScore(alpha, SIZE), faceFound: face !== null };
}

/** Buffer in (any format sharp reads), PNG buffer out — same stencil format AuthorMark's mask-image expects. */
export async function processPortraitBuffer(source: Buffer): Promise<Buffer> {
  return (await processPortraitScored(source)).png;
}
