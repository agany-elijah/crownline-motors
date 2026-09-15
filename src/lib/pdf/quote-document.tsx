import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer"

import { formatCurrency, formatCurrencyOrDash } from "@/lib/utils/format-currency"
import { formatQuoteDate } from "@/lib/quotes/quote-messages"
import type { QuotePdfData } from "@/lib/pdf/quote-pdf-data"

/**
 * The customer-facing quotation PDF.
 *
 * Rendered server-side with `@react-pdf/renderer` — a pure-JS PDF layout
 * engine, not a headless browser — so it runs in an ordinary Node server
 * action/route handler without a Chromium binary. Kept deliberately plain:
 * one page, one typeface (the built-in Helvetica family, so there is no font
 * file to bundle or license), black text on white with a single gold rule for
 * the brand accent. A quotation a customer may forward to a bank is not the
 * place for a design flourish.
 */

const INK = "#141414"
const MUTED = "#6b6b6b"
const GOLD = "#a9822c"
const BORDER = "#dcdcdc"

/**
 * The one spacing scale every margin/padding value below is drawn from —
 * a 4pt grid, so two gaps that are supposed to read as "the same kind of
 * space" always are, in fact, the same number, rather than two nearby
 * values (say, 5 and 7) that were each tuned in isolation and only looked
 * equal on one screen. Reach for a step here before writing a bespoke
 * number; if none fits, that is a sign the layout wants a new step added
 * to the scale, not a one-off value squeezed in beside it.
 */
const SPACE = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const

const styles = StyleSheet.create({
  page: {
    paddingTop: SPACE.xxl + SPACE.lg,
    paddingBottom: SPACE.xxl * 2,
    paddingHorizontal: SPACE.xxl + SPACE.md,
    fontSize: 10,
    color: INK,
    fontFamily: "Helvetica",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: SPACE.xl,
  },
  brand: {
    fontSize: 19,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1.5,
    // Tight on purpose: a display-weight heading carries generous built-in
    // leading by default, which ate into the gap below and was exactly
    // what made the tagline read as squeezed against it — the fix belongs
    // here, on the line that has the excess space, not on a bigger margin
    // fighting to overcome it.
    lineHeight: 1,
  },
  tagline: {
    fontSize: 8.5,
    color: MUTED,
    marginTop: SPACE.sm,
  },
  quoteMeta: {
    alignItems: "flex-end",
  },
  quoteNumber: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    lineHeight: 1,
  },
  goldRule: {
    borderBottomWidth: 2,
    borderBottomColor: GOLD,
    marginBottom: SPACE.xl,
  },
  sectionTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: MUTED,
    letterSpacing: 1.2,
    marginBottom: SPACE.sm,
    textTransform: "uppercase",
  },
  customerBlock: {
    marginBottom: SPACE.xl,
  },
  customerName: {
    fontSize: 12.5,
    fontFamily: "Helvetica-Bold",
    marginBottom: SPACE.sm,
  },
  muted: {
    color: MUTED,
    marginTop: SPACE.xs,
  },
  table: {
    marginTop: SPACE.sm,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  tableHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: INK,
    paddingVertical: SPACE.sm,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingVertical: SPACE.md,
  },
  colDescription: { flexGrow: 1, flexBasis: 0, paddingRight: SPACE.md },
  colQty: { width: 46, textAlign: "right" },
  colUnit: { width: 78, textAlign: "right" },
  colTotal: { width: 86, textAlign: "right" },
  tableHeaderText: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: MUTED,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  totalsBlock: {
    marginTop: SPACE.xl,
    alignSelf: "flex-end",
    width: 250,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: SPACE.xs + 2,
  },
  totalsLabel: {
    color: MUTED,
  },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: INK,
    marginTop: SPACE.sm,
    paddingTop: SPACE.md,
  },
  grandTotalLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11.5,
  },
  grandTotalValue: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11.5,
  },
  validity: {
    marginTop: SPACE.lg,
    fontSize: 9,
    color: MUTED,
    lineHeight: 1.5,
  },
  textBlock: {
    marginTop: SPACE.xl,
  },
  textBody: {
    marginTop: SPACE.sm,
    lineHeight: 1.6,
    fontSize: 9.5,
  },
  footer: {
    position: "absolute",
    bottom: SPACE.xxl,
    left: SPACE.xxl + SPACE.md,
    right: SPACE.xxl + SPACE.md,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: SPACE.md,
    fontSize: 8,
    color: MUTED,
    textAlign: "center",
  },
})

