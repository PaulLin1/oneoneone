import { test } from "node:test";
import assert from "node:assert/strict";
import { isPublicDomainByYear, isPublicDomainByAuthorDeath, computeRightsStatus } from "@/lib/rights";

// Pinned "now" so this suite doesn't quietly start failing (or silently
// start passing things it shouldn't) as real time moves forward — the
// whole point of lib/rights.ts is that the PD bar rolls forward every
// year, so the tests fix a reference date and check the math at that
// point, not "whatever year it happens to be when this runs."
const NOW = new Date("2026-06-01T00:00:00Z");

test("isPublicDomainByYear: exactly 96 years ago clears the bar", () => {
  assert.equal(isPublicDomainByYear(1930, NOW), true);
});

test("isPublicDomainByYear: 95 years ago does not clear the bar", () => {
  assert.equal(isPublicDomainByYear(1931, NOW), false);
});

test("isPublicDomainByYear: null year is never public domain", () => {
  assert.equal(isPublicDomainByYear(null, NOW), false);
});

test("isPublicDomainByAuthorDeath: exactly 70 years since death clears the bar", () => {
  assert.equal(isPublicDomainByAuthorDeath(1956, NOW), true);
});

test("isPublicDomainByAuthorDeath: 69 years since death does not clear the bar", () => {
  assert.equal(isPublicDomainByAuthorDeath(1957, NOW), false);
});

test("isPublicDomainByAuthorDeath: null death year is never public domain", () => {
  assert.equal(isPublicDomainByAuthorDeath(null, NOW), false);
});

test("computeRightsStatus: neither year nor death year clears the bar -> unverified", () => {
  assert.equal(
    computeRightsStatus({ publicationYear: 2000, authorDeathYear: 2010 }),
    "unverified"
  );
});

test("computeRightsStatus: publication year alone clears the bar -> public_domain", () => {
  assert.equal(computeRightsStatus({ publicationYear: 1900 }), "public_domain");
});

test("computeRightsStatus: death year alone clears the bar (year unknown) -> public_domain", () => {
  assert.equal(
    computeRightsStatus({ publicationYear: null, authorDeathYear: 1900 }),
    "public_domain"
  );
});

test("computeRightsStatus: nothing known -> unverified, never assumed", () => {
  assert.equal(computeRightsStatus({ publicationYear: null }), "unverified");
});
