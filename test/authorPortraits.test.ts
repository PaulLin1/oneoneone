import { test } from "node:test";
import assert from "node:assert/strict";
import { authorSlug, authorPortraitSrc } from "@/lib/authorPortraits";

test("authorSlug lowercases and hyphenates a plain name", () => {
  assert.equal(authorSlug("Edgar Allan Poe"), "edgar-allan-poe");
});

test("authorSlug strips periods and parentheses rather than hyphenating them", () => {
  assert.equal(authorSlug("Saki (H. H. Munro)"), "saki-h-h-munro");
  assert.equal(authorSlug("W. E. B. Du Bois"), "w-e-b-du-bois");
});

test("authorSlug collapses runs of non-alphanumeric characters into one hyphen", () => {
  assert.equal(authorSlug("Mark  --  Twain"), "mark-twain");
});

test("authorSlug has no leading or trailing hyphens", () => {
  assert.equal(authorSlug("(Anonymous)"), "anonymous");
});

test("authorPortraitSrc returns null for an author not in the set", () => {
  assert.equal(authorPortraitSrc("Someone Entirely Made Up XYZ"), null);
});

test("authorPortraitSrc returns the expected path for a known, permanent author", () => {
  // Edgar Allan Poe is one of the 4 original hand-processed portraits, not
  // subject to the automated pipeline adding/removing authors over time —
  // safe to assert on directly, unlike the mechanically-generated set.
  assert.equal(authorPortraitSrc("Edgar Allan Poe"), "/authors/edgar-allan-poe.png");
});
