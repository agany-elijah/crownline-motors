import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";
import { getPublicSiteSettings } from "@/lib/queries/settings.queries";

/**
 * The site's static routes.
 *
 * Individual vehicle and spare-part pages are deliberately absent for now:
 * both are database-driven and both are individually indexable through the
 * catalogues that link them. Generating those entries is Stage 34 work and
 * belongs with the rest of the technical SEO, done once for both domains.
 *
 * Settings → SEO & social can switch the sitemap off, or indexing off
 * altogether; either publishes an empty sitemap, which is valid XML that
 * lists nothing, and robots.txt stops advertising it.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { seo } = await getPublicSiteSettings();

  if (!seo.sitemapEnabled || !seo.indexingEnabled) {
    return [];
  }

  const catalogues = new Set(["/cars", "/spare-parts"]);

  const routes = [
    "/",
    "/cars",
    "/spare-parts",
    "/how-it-works",
    "/track-my-order",
    "/get-a-quote",
    "/about-us",
    "/contact",
  ];

  return routes.map((route) => ({
    url: `${siteConfig.url}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "/" || catalogues.has(route) ? "daily" : "monthly",
    priority: route === "/" ? 1 : catalogues.has(route) ? 0.9 : 0.7,
  }));
}
