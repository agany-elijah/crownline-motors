import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    "/",
    "/cars",
    "/how-it-works",
    "/track-my-vehicle",
    "/get-a-quote",
    "/about-us",
    "/contact",
  ];

  return routes.map((route) => ({
    url: `${siteConfig.url}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "/" || route === "/cars" ? "daily" : "monthly",
    priority: route === "/" ? 1 : route === "/cars" ? 0.9 : 0.7,
  }));
}
