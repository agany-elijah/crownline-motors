/**
 * The layout every automatic email to a customer or an administrator uses.
 *
 * One structured description of the message renders to both a plain-text
 * and an HTML body, so the two can never say different things. Every value
 * is escaped: customer names, notes and addresses come from a public form,
 * and an email client is a browser that will happily render markup a
 * customer typed.
 *
 * Pure (no `server-only`), so escaping is unit-tested
 * (tests/unit/email-layout.test.ts).
 */

export interface EmailDetail {
  label: string
  value: string
}

export interface EmailContent {
  /** The line mail clients show beside the subject in the inbox. */
  preheader: string
  heading: string
  greeting: string
  paragraphs: readonly string[]
  details?: readonly EmailDetail[]
  callToAction?: { label: string; url: string }
  closing?: readonly string[]
}

export interface EmailBrand {
  siteName: string
  siteUrl: string
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/** Only http(s) links are ever rendered — a `javascript:` URL is dropped. */
export function safeHttpUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null
  } catch {
    return null
  }
}

export function renderEmailText(content: EmailContent, brand: EmailBrand): string {
  const lines: string[] = [content.greeting, ""]

  for (const paragraph of content.paragraphs) {
    lines.push(paragraph, "")
  }

  if (content.details && content.details.length > 0) {
    for (const detail of content.details) {
      lines.push(`${detail.label}: ${detail.value}`)
    }
    lines.push("")
  }

  const ctaUrl = content.callToAction ? safeHttpUrl(content.callToAction.url) : null
  if (content.callToAction && ctaUrl) {
    lines.push(`${content.callToAction.label}: ${ctaUrl}`, "")
  }

  for (const line of content.closing ?? []) {
    lines.push(line)
  }

  lines.push("", brand.siteName, brand.siteUrl)

  return lines.join("\n")
}

const INK = "#141414"
const MUTED = "#6b6b6b"
const GOLD = "#d9b04c"
const RULE = "#ece8df"

function paragraphHtml(text: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${INK};">${escapeHtml(text).replace(/\n/g, "<br>")}</p>`
}

export function renderEmailHtml(content: EmailContent, brand: EmailBrand): string {
  const details =
    content.details && content.details.length > 0
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;border-top:1px solid ${RULE};">${content.details
          .map(
            (detail) =>
              `<tr><td style="padding:10px 12px 10px 0;border-bottom:1px solid ${RULE};font-size:13px;color:${MUTED};vertical-align:top;white-space:nowrap;">${escapeHtml(detail.label)}</td><td style="padding:10px 0;border-bottom:1px solid ${RULE};font-size:14px;color:${INK};font-weight:600;text-align:right;">${escapeHtml(detail.value).replace(/\n/g, "<br>")}</td></tr>`
          )
          .join("")}</table>`
      : ""

  const ctaUrl = content.callToAction ? safeHttpUrl(content.callToAction.url) : null
  const cta =
    content.callToAction && ctaUrl
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;"><tr><td style="border-radius:8px;background:${GOLD};"><a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:700;color:${INK};text-decoration:none;letter-spacing:0.02em;">${escapeHtml(content.callToAction.label)}</a></td></tr></table>`
      : ""

  const closing = (content.closing ?? []).map(paragraphHtml).join("")
  const siteUrl = safeHttpUrl(brand.siteUrl)

  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(content.heading)}</title></head>
<body style="margin:0;padding:0;background:#f6f4ef;font-family:Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(content.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f4ef;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;">
<tr><td style="background:#0f0f0f;padding:22px 28px;font-size:14px;font-weight:700;letter-spacing:0.22em;color:${GOLD};text-transform:uppercase;">${escapeHtml(brand.siteName)}</td></tr>
<tr><td style="padding:32px 28px 12px;">
<h1 style="margin:0 0 20px;font-size:22px;line-height:1.3;color:${INK};">${escapeHtml(content.heading)}</h1>
${paragraphHtml(content.greeting)}
${content.paragraphs.map(paragraphHtml).join("")}
${details}
${cta}
${closing}
</td></tr>
<tr><td style="padding:18px 28px 26px;border-top:1px solid ${RULE};font-size:12px;line-height:1.6;color:${MUTED};">${escapeHtml(brand.siteName)}${siteUrl ? ` · <a href="${escapeHtml(siteUrl)}" style="color:${MUTED};">${escapeHtml(siteUrl.replace(/^https?:\/\//, "").replace(/\/$/, ""))}</a>` : ""}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}
