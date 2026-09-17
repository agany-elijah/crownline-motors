import { NextResponse, type NextRequest } from "next/server"

import {
  QUOTATION_PDF_MAX_PER_IP,
  QUOTATION_PDF_WINDOW_MS,
  RATE_LIMIT_SCOPES,
  consumeRateLimit,
} from "@/lib/auth/rate-limit"
import { getClientIp } from "@/lib/auth/client-ip"
import { getQuoteForPdf } from "@/lib/queries/quote.queries"
import { buildQuotePdfData, buildQuotationFilename } from "@/lib/pdf/quote-pdf-data"
import { getPublicSiteSettings } from "@/lib/queries/settings.queries"
import { renderQuotePdfBuffer } from "@/lib/pdf/render-quote-pdf"

/**
 * The customer's secure link to their quotation PDF: `/quotation/<token>`
 * from the dispatch message resolves here (see next.config.ts's rewrite —
 * the file lives under `/api` so it can run the Node PDF renderer, which an
 * Edge runtime cannot).
 *
 * ── The security model ─────────────────────────────────────────────────
 * `token` is `Quote.shareToken` — 256 random bits, a bearer credential for
 * this one document and nothing else (see the schema documentation on
 * `Quote.shareToken`). There is no admin session and no customer account
 * involved: possession of the token *is* the authorization. It reaches
 * exactly one query (`getQuoteForPdf`), which selects only the fields a
 * customer's own quotation may show them — never `adminNotes`, the customer
 * record, or the linked order.
 *
 * The PDF is regenerated on every request rather than cached or stored,
 * which keeps it consistent with `isQuoteEditable`: a quote still in SENT can
 * be revised, and a stored file would silently go stale the moment it was.
 *
 * `runtime = "nodejs"` is required, not a default: `@react-pdf/renderer` uses
 * Node APIs (`fontkit`/`Buffer`) an Edge runtime does not provide.
 */
export const runtime = "nodejs"

const NOT_FOUND_BODY = "This quotation link is invalid or has expired."

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  // The share token is always 43 base64url characters (256 bits). Anything
  // shorter or oddly shaped is not a token this application ever issued, so
  // it is refused before it reaches the database at all.
  if (!token || !/^[A-Za-z0-9_-]{20,128}$/.test(token)) {
    return new NextResponse(NOT_FOUND_BODY, { status: 404 })
  }

  const ip = await getClientIp()

  if (ip) {
    const verdict = await consumeRateLimit(
      [{ key: { scope: RATE_LIMIT_SCOPES.quotationPdfIp, identifier: ip }, max: QUOTATION_PDF_MAX_PER_IP }],
      QUOTATION_PDF_WINDOW_MS
    )

    if (!verdict.allowed) {
      return new NextResponse("Too many requests. Please try again shortly.", {
        status: 429,
        headers: { "Retry-After": "300" },
      })
    }
  }

  const quote = await getQuoteForPdf(token)

  if (!quote) {
    return new NextResponse(NOT_FOUND_BODY, { status: 404 })
  }

  let buffer: Buffer

  try {
    buffer = await renderQuotePdfBuffer(buildQuotePdfData(quote, (await getPublicSiteSettings()).businessName))
  } catch (error) {
    console.error("[quotation-pdf] failed to render PDF", error)
    return new NextResponse("Could not generate this document. Please try again shortly.", {
      status: 500,
    })
  }

  const filename = buildQuotationFilename(quote.quoteNumber, quote.contactName ?? "Customer")

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      // A quotation carries a customer's name, contact details and a price —
      // it must never be cached by a shared proxy or CDN, only (at most) by
      // the requesting browser for the duration of that one view.
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  })
}