export function QuoteDocument({ data }: { data: QuotePdfData }) {
  const listedLines = data.lines.filter((line) => line.kind === "ITEM")
  const accessoryLines = data.lines.filter((line) => line.kind === "ACCESSORY")

  return (
    <Document title={`Quotation ${data.quoteNumber}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>{data.siteName.toUpperCase()}</Text>
            <Text style={styles.tagline}>Quality Cars. Global Standards. Local Commitment.</Text>
          </View>
          <View style={styles.quoteMeta}>
            <Text style={styles.quoteNumber}>Quotation {data.quoteNumber}</Text>
            <Text style={styles.muted}>{formatQuoteDate(data.issuedAt)}</Text>
          </View>
        </View>

        <View style={styles.goldRule} />

        <View style={styles.customerBlock}>
          <Text style={styles.sectionTitle}>Prepared for</Text>
          <Text style={styles.customerName}>{data.customerName}</Text>
          {data.customerCity ? <Text style={styles.muted}>{data.customerCity}</Text> : null}
          {data.customerPhone ? <Text style={styles.muted}>{data.customerPhone}</Text> : null}
          {data.customerEmail ? <Text style={styles.muted}>{data.customerEmail}</Text> : null}
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.colDescription, styles.tableHeaderText]}>Description</Text>
            <Text style={[styles.colQty, styles.tableHeaderText]}>Qty</Text>
            <Text style={[styles.colUnit, styles.tableHeaderText]}>Unit price</Text>
            <Text style={[styles.colTotal, styles.tableHeaderText]}>Amount</Text>
          </View>

          {[...listedLines, ...accessoryLines].map((line, index) => (
            <View key={index} style={styles.tableRow} wrap={false}>
              <Text style={styles.colDescription}>{line.description}</Text>
              <Text style={styles.colQty}>{line.quantity}</Text>
              <Text style={styles.colUnit}>
                {line.unitPrice === null ? "—" : formatCurrency(line.unitPrice)}
              </Text>
              <Text style={styles.colTotal}>
                {line.lineTotal === null ? "—" : formatCurrency(line.lineTotal)}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.totalsBlock}>
          {data.accessoriesTotal > 0 ? (
            <>
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>
                  {data.isVehicle ? "Vehicle" : "Items"}
                </Text>
                <Text>{formatCurrency(data.itemsSubtotal)}</Text>
              </View>
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Accessories &amp; extras</Text>
                <Text>{formatCurrency(data.accessoriesTotal)}</Text>
              </View>
            </>
          ) : null}

          {data.shippingCost !== null ? (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Shipping (estimate)</Text>
              <Text>{formatCurrencyOrDash(data.shippingCost)}</Text>
            </View>
          ) : null}

          {data.clearingCost !== null ? (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Clearing (estimate)</Text>
              <Text>{formatCurrencyOrDash(data.clearingCost)}</Text>
            </View>
          ) : null}

          {data.importDuty !== null ? (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Import duty (estimate)</Text>
              <Text>{formatCurrencyOrDash(data.importDuty)}</Text>
            </View>
          ) : null}

          {data.otherCostsAmount !== null ? (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>{data.otherCostsLabel ?? "Other costs"}</Text>
              <Text>{formatCurrencyOrDash(data.otherCostsAmount)}</Text>
            </View>
          ) : null}

          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Total</Text>
            <Text style={styles.grandTotalValue}>{formatCurrency(data.total)}</Text>
          </View>
        </View>

        {data.validUntil ? (
          <Text style={styles.validity}>
            This quotation is valid until {formatQuoteDate(data.validUntil)}. Figures marked as
            estimates are confirmed once the order is placed.
          </Text>
        ) : null}

        {data.paymentInstructions ? (
          <View style={styles.textBlock} wrap={false}>
            <Text style={styles.sectionTitle}>How to pay</Text>
            <Text style={styles.textBody}>{data.paymentInstructions}</Text>
          </View>
        ) : null}

        {data.terms ? (
          <View style={styles.textBlock} wrap={false}>
            <Text style={styles.sectionTitle}>Terms</Text>
            <Text style={styles.textBody}>{data.terms}</Text>
          </View>
        ) : null}

        <Text style={styles.footer} fixed>
          {data.siteName} · This document is a quotation, not an invoice, and is provided for the
          reference number shown above only.
        </Text>
      </Page>
    </Document>
  )
}
