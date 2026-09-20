import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchSucceeded, publishSucceeded } from "@/scripts/ensure-author-portrait";

test("fetchSucceeded: ok exit code and the expected substring -> true", () => {
  assert.equal(fetchSucceeded({ ok: true, output: "found 3 candidate(s): a.jpg, b.jpg" }), true);
});

test("fetchSucceeded: non-zero exit code is never a success, even if the substring is present", () => {
  // A real bug this guards against: partial stdout printed before a crash
  // could still contain "candidate(s):" even though the process failed.
  assert.equal(fetchSucceeded({ ok: false, output: "found 3 candidate(s): a.jpg" }), false);
});

test("fetchSucceeded: ok exit code but no candidates printed -> false", () => {
  assert.equal(fetchSucceeded({ ok: true, output: "no usable candidate images found" }), false);
});

test("publishSucceeded: ok exit code and the expected substring -> true", () => {
  assert.equal(publishSucceeded({ ok: true, output: "→ https://example.com/a.png" }), true);
});

test("publishSucceeded: non-zero exit code is never a success, even if the substring is present", () => {
  assert.equal(publishSucceeded({ ok: false, output: "→ https://example.com/a.png" }), false);
});

test("publishSucceeded: ok exit code but no published URL printed -> false", () => {
  assert.equal(publishSucceeded({ ok: true, output: "nothing happened" }), false);
});
