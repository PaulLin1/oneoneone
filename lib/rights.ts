// U.S. works enter the public domain on January 1 of the year 96 years after
// publication (currently: works published in 1930 entered the public domain
// on 2026-01-01). This rolls forward every year, unlike a fixed cutoff —
// compute it, don't hardcode a year that goes stale.
const US_PD_TERM_YEARS = 96;

// Conservative floor for death-year-based PD reasoning (the international
// Berne Convention minimum of life + 70), used only as a fallback when
// publication year is unknown.
const LIFE_PLUS_YEARS = 70;

export type RightsStatus = "public_domain" | "licensed" | "unverified";

export function isPublicDomainByYear(publicationYear: number | null, now: Date = new Date()): boolean {
  if (publicationYear === null) return false;
  return publicationYear <= now.getFullYear() - US_PD_TERM_YEARS;
}

export function isPublicDomainByAuthorDeath(authorDeathYear: number | null, now: Date = new Date()): boolean {
  if (authorDeathYear === null) return false;
  return now.getFullYear() - authorDeathYear >= LIFE_PLUS_YEARS;
}

/**
 * Never assume public domain from absence of evidence — this returns
 * 'unverified' unless the year math actually clears the bar, so a reviewer
 * has to make an explicit call (see scripts/promote-candidate.ts --force-pd)
 * rather than the pipeline silently defaulting to true.
 */
export function computeRightsStatus(params: {
  publicationYear: number | null;
  authorDeathYear?: number | null;
}): RightsStatus {
  const { publicationYear, authorDeathYear = null } = params;
  if (isPublicDomainByYear(publicationYear) || isPublicDomainByAuthorDeath(authorDeathYear)) {
    return "public_domain";
  }
  return "unverified";
}
