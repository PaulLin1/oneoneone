import { test } from "node:test";
import assert from "node:assert/strict";
import { hashStringToInt, mulberry32 } from "@/lib/selection/rng";

test("hashStringToInt is deterministic for the same input", () => {
  assert.equal(hashStringToInt("oneoneone-rotation-v1:poem"), hashStringToInt("oneoneone-rotation-v1:poem"));
});

test("hashStringToInt is (in practice) different for different inputs", () => {
  assert.notEqual(hashStringToInt("poem"), hashStringToInt("essay"));
  assert.notEqual(hashStringToInt("poem"), hashStringToInt("story"));
});

test("hashStringToInt always returns a non-negative 32-bit integer", () => {
  for (const input of ["", "a", "oneoneone-rotation-v1:poem", "x".repeat(1000)]) {
    const h = hashStringToInt(input);
    assert.ok(Number.isInteger(h), `${input} -> ${h} should be an integer`);
    assert.ok(h >= 0 && h <= 0xffffffff, `${input} -> ${h} should be a valid uint32`);
  }
});

test("mulberry32 is deterministic: same seed -> same sequence", () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  const seqA = Array.from({ length: 10 }, () => a());
  const seqB = Array.from({ length: 10 }, () => b());
  assert.deepEqual(seqA, seqB);
});

test("mulberry32 produces different sequences for different seeds", () => {
  const a = mulberry32(1);
  const b = mulberry32(2);
  assert.notEqual(a(), b());
});

test("mulberry32 outputs stay within [0, 1)", () => {
  const rng = mulberry32(12345);
  for (let i = 0; i < 1000; i++) {
    const v = rng();
    assert.ok(v >= 0 && v < 1, `output ${v} should be in [0, 1)`);
  }
});
