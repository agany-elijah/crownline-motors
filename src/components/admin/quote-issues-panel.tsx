"use client"

import { AlertTriangle, CheckCircle2 } from "lucide-react"

import { useQuotePricing } from "@/lib/quotes/quote-pricing-context"
import { cn } from "@/lib/utils"

interface Issue {
  message: string
  /** An in-page anchor to jump to the field that resolves this issue. */
  href?: string
}

interface QuoteIssuesPanelProps {
  hasEmail: boolean
  hasWhatsapp: boolean
  /** Once a quote has become an order its own figures are frozen, so pricing
   *  readiness is no longer this quote's problem to flag. */
  isWon: boolean
}

/**
 * What stands between this quote and being sendable.
 *
 * The pricing issue reuses `quoteReadinessProblem` — the exact rule the
 * server enforces before it will send or convert a quote — via the shared
 * pricing context, so this panel can never claim a quote is ready when the
 * server would refuse it, or vice versa.
 */
export function QuoteIssuesPanel({ hasEmail, hasWhatsapp, isWon }: QuoteIssuesPanelProps) {
  const { readinessProblem, isDirty } = useQuotePricing()

  const issues: Issue[] = []

  // Listed first and separately from `readinessProblem`: sending or
  // converting reads the quote back from the database, so unsaved edits are
  // a distinct problem from an incomplete draft, and the fix is different
  // ("save" versus "fill this in") — see the file note on `isDirty` in
  // quote-pricing-context.tsx.
  if (!isWon && isDirty) {
    issues.push({
      message: "You have unsaved changes — save the details to apply them.",
      href: "#pricing",
    })
  }

  if (!isWon && readinessProblem) {
    issues.push({ message: readinessProblem, href: "#pricing" })
  }

  if (!hasEmail && !hasWhatsapp) {
    issues.push({
      message: "No email or WhatsApp number on file — add one before this quote can be sent.",
      href: "#customer",
    })
  }

  if (issues.length === 0) {
    return (
      <section className="flex items-start gap-2.5 rounded-xl bg-success/5 p-5 ring-1 ring-success/25">
        <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
        <div className="flex flex-col gap-0.5">
          <p className="text-small font-medium text-foreground">Ready to send</p>
          <p className="text-small text-muted-foreground">No outstanding issues on this quote.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl bg-warning/5 p-5 ring-1 ring-warning/25">
      <h2 className="flex items-center gap-1.5 text-meta text-warning">
        <AlertTriangle aria-hidden="true" className="size-3.5" />
        {issues.length} issue{issues.length === 1 ? "" : "s"}
      </h2>

      <ul className="flex flex-col gap-2">
        {issues.map((issue, index) => (
          <li key={index}>
            <IssueItem issue={issue} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function IssueItem({ issue }: { issue: Issue }) {
  const content = <span className="text-small text-foreground/90">{issue.message}</span>

  if (!issue.href) {
    return <div className="flex gap-2">{content}</div>
  }

  return (
    <a
      href={issue.href}
      className={cn(
        "flex gap-2 rounded-sm underline decoration-warning/40 decoration-dashed underline-offset-4",
        "transition-colors duration-fast hover:decoration-warning",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      )}
    >
      {content}
    </a>
  )
}
