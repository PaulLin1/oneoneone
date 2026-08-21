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
 */
const AUTHORS_WITH_PORTRAIT = new Set<string>([
  "Edgar Allan Poe",
  "Paul Laurence Dunbar",
  "W. E. B. Du Bois",
  "Ambrose Bierce",
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
