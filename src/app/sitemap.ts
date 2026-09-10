import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";

/**
 * The site's static routes.
 *
 * Individual vehicle and spare-part pages are deliberately absent for now:
 * both are database-driven and both are individually indexable through the
 * catalogues that link them, and generating those entries means a database
 * read inside a route that Next renders at build time. That is Stage 34 work
 * and belongs with the rest of the technical SEO, done once for both product
 * domains rather than twice.
 *
 * The two catalogue routes carry the highest priority after the homepage and
 * a daily change frequency, because they are the pages whose contents
 * actually change as stock moves.
 */
export default function sitemap(): MetadataRoute.Sitemap {
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
