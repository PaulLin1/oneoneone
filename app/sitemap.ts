import type { MetadataRoute } from "next";
import { buildArchiveDays, getPublishedPicks } from "@/lib/dailyPicks";
import { SITE_URL } from "@/lib/site";
import type { WorkCategory } from "@/lib/types";

const CATEGORIES: WorkCategory[] = ["poem", "essay", "story"];

// Depends on "today" (via buildArchiveDays), same reason app/archive/page.tsx
// opts out of static generation — frozen at build time, this would stop
// listing new archive days the moment it was first deployed.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const days = buildArchiveDays(await getPublishedPicks());

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "daily" },
    { url: `${SITE_URL}/archive`, changeFrequency: "daily" },
    { url: `${SITE_URL}/about`, changeFrequency: "yearly" },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly" },
  ];

  const archiveEntries: MetadataRoute.Sitemap = days.flatMap(({ day, date }) =>
    CATEGORIES.map((category) => ({
      url: `${SITE_URL}/archive/${day}/${category}`,
      lastModified: date,
      changeFrequency: "yearly" as const,
    }))
  );

  return [...staticEntries, ...archiveEntries];
}
