import type { NextConfig } from "next";
import { PHASE_PRODUCTION_SERVER } from "next/constants";

/**
 * Baseline security headers (SECURITY.MD §25, §26).
 *
 * A full Content-Security-Policy is Stage 36 work: it needs a nonce
 * strategy for Next.js's inline bootstrap scripts and a pass over every
 * third-party origin the finished site loads, and a CSP guessed at now
 * would either be too loose to help or would break pages as they are built.
 *
 * What is here is the subset that is correct regardless of what the site
 * grows into, and that costs nothing to apply early.
 */
const baseSecurityHeaders = [
  {
    // Two years, subdomains included, preload-eligible. Cloudflare and
    // Vercel both terminate TLS in front of this app, so the header is
    // about instructing browsers never to try HTTP again — not about
    // redirecting, which the platform already handles.
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    // Stops a browser second-guessing a declared Content-Type. Relevant the
    // moment customer-uploaded vehicle photos and payment receipts are
    // served (Stage 9): a file claiming to be an image must never be
    // sniffed into being executed as script.
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    // Send the full URL only to our own origin. Cross-origin requests get
    // the bare origin, so a tracking reference or an admin path never
    // travels in a Referer header to a third party.
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    // Nothing in this application uses these, and denying them means a
    // compromised embedded script cannot start.
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

/**
 * Framing protection.
 *
 * `frame-ancestors` is the CSP directive that supersedes X-Frame-Options,
 * but not every browser and scanner honours a lone CSP, so both are sent.
 * A CSP carrying only this directive adds no restrictions on scripts or
 * styles, so it can ship now without waiting for the full policy above.
 */
const framingHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
];

/**
 * Cache-Control for admin and auth routes is deliberately NOT set here.
 * Next.js writes its own `Cache-Control` onto dynamic responses, and that
 * value overrides anything configured in this file. The directive is applied
 * in src/lib/supabase/proxy.ts instead, which runs last and therefore wins.
 */

/**
 * Origins permitted to invoke Server Actions, beyond the app's own.
 *
 * Next.js defends Server Actions against CSRF by comparing the request's
 * `Origin` header against `X-Forwarded-Host` (falling back to `Host`) and
 * rejecting mismatches with "Invalid Server Actions request". That is a
 * genuine security control, and its default — same-origin only — is right.
 *
 * A GitHub Codespace breaks that comparison without breaking the security
 * property, because the two headers come from different places:
 *
 *   - `Origin` is whatever the browser has in its address bar. With desktop
 *     VS Code port forwarding that is `localhost:3000`; in the browser
 *     editor it is the public `…app.github.dev` host.
 *   - `X-Forwarded-Host` is stamped by the Codespaces tunnel, and is the
 *     public host in *both* cases.
 *
 * So the pair disagrees whenever the browser is on localhost, and every
 * sign-in and password-reset submission is rejected as forged.
 *
 * `allowedOrigins` is matched against the ORIGIN host, not the forwarded
 * host (see isCsrfOriginAllowed in next/dist/server/app-render/
 * csrf-protection.js) — and it compares `new URL(origin).host`, so the port
 * is part of the value. Both browsing routes are legitimate during
 * development, so both origins are listed.
 *
 * Everything here is development-only. The production guard is
 * belt-and-braces: these variables should never exist in a deployment, and
 * if they somehow did, loosening CSRF on the live admin dashboard is not a
 * failure mode worth risking. Never widen this to a bare wildcard, and never
 * add a domain the project does not control — an entry here is permission
 * for that origin to submit forms as a signed-in administrator.
 */
function developmentServerActionOrigins(phase: string): string[] | undefined {
  const inCodespace = process.env.CODESPACES === "true";

  if (process.env.NODE_ENV === "production") {
    /**
     * Production keeps Next's default — same-origin only — and that is not
     * negotiable. But a production server *inside* a Codespace hits the same
     * header mismatch with no allowlist to rescue it, and the resulting
     * "Invalid Server Actions request" looks like an application fault
     * rather than a browsing-address problem. Say which it is.
     */
    if (inCodespace && phase === PHASE_PRODUCTION_SERVER) {
      console.warn(
        "[next.config] Production server inside a Codespace. Server Actions " +
          "sent from http://localhost will be rejected as cross-origin, " +
          "because the tunnel stamps x-forwarded-host with the public " +
          "*.app.github.dev host. Browse the forwarded https://…app.github.dev " +
          "URL instead — or use `npm run dev`, which allows both."
      );
    }

    return undefined;
  }

  const codespace = process.env.CODESPACE_NAME;
  const domain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;

  if (!codespace || !domain) {
    /**
     * Say so, rather than returning undefined quietly. Without the allowlist
     * every Server Action in a Codespace aborts, and tracing that back to a
     * missing environment variable costs an afternoon. One line at startup
     * turns it into a one-line diagnosis.
     */
    if (inCodespace) {
      console.warn(
        "[next.config] Running in a Codespace, but CODESPACE_NAME / " +
          "GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN are not set in this " +
          "process. Server Actions will be rejected as cross-origin. Start " +
          "the dev server from a terminal where both are exported."
      );
    }

    return undefined;
  }

  /**
   * Ports, not a port.
   *
   * `next dev` moves to the next free port when 3000 is taken — by a
   * leftover server from an earlier session, most often — printing
   * "Port 3000 is in use ... using available port 3001 instead" and then
   * setting PORT to what it actually bound. The browser follows it and sends
   * `Origin: localhost:3001`, which a list containing only :3000 does not
   * match, and *every* Server Action starts failing with a CSRF abort that
   * has nothing to do with whatever was last changed.
   *
   * The bound port is not knowable with certainty here — this file is
   * evaluated as the server starts — so PORT seeds the list and the small
   * range `next dev` actually walks is included regardless.
   *
   * Widening it this way costs nothing in reach: every entry is either a
   * loopback address, which only this machine can originate, or a forwarded
   * host on the Codespace this code is running inside. It is still an
   * allowlist of exact `host:port` values — `localhost:9999` and
   * `localhost.attacker.example` both fail it.
   */
  const seed = Number.parseInt(process.env.PORT ?? "", 10);
  const walked = Array.from({ length: 10 }, (_, index) => 3000 + index);
  const seeded = Number.isFinite(seed)
    ? Array.from({ length: 3 }, (_, index) => seed + index)
    : [];

  const ports = [...new Set([...walked, ...seeded])];

  // Host only, no protocol — the shape `allowedOrigins` expects, and what
  // Next compares `new URL(origin).host` against (see isCsrfOriginAllowed in
  // next/dist/server/app-render/csrf-protection.js), so the port is part of
  // the value.
  return ports.flatMap((port) => [
    `${codespace}-${port}.${domain}`, // browser editor / forwarded URL
    `localhost:${port}`, // desktop VS Code port forwarding
    `127.0.0.1:${port}`, // same, when the browser resolves it numerically
  ]);
}

/**
 * Maximum Server Action request body.
 *
 * Next.js defaults this to 1MB, which is a sensible floor for form posts and
 * far too small for the one action that carries files: vehicle photograph
 * upload. Those bytes reach the server through a Server Action rather than a
 * browser-to-Supabase upload, because the storage bucket grants no write
 * access to any browser session — see src/lib/storage/vehicle-media.ts.
 *
 * The value must stay above MAX_UPLOAD_BATCH_BYTES in
 * src/lib/constants/vehicle-photo-options.ts (16MB), with headroom for the
 * multipart boundaries and part headers that do not count towards that
 * limit. Raise the two together, never one alone: a larger batch limit with
 * this value unchanged fails at the framework boundary, before the action's
 * own validation can produce a message anyone can act on.
 *
 * In practice a batch is nowhere near this: the dashboard re-encodes every
 * photograph in the browser before it is sent (see downscale-photo.ts), so a
 * full twelve-image walk-around is a few megabytes rather than sixty. This
 * ceiling is what an un-downscaled fallback is allowed to reach, not what a
 * normal upload weighs.
 */
const SERVER_ACTION_BODY_LIMIT = "20mb";

/**
 * Where remotely-hosted images may come from.
 *
 * Vehicle photographs are served from the project's Supabase Storage origin,
 * which varies per environment, so the host is derived from the same
 * variable the storage layer uses rather than hard-coded. `next/image`
 * refuses any origin not listed here, which is what stops the optimiser from
 * being used as an open proxy for arbitrary remote URLs.
 *
 * The path is narrowed to the public object route: nothing else on a
 * Supabase origin is an image we serve.
 */
function supabaseImagePatterns(): NonNullable<
  NonNullable<NextConfig["images"]>["remotePatterns"]
> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!url) return [];

  try {
    const { protocol, hostname } = new URL(url);

    return [
      {
        protocol: protocol.replace(":", "") as "http" | "https",
        hostname,
        pathname: "/storage/v1/object/public/**",
      },
    ];
  } catch {
    // A malformed value is a configuration error, not a reason to fail the
    // build — images simply will not load, which is the visible symptom that
    // leads someone to the variable.
    console.warn(
      "[next.config] NEXT_PUBLIC_SUPABASE_URL is not a valid URL; remote images are disabled."
    );
    return [];
  }
}

