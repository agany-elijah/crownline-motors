import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      /**
       * Keeps staff and authentication routes out of search results.
       *
       * This is housekeeping, not a security control. SECURITY.MD §46 is
       * explicit that robots.txt is not an authorisation mechanism — a
       * crawler that ignores it, or anyone who simply types the URL, reaches
       * the same routes. What actually protects them is `requireAdmin()` in
       * src/lib/auth/admin-guard.ts, applied on every admin page, plus the
       * `robots: { index: false }` metadata on the admin layout.
       *
       * Worth doing anyway: an indexed /admin/login is a free list of
       * targets for credential-stuffing campaigns.
       */
      disallow: ["/admin", "/admin/", "/auth/"],
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
