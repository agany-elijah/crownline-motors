import "server-only"

import { headers } from "next/headers"

/**
 * The caller's IP address, as far as it can be established.
 *
 * ── Read the caveat before relying on this ────────────────────────────
 * There is no such thing as a trustworthy client IP in an HTTP header. Every
 * header below is written by *something* upstream, and a request that did
 * not pass through the proxy you expect can write them itself. So this value
 * is fit for throttling and for logs, and it is fit for nothing that grants
 * or denies authority. Nothing in this codebase authenticates or authorises
 * on it, and nothing should start.
 *
 * ── Why this order ────────────────────────────────────────────────────
 * Most specific and least forgeable first:
 *
 *   1. `x-vercel-forwarded-for` — written by Vercel's edge on the way in and
 *      overwritten if a client sends its own. This is production.
 *   2. `cf-connecting-ip` — Cloudflare's equivalent, set at its edge.
 *      Cloudflare sits in front of Vercel here (brief §26), so this is the
 *      address Cloudflare actually accepted the connection from.
 *   3. `x-real-ip` — set by most reverse proxies, including in a Codespace.
 *   4. `x-forwarded-for` — the general case, and the weakest. It is a list
 *      that each hop appends to, so the *leftmost* entry is whatever the
 *      original caller claimed and the rightmost is what the nearest proxy
 *      observed. The leftmost is taken because it is the only entry that
 *      identifies the client when the chain is honest; a caller who forges
 *      it splits their own attempts across fabricated keys and gains
 *      nothing, because the email-keyed counter in rate-limit.ts is
 *      counting the same attempts independently.
 *
 * Returns null when nothing usable is present — a direct connection in local
 * development, typically. Callers must treat null as "no IP key", never as a
 * key of its own: bucketing every anonymous caller under one placeholder
 * would let a single visitor lock out everyone whose IP could not be read.
 */
export async function getClientIp(): Promise<string | null> {
  const headerList = await headers()

  const direct =
    headerList.get("x-vercel-forwarded-for") ??
    headerList.get("cf-connecting-ip") ??
    headerList.get("x-real-ip")

  if (direct) {
    const value = direct.trim()
    if (value.length > 0 && value.length <= 64) return value
  }

  const forwarded = headerList.get("x-forwarded-for")

  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim()
    // Length-capped so a hostile header cannot push an unbounded string into
    // a hash and a log line.
    if (first && first.length > 0 && first.length <= 64) return first
  }

  return null
}
