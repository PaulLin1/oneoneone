/*
 * Pico object-detection runtime — a TypeScript port of pico.js
 * (https://github.com/nenadmarkus/pico), MIT License, Copyright (c) 2013
 * Nenad Markus:
 *
 *   Permission is hereby granted, free of charge, to any person obtaining a
 *   copy of this software and associated documentation files (the
 *   "Software"), to deal in the Software without restriction... The above
 *   copyright notice and this permission notice shall be included in all
 *   copies or substantial portions of the Software.
 *
 * Only the parts we use are ported: cascade unpacking, a multi-scale sweep,
 * and non-maximum-suppression clustering. The frame-to-frame detection
 * memory helper (for video) is dropped. Behaviour is otherwise identical to
 * upstream — the odd `>> 8` integer divisions and `256 *` fixed-point are
 * kept exactly, they matter for the tree traversal.
 *
 * Paired with the `facefinder` cascade in ./facefinderCascade.ts.
 */

/** A greyscale frame: one byte per pixel, row-major, `ldim` bytes per row. */
export type GrayImage = { pixels: Uint8Array; nrows: number; ncols: number; ldim: number };

/** `[rowCentre, colCentre, size, score]`, all in pixels except the score. */
export type Detection = [number, number, number, number];

export type RunParams = {
  shiftfactor: number;
  minsize: number;
  maxsize: number;
  scalefactor: number;
};

/** `(row, col, size, pixels, ldim) => score` (negative means "not a match"). */
export type ClassifyRegion = (
  r: number,
  c: number,
  s: number,
  pixels: Uint8Array,
  ldim: number
) => number;

/** Parse a binary cascade file into a region classifier. */
export function unpackCascade(bytes: Int8Array): ClassifyRegion {
  const dview = new DataView(new ArrayBuffer(4));
  const readI32 = (p: number) => {
    for (let k = 0; k < 4; k++) dview.setUint8(k, bytes[p + k]);
    return dview.getInt32(0, true);
  };
  const readF32 = (p: number) => {
    for (let k = 0; k < 4; k++) dview.setUint8(k, bytes[p + k]);
    return dview.getFloat32(0, true);
  };

  // Skip 8 bytes of version / training metadata.
  let p = 8;
  const tdepth = readI32(p);
  p += 4;
  const ntrees = readI32(p);
  p += 4;

  const nodesPerTree = (1 << tdepth) - 1;
  const leavesPerTree = 1 << tdepth;

  const tcodesLs: number[] = [];
  const tpredsLs: number[] = [];
  const threshLs: number[] = [];

  for (let t = 0; t < ntrees; t++) {
    tcodesLs.push(0, 0, 0, 0);
    for (let i = 0; i < 4 * nodesPerTree; i++) tcodesLs.push(bytes[p + i]);
    p += 4 * nodesPerTree;

    for (let i = 0; i < leavesPerTree; i++) {
      tpredsLs.push(readF32(p));
      p += 4;
    }

    threshLs.push(readF32(p));
    p += 4;
  }

  const tcodes = new Int8Array(tcodesLs);
  const tpreds = new Float32Array(tpredsLs);
  const thresh = new Float32Array(threshLs);
  const pow2tdepth = leavesPerTree;

  return function classifyRegion(r, c, s, pixels, ldim) {
    r *= 256;
    c *= 256;
    let root = 0;
    let o = 0;

    for (let i = 0; i < ntrees; i++) {
      let idx = 1;
      for (let j = 0; j < tdepth; j++) {
        const a =
          pixels[
            (((r + tcodes[root + 4 * idx + 0] * s) >> 8) * ldim + ((c + tcodes[root + 4 * idx + 1] * s) >> 8))
          ];
        const b =
          pixels[
            (((r + tcodes[root + 4 * idx + 2] * s) >> 8) * ldim + ((c + tcodes[root + 4 * idx + 3] * s) >> 8))
          ];
        idx = 2 * idx + (a <= b ? 1 : 0);
      }

      o += tpreds[pow2tdepth * i + idx - pow2tdepth];
      if (o <= thresh[i]) return -1;

      root += 4 * pow2tdepth;
    }

    return o - thresh[ntrees - 1];
  };
}

/** Sweep the classifier over the frame at every scale/position. */
export function runCascade(image: GrayImage, classify: ClassifyRegion, params: RunParams): Detection[] {
  const { pixels, nrows, ncols, ldim } = image;
  const { shiftfactor, minsize, maxsize, scalefactor } = params;

  const detections: Detection[] = [];
  let scale = minsize;

  while (scale <= maxsize) {
    const step = Math.max(shiftfactor * scale, 1) >> 0;
    const offset = (scale / 2 + 1) >> 0;

    for (let r = offset; r <= nrows - offset; r += step) {
      for (let c = offset; c <= ncols - offset; c += step) {
        const q = classify(r, c, scale, pixels, ldim);
        if (q > 0) detections.push([r, c, scale, q]);
      }
    }

    scale *= scalefactor;
  }

  return detections;
}

/** Collapse overlapping raw detections into one representative each (NMS). */
export function clusterDetections(dets: Detection[], iouThreshold: number): Detection[] {
  const sorted = [...dets].sort((a, b) => b[3] - a[3]);

  const iou = (d1: Detection, d2: Detection) => {
    const [r1, c1, s1] = d1;
    const [r2, c2, s2] = d2;
    const overR = Math.max(0, Math.min(r1 + s1 / 2, r2 + s2 / 2) - Math.max(r1 - s1 / 2, r2 - s2 / 2));
    const overC = Math.max(0, Math.min(c1 + s1 / 2, c2 + s2 / 2) - Math.max(c1 - s1 / 2, c2 - s2 / 2));
    return (overR * overC) / (s1 * s1 + s2 * s2 - overR * overC);
  };

  const assigned = new Array(sorted.length).fill(false);
  const clusters: Detection[] = [];

  for (let i = 0; i < sorted.length; i++) {
    if (assigned[i]) continue;
    let r = 0;
    let c = 0;
    let s = 0;
    let q = 0;
    let n = 0;
    for (let j = i; j < sorted.length; j++) {
      if (iou(sorted[i], sorted[j]) > iouThreshold) {
        assigned[j] = true;
        r += sorted[j][0];
        c += sorted[j][1];
        s += sorted[j][2];
        q += sorted[j][3];
        n += 1;
      }
    }
    clusters.push([r / n, c / n, s / n, q]);
  }

  return clusters;
}
