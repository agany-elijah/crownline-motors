import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";
import { getPublicSiteSettings } from "@/lib/queries/settings.queries";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const { seo } = await getPublicSiteSettings();

  /**
   * Settings → SEO & social → Search engine indexing, off.
   *
   * Every page also carries `noindex` from the root metadata; this is the
   * crawler-side half, so a well-behaved crawler does not fetch pages only to
   * be told not to list them.
   */
  if (!seo.indexingEnabled) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      /**
       * Keeps the authentication callback out of search results.
       *
       * ⚠️ The administrator dashboard is deliberately NOT listed here.
       *
       * It lives at an unguessable segment (see
       * src/lib/constants/admin-routes.ts), and robots.txt is a world-readable
       * file at a fixed address: a `Disallow:` line would publish that segment
       * to precisely the automated traffic the rename exists to shake off.
       * Staff pages stay out of search results through the
       * `robots: { index: false, follow: false }` metadata on the admin layout.
       *
       * None of this is a security control (SECURITY.MD §46). What protects
       * those routes is `requireAdmin()`, applied on every admin page and
       * action.
       */
      disallow: ["/auth/"],
    },
    // Advertised only while the sitemap is published.
    ...(seo.sitemapEnabled ? { sitemap: `${siteConfig.url}/sitemap.xml` } : {}),
  };
}
