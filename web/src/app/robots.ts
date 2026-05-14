import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://cartlift.codewithmuh.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Don't index gated dashboard or auth pages — they 401-redirect anyway,
        // but explicit disallow stops crawlers wasting budget.
        disallow: ["/dashboard", "/dashboard/", "/api/", "/s/"],
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
