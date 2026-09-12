import cascadeFile from "./facefinderCascade.json";
import { clusterDetections, runCascade, unpackCascade, type GrayImage } from "./pico";

/**
 * Face location as a fraction of the source frame (0–1), plus the raw pico
 * confidence of the winning cluster. `cx`/`cy` are the face centre, `size`
 * the face box side.
 */
export type FaceBox = { cx: number; cy: number; size: number; confidence: number };

// pico's confidence is an unbounded sum of tree votes. A crisp photo face
// clears 50+; a face in a soft 19th-century engraving or oil painting can
// sit as low as ~20. We keep the bar there and lean on the geometric
// sanity check below (a portrait's face is near the centre and a sane
// fraction of the frame) to throw out texture false-positives on
// hair/lace/foliage. A missed face just falls back to the ink-box crop.
const MIN_CONFIDENCE = 18;

// Where a real portrait's face actually sits, as a fraction of the frame.
const MIN_FACE_FRACTION = 0.04;
const MAX_FACE_FRACTION = 0.7;
// The face centre must be inside this centred box (edges are where scan
// borders, frames and captions produce phantom detections).
const CENTRE_INSET = 0.12;

// The cascade only needs enough resolution to resolve a face; downscaling
// first is what keeps the multi-scale sweep fast enough to run per
// candidate in the pipeline.
const DETECT_MAX_DIM = 1000;

let cachedClassifier: ReturnType<typeof unpackCascade> | null = null;

function classifier() {
  if (!cachedClassifier) {
    const bytes = new Int8Array(Buffer.from(cascadeFile.cascadeBase64, "base64"));
    cachedClassifier = unpackCascade(bytes);
  }
  return cachedClassifier;
}

/**
 * Run the pico face detector over a greyscale frame. Returns the most
 * confident face (normalised to the frame) above {@link MIN_CONFIDENCE}, or
 * null when nothing clears the bar.
 *
 * `gray` is one byte per pixel, row-major, tightly packed (`ldim === width`).
 */
export function detectFace(gray: Uint8Array, width: number, height: number): FaceBox | null {
  const scale = Math.min(1, DETECT_MAX_DIM / Math.max(width, height));

  let image: GrayImage;
  let w: number;
  let h: number;
  if (scale === 1) {
    image = { pixels: gray, nrows: height, ncols: width, ldim: width };
    w = width;
    h = height;
  } else {
    w = Math.round(width * scale);
    h = Math.round(height * scale);
    const down = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      const sy = Math.min(height - 1, Math.floor(y / scale));
      for (let x = 0; x < w; x++) {
        const sx = Math.min(width - 1, Math.floor(x / scale));
        down[y * w + x] = gray[sy * width + sx];
      }
    }
    image = { pixels: down, nrows: h, ncols: w, ldim: w };
  }

  const minDim = Math.min(w, h);
  const raw = runCascade(image, classifier(), {
    shiftfactor: 0.1,
    minsize: Math.max(24, Math.round(minDim * 0.08)),
    maxsize: minDim,
    scalefactor: 1.1,
  });

  const candidate = clusterDetections(raw, 0.2)
    .map(([r, c, s, q]): FaceBox => ({ cx: c / w, cy: r / h, size: s / minDim, confidence: q }))
    .filter(
      (f) =>
        f.confidence >= MIN_CONFIDENCE &&
        f.size >= MIN_FACE_FRACTION &&
        f.size <= MAX_FACE_FRACTION &&
        f.cx >= CENTRE_INSET &&
        f.cx <= 1 - CENTRE_INSET &&
        f.cy >= CENTRE_INSET &&
        f.cy <= 1 - CENTRE_INSET
    )
    .sort((a, b) => b.confidence - a.confidence);

  return candidate[0] ?? null;
}
