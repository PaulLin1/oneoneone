import { test } from "node:test";
import assert from "node:assert/strict";
import { authorSlug } from "@/lib/authorPortraits";

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
