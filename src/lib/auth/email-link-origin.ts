import "server-only"

import { headers } from "next/headers"

import { siteConfig } from "@/config/site"

/**
 * Absolute origin for links embedded in authentication emails — password
 * resets and email-change confirmations.
 *
 * NEXT_PUBLIC_SITE_URL wins whenever it is set, and in production it is the
 * only accepted source. Deriving the origin from the request's Host header in
 * production would allow poisoning: an attacker sends a request with a forged
 * Host, and the victim receives a genuine Supabase email whose link points at
 * the attacker's domain, carrying a live token.
 *
 * The header fallback exists so the flow is testable in a Codespace or on
 * localhost, where no fixed public URL exists. Supabase's redirect allow-list
 * remains the backstop in both cases.
 */
export async function getEmailLinkOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL must be set in production — authentication email links cannot be built from request headers."
    )
  }

  const headerList = await headers()
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host")
  const protocol = headerList.get("x-forwarded-proto") ?? "http"

  return host ? `${protocol}://${host}` : siteConfig.url.replace(/\/$/, "")
}
