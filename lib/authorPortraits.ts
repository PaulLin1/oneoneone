/**
 * Explicit, hand-maintained list — mirrors the static-config pattern in
 * lib/categoryColor.ts. A portrait is a processed static asset in
 * public/authors/, not editorial content, so there's no database table or
 * file-existence check: an author is either in this set (and the file
 * exists) or isn't (and nothing renders). Works identically in client and
 * server components.
 *
 * Every image here has been cropped from a verified public-domain source,
 * then reduced to the same flat black-and-white treatment (no gray
 * gradient, no sepia, no grain) so wildly different source material — an
 * 1849 daguerreotype, an 1890s studio photo, a 1907 portrait — reads as one
 * consistent graphic mark instead of "an old photo."
 *
 * The four originals were hand-processed. The rest came from
 * `npm run fetch-author-portrait` + `scripts/process-author-portraits.ts`
 * (auto-crop toward the most "interesting" region + threshold) — a
 * mechanical pass, not a human eye, so it doesn't bat 1.000: run against
 * all 26 catalog authors, 8 came out unusable (subject too small against a
 * blank-margin source photo, or a degraded/halftone scan) and were deleted
 * rather than shipped looking broken — Dickinson, Chesterton, Thoreau,
 * Melville, Keats, O. Henry, Whitman, and Shakespeare currently have no
 * portrait for that reason, not because one wasn't attempted. Re-run
 * fetch + process for any of them, by hand, whenever someone wants to sit
 * down and crop a better source image.
 */
const AUTHORS_WITH_PORTRAIT = new Set<string>([
  "Edgar Allan Poe",
  "Paul Laurence Dunbar",
  "W. E. B. Du Bois",
  "Ambrose Bierce",
  "Charlotte Perkins Gilman",
  "Christina Rossetti",
  "Francis Bacon",
  "Guy de Maupassant",
  "Kate Chopin",
  "Mark Twain",
  "Percy Bysshe Shelley",
  "Ralph Waldo Emerson",
  "Robert Frost",
  "Robert Louis Stevenson",
  "Saki (H. H. Munro)",
  "W. W. Jacobs",
  "William Blake",
  "William Butler Yeats",
  "William Hazlitt",
]);

export function authorSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.()]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function authorPortraitSrc(name: string): string | null {
  if (!AUTHORS_WITH_PORTRAIT.has(name)) return null;
  return `/authors/${authorSlug(name)}.png`;
}
