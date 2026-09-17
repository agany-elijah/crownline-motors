/**
 * The branding images an operator uploads in Settings, and the rules each
 * one is held to.
 *
 * No `server-only` marker: the storage provisioning script imports the bucket
 * name, and the upload form shows the same limits in the browser before an
 * operator spends time uploading a file the server will refuse. The server
 * enforces every number here regardless (branding.actions.ts).
 *
 * ── Why SVG is refused ────────────────────────────────────────────────
 * An SVG is a document that can carry script. Served from a public bucket on
 * our storage domain it is a stored-XSS vector against anyone who opens its
 * URL, and sanitising SVG properly is a project of its own. PNG and WebP
 * carry transparency, which is the only reason a logo would want SVG here.
 */

export const BRANDING_BUCKET = "branding-assets"

export const BRANDING_ASSET_KINDS = ["logoLight", "logoDark", "favicon", "ogImage"] as const
export type BrandingAssetKind = (typeof BRANDING_ASSET_KINDS)[number]

export const BRANDING_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const
export type BrandingMimeType = (typeof BRANDING_MIME_TYPES)[number]

export const BRANDING_EXTENSION_BY_MIME: Record<BrandingMimeType, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
}

export interface BrandingAssetRule {
  label: string
  hint: string
  mimeTypes: readonly BrandingMimeType[]
  maxBytes: number
  /** Favicons must be square PNGs within this edge range. */
  squarePng?: { minEdge: number; maxEdge: number }
  /** Which BusinessSettings column holds the storage path. */
  column: "logoLightStoragePath" | "logoDarkStoragePath" | "faviconStoragePath" | "ogImageStoragePath"
}

const KB = 1024
const MB = 1024 * KB

export const BRANDING_ASSET_RULES: Record<BrandingAssetKind, BrandingAssetRule> = {
  logoLight: {
    label: "Logo for light backgrounds",
    hint: "PNG or WebP with a transparent background, up to 2 MB. Used on the white header and in emails.",
    mimeTypes: ["image/png", "image/webp", "image/jpeg"],
    maxBytes: 2 * MB,
    column: "logoLightStoragePath",
  },
  logoDark: {
    label: "Logo for dark backgrounds",
    hint: "A light version of the logo for the hero, footer and dashboard. Falls back to the other logo.",
    mimeTypes: ["image/png", "image/webp", "image/jpeg"],
    maxBytes: 2 * MB,
    column: "logoDarkStoragePath",
  },
  favicon: {
    label: "Favicon",
    hint: "A square PNG, 512×512 is best (at least 48×48), up to 512 KB.",
    mimeTypes: ["image/png"],
    maxBytes: 512 * KB,
    squarePng: { minEdge: 48, maxEdge: 1024 },
    column: "faviconStoragePath",
  },
  ogImage: {
    label: "Default social sharing image",
    hint: "Shown when a page is shared on WhatsApp or social media. 1200×630 JPEG or PNG, up to 5 MB.",
    mimeTypes: ["image/jpeg", "image/png", "image/webp"],
    maxBytes: 5 * MB,
    column: "ogImageStoragePath",
  },
}

/** The largest any branding file may be — the bucket's own ceiling. */
export const MAX_BRANDING_ASSET_BYTES = Math.max(
  ...Object.values(BRANDING_ASSET_RULES).map((rule) => rule.maxBytes)
)

/** Width and height from a PNG's IHDR chunk, or null when it is not a PNG. */
export function readPngDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (bytes.length < 24 || signature.some((byte, index) => bytes[index] !== byte)) return null

  // Bytes 12–15 are the first chunk's type, which the PNG spec requires to be IHDR.
  if (String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]) !== "IHDR") return null

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return { width: view.getUint32(16), height: view.getUint32(20) }
}
