import type { SocialNetworkField } from "@/lib/validations/settings.schema"

/** The glyph for a social network configured in Settings. Decorative: the link around it carries the name. */
export function SocialIcon({ network }: { network: SocialNetworkField }) {
  switch (network) {
    case "socialFacebook":
      return (
        <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true" fill="currentColor">
          <path d="M14 8h3V4h-3c-3.3 0-5 1.7-5 5v3H6v4h3v4h4v-4h3l1-4h-4V9c0-.7.3-1 1-1Z" />
        </svg>
      )
    case "socialInstagram":
      return (
        <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
        </svg>
      )
    case "socialTiktok":
      return (
        <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true" fill="currentColor">
          <path d="M16.6 3c.3 2.2 1.7 3.9 3.9 4.2v3.1a7 7 0 0 1-3.8-1.2v6.3a5.6 5.6 0 1 1-5.6-5.6c.3 0 .6 0 .9.1v3.2a2.5 2.5 0 1 0 1.6 2.3V3h3Z" />
        </svg>
      )
    case "socialYoutube":
      return (
        <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true" fill="currentColor">
          <path d="M22 8.2a3 3 0 0 0-2.1-2.1C18 5.6 12 5.6 12 5.6s-6 0-7.9.5A3 3 0 0 0 2 8.2 31 31 0 0 0 1.6 12c0 1.3.1 2.5.4 3.8a3 3 0 0 0 2.1 2.1c1.9.5 7.9.5 7.9.5s6 0 7.9-.5a3 3 0 0 0 2.1-2.1c.3-1.3.4-2.5.4-3.8s-.1-2.5-.4-3.8ZM10 15.1V8.9l5.2 3.1L10 15.1Z" />
        </svg>
      )
    case "socialLinkedin":
      return (
        <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true" fill="currentColor">
          <path d="M5 3.5A2.5 2.5 0 1 1 5 8.5a2.5 2.5 0 0 1 0-5ZM3 9h4v12H3V9Zm6 0h3.8v1.6h.1c.5-.9 1.7-2 3.6-2 3.9 0 4.5 2.6 4.5 6V21h-4v-5.7c0-1.4 0-3.2-2-3.2s-2.3 1.5-2.3 3.1V21H9V9Z" />
        </svg>
      )
    case "socialX":
      return (
        <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true" fill="currentColor">
          <path d="M17.8 3h3.1l-6.8 7.8L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.3-8.3L2 3h6.3l4.4 5.9L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5Z" />
        </svg>
      )
  }
}
