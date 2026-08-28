import type { NextConfig } from "next";

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
function developmentServerActionOrigins(): string[] | undefined {
  if (process.env.NODE_ENV === "production") return undefined;

  const codespace = process.env.CODESPACE_NAME;
  const domain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;

  if (!codespace || !domain) return undefined;

  // Host only, no protocol — the shape `allowedOrigins` expects.
  // Port 3000 matches `next dev`; change these together if that moves.
  return [
    `${codespace}-3000.${domain}`, // browser editor / forwarded URL
    "localhost:3000", // desktop VS Code port forwarding
    "127.0.0.1:3000", // same, when the browser resolves it numerically
  ];
}

const allowedOrigins = developmentServerActionOrigins();

const nextConfig: NextConfig = {
  ...(allowedOrigins ? { experimental: { serverActions: { allowedOrigins } } } : {}),

  async headers() {
    return [
      {
        // Public pages: framed nowhere either. Nothing on this site is meant
        // to be embedded, and clickjacking a "REQUEST THIS VEHICLE" button
        // is as real a risk as clickjacking an admin action.
        source: "/:path*",
        headers: [...baseSecurityHeaders, ...framingHeaders],
      },
    ];
  },
};

export default nextConfig;
