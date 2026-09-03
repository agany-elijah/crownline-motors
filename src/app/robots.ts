import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      /**
       * Keeps the authentication callback out of search results.
       *
       * ⚠️ The administrator dashboard is deliberately NOT listed here.
       *
       * It used to be, when it lived at /admin — a path every scanner tries
       * anyway, so naming it cost nothing. It now lives at an unguessable
       * segment (see src/lib/constants/admin-routes.ts), and robots.txt is a
       * world-readable file at a fixed address: a `Disallow:` line would
       * publish that segment to precisely the automated traffic the rename
       * exists to shake off. Scanners read robots.txt for exactly this
       * reason. Do not add it back.
       *
       * Staff pages stay out of search results through the
       * `robots: { index: false, follow: false }` metadata on the admin
       * layout, which is served with the pages themselves rather than
       * advertised in advance.
       *
       * None of this is a security control. SECURITY.MD §46 is explicit that
       * robots.txt is not an authorisation mechanism, and obscurity is not
       * either. What actually protects those routes is `requireAdmin()` in
       * src/lib/auth/admin-guard.ts, applied on every admin page and action.
       */
      disallow: ["/auth/"],
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
