import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://bandit.dev";
const NOW = new Date();

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE}/`, lastModified: NOW, changeFrequency: "weekly", priority: 1.0 },
    { url: `${SITE}/signup`, lastModified: NOW, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE}/signin`, lastModified: NOW, changeFrequency: "yearly", priority: 0.4 },
    { url: `${SITE}/privacy`, lastModified: NOW, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE}/terms`, lastModified: NOW, changeFrequency: "yearly", priority: 0.3 },
  ];
}
