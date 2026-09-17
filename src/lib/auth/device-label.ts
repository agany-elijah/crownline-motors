/**
 * "Chrome on Windows" from a User-Agent header.
 *
 * Deliberately coarse. The label exists so an administrator can recognise
 * their own devices in a list of sessions — and so a stolen copy of that
 * list, or of the sign-in activity, is not a fingerprinting kit. No versions,
 * no device models, and never the IP address (SECURITY.MD §38).
 *
 * Pure, so the ordering traps below are unit-tested: every Chromium browser
 * says "Chrome", Chrome says "Safari", and an iPhone says "Mac OS X".
 */
export function describeDevice(userAgent: string | null | undefined): string | null {
  if (!userAgent || userAgent.trim().length === 0) return null

  const ua = userAgent

  const browser = /Edg(e|A|iOS)?\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /SamsungBrowser\//.test(ua)
        ? "Samsung Internet"
        : /Firefox\/|FxiOS\//.test(ua)
          ? "Firefox"
          : /Chrome\/|CriOS\//.test(ua)
            ? "Chrome"
            : /Safari\//.test(ua)
              ? "Safari"
              : null

  const os = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Windows/.test(ua)
          ? "Windows"
          : /CrOS/.test(ua)
            ? "ChromeOS"
            : /Mac OS X|Macintosh/.test(ua)
              ? "macOS"
              : /Linux/.test(ua)
                ? "Linux"
                : null

  if (browser && os) return `${browser} on ${os}`
  return browser ?? os ?? "Unknown device"
}
