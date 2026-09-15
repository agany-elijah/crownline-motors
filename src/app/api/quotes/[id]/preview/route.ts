import { NextResponse, type NextRequest } from "next/server"

import { authorizePermission } from "@/lib/auth/admin-guard"
import { getQuoteForPdfById } from "@/lib/queries/quote.queries"
import { buildQuotePdfData, buildQuotationFilename } from "@/lib/pdf/quote-pdf-data"
import { renderQuotePdfBuffer } from "@/lib/pdf/render-quote-pdf"

/**
 * The admin "Preview quotation" action: the exact PDF a customer would
 * receive, rendered on demand for an operator reviewing it before sending.
 *
 * Deliberately a separate route from `/api/quotations/[token]`, not that
 * route reused with an admin session substituted for the token — that route
 * is keyed by `Quote.shareToken`, a bearer credential that need not exist
 * yet (a quote can be previewed before it has ever been sent, which is the
 * whole point of previewing). This one is keyed by id and gated by the
 * admin's own session and `quote:read` permission instead, and reads through
 * `getQuoteForPdfById`, which returns the same narrow projection as the
 * token-based read — an operator previewing the document sees exactly what
 * the customer will, never a superset.
 *
 * `runtime = "nodejs"`: `@react-pdf/renderer` uses Node APIs an Edge runtime
 * does not provide (see the token route for the same note).
 */
export const runtime = "nodejs"

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizePermission("quote:read")
  if (!auth.ok) {
    return new NextResponse("Not authorized.", { status: 403 })
  }

  const { id } = await params

  const quote = await getQuoteForPdfById(id)

  if (!quote) {
    return new NextResponse("That quote no longer exists.", { status: 404 })
  }

  let buffer: Buffer

  try {
    buffer = await renderQuotePdfBuffer(buildQuotePdfData(quote))
  } catch (error) {
    console.error("[quote-preview] failed to render PDF", error)
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
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  })
}
