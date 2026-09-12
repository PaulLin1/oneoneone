import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { processPortraitScored } from "@/lib/portraitProcessing";
import { detectFace } from "@/lib/portrait/faceDetect";

/** A real public-domain portrait photograph (Edgar Allan Poe, 1849 daguerreotype). */
const PORTRAIT_PHOTO = readFileSync(path.join(import.meta.dirname, "fixtures", "portrait-photo.jpg"));

/** A dark head-and-shoulders blob on a light ground — no real facial texture. */
async function fakePortrait(): Promise<Buffer> {
  const w = 800;
  const h = 1000;
  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${w}" height="${h}" fill="#f2f0ec"/>
    <ellipse cx="${w / 2}" cy="${h * 0.38}" rx="${w * 0.22}" ry="${h * 0.22}" fill="#1c1c1c"/>
    <ellipse cx="${w / 2}" cy="${h * 0.82}" rx="${w * 0.38}" ry="${h * 0.3}" fill="#1c1c1c"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

test("detectFace locates the face in a real portrait photo", async () => {
  const { data, info } = await sharp(PORTRAIT_PHOTO)
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .resize({ width: 1000, height: 1000, fit: "inside", withoutEnlargement: true })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const face = detectFace(data, info.width, info.height);
  assert.ok(face, "expected a detected face");
  // Poe's head sits slightly left of centre, upper half of the frame.
  assert.ok(face!.cx > 0.2 && face!.cx < 0.8, `face cx off: ${face!.cx.toFixed(2)}`);
  assert.ok(face!.cy > 0.1 && face!.cy < 0.6, `face cy off: ${face!.cy.toFixed(2)}`);
  assert.ok(face!.size > 0.1 && face!.size < 0.7, `face size off: ${face!.size.toFixed(2)}`);
});

test("detectFace returns null on an image with no face", async () => {
  const { data, info } = await sharp(await fakePortrait())
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert.equal(detectFace(data, info.width, info.height), null);
});

test("processPortraitScored turns a real portrait photo into a face-anchored stencil", async () => {
  const { png, score, faceFound } = await processPortraitScored(PORTRAIT_PHOTO);

  const meta = await sharp(png).metadata();
  assert.equal(meta.width, 900);
  assert.equal(meta.height, 900);
  assert.equal(meta.hasAlpha, true);

  assert.equal(faceFound, true, "the crop should be anchored on a detected face");
  assert.ok(score > 0.3, `expected a strong portrait score, got ${score.toFixed(3)}`);
});

test("processPortraitScored falls back to the ink bounding box when no face is found", async () => {
  const { png, score, faceFound } = await processPortraitScored(await fakePortrait());

  assert.equal(faceFound, false);
  assert.equal((await sharp(png).metadata()).width, 900);
  // The fallback still has to produce a usable stencil — that gap over a
  // blank frame is what lets process-author-portraits.ts rank candidates.
  assert.ok(score > 0.2, `expected a portrait-like score, got ${score.toFixed(3)}`);
});

test("processPortraitScored scores a near-empty frame low", async () => {
  const blank = await sharp({
    create: { width: 600, height: 600, channels: 3, background: { r: 245, g: 245, b: 245 } },
  })
    .png()
    .toBuffer();

  const { score } = await processPortraitScored(blank);
  assert.ok(score < 0.15, `expected a low score for a blank image, got ${score.toFixed(3)}`);
});