/**
 * Exported as a function of the phase, not as a plain object.
 *
 * The phase is the only reliable way to tell `next start` from `next build`
 * and `next typegen`: all three run with NODE_ENV=production and none of
 * them sets NEXT_PHASE in the environment. The Codespace warning in
 * developmentServerActionOrigins is addressed to someone whose Server
 * Actions are about to be rejected, so it must reach a running server and
 * stay out of every build log.
 */
export default function nextConfig(phase: string): NextConfig {
  const allowedOrigins = developmentServerActionOrigins(phase);

  return {
    experimental: {
      serverActions: {
        bodySizeLimit: SERVER_ACTION_BODY_LIMIT,
        ...(allowedOrigins ? { allowedOrigins } : {}),
      },
    },

    images: {
      remotePatterns: supabaseImagePatterns(),
      // AVIF first, WebP as the fallback. Both are far smaller than the
      // JPEGs an operator uploads, which is the difference between a
      // gallery that loads on a mobile connection in Juba and one that
      // does not (brief §19).
      formats: ["image/avif", "image/webp"],
    },

    async headers() {
      return [
        {
          // Public pages: framed nowhere either. Nothing on this site is meant
          // to be embedded, and clickjacking a "REQUEST THIS VEHICLE" button
          // is as real a risk as clickjacking an admin action.
          source: "/:path*",
          headers: [...baseSecurityHeaders, ...framingHeaders],
        },
        {
          /**
           * The one deliberate exception: the admin "Generate PDF" action
           * (quote-pdf-dialog.tsx) embeds this exact route in an `<iframe>`
           * on the quote detail page so an operator can review the document
           * without leaving it — a same-origin embed, by our own page, of
           * our own admin-authenticated route.
           *
           * `frame-ancestors 'none'`/`DENY` above refuses that too: neither
           * directive carries a same-origin exception the way `SAMEORIGIN`/
           * `'self'` do, so without this override the iframe silently
           * renders nothing. Scoped to this one route rather than loosened
           * globally — matched *after* the blanket rule above, so Next.js's
           * header merge lets these two keys override it here while every
           * other route keeps the harder `DENY`/`'none'`, including the
           * unrelated `/quotation/:token` customer PDF link, which is never
           * framed and stays fully protected.
           */
          source: "/api/quotes/:id/preview",
          headers: [
            { key: "X-Frame-Options", value: "SAMEORIGIN" },
            { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          ],
        },
      ];
    },

    async rewrites() {
      return [
        /**
         * The customer's quotation link, exactly the shape the schema
         * documentation promises (`Quote.shareToken`): `/quotation/<token>`.
         * It resolves to the API route rather than living in `app/quotation`
         * directly because the PDF renderer needs the Node runtime, which a
         * page route in this project does not otherwise require.
         */
        {
          source: "/quotation/:token",
          destination: "/api/quotations/:token",
        },
      ];
    },
  };
}
