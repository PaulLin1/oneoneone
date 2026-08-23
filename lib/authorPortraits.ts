/**
 * Just the naming convention now — actual portrait display is DB-driven
 * (`authors.portrait_url`, joined through as `work.author_portrait_url`
 * via the works_feed view — see db/migrations/0006_portrait_urls.sql and
 * components/AuthorMark.tsx). This function is still what both
 * scripts/fetch-author-portrait.ts and scripts/process-author-portraits.ts
 * use to derive a stable R2 object key from an author's name.
 */
export function authorSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.()]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
