import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: "daily" },
    { url: `${SITE_URL}/archive`, changeFrequency: "daily" },
    { url: `${SITE_URL}/about`, changeFrequency: "yearly" },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly" },
  ];
}
