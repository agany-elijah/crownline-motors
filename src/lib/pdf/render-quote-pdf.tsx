import "server-only"

import { renderToBuffer } from "@react-pdf/renderer"

import { QuoteDocument } from "@/lib/pdf/quote-document"
import type { QuotePdfData } from "@/lib/pdf/quote-pdf-data"

/**
 * Renders a quotation to a PDF buffer.
 *
 * The one function boundary between the pure document component above and
 * Node's filesystem-free renderer — kept this thin so the route handler and
 * any future caller (e.g. attaching the PDF to a stored document once
 * Documents land in Wave B) share exactly one rendering path.
 */
export async function renderQuotePdfBuffer(data: QuotePdfData): Promise<Buffer> {
  return renderToBuffer(<QuoteDocument data={data} />)
}
