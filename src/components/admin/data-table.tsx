import * as React from "react"
import Link from "next/link"

import { cn } from "@/lib/utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

/**
 * Column definition for {@link DataTable}.
 *
 * Generic over the row type, so `render` receives a typed row and a column
 * cannot reference a field the data does not have.
 */
export interface DataTableColumn<TRow> {
  /** Stable key — also used as the React key for cells. */
  id: string
  header: React.ReactNode
  render: (row: TRow) => React.ReactNode
  /** Right-align numeric columns so digits line up down the page. */
  align?: "left" | "right"
  /**
   * Hide below the given breakpoint.
   *
   * A phone cannot show eight columns legibly, and shrinking them all until
   * they fit produces a table nobody can read. Dropping the columns that
   * matter least keeps the rest usable — the full record is always one tap
   * away on the detail page.
   */
  hideBelow?: "sm" | "md" | "lg"
}

interface DataTableProps<TRow> {
  columns: DataTableColumn<TRow>[]
  rows: TRow[]
  /** Stable identity per row. */
  getRowKey: (row: TRow) => string
  /** Shown in place of the table when there are no rows. */
  emptyState: React.ReactNode
  /** Optional accessible caption describing what the table lists. */
  caption?: string
  className?: string
}

const HIDE_CLASSES = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
} as const

/**
 * The dashboard's table.
 *
 * Deliberately not a wrapper around a headless table library. Everything the
 * admin lists need — render a column, align it, drop it on small screens —
 * is expressed above in about twenty lines of types. Sorting and row
 * selection are absent because nothing needs them yet; adding them when
 * something does is a smaller job than removing an abstraction that guessed
 * wrong about how they should work.
 *
 * The empty state is required rather than optional. A table that renders
 * nothing but a header row when a filter matches nothing is the single most
 * common way an admin list leaves someone unsure whether it is broken.
 */
export function DataTable<TRow>({
  columns,
  rows,
  getRowKey,
  emptyState,
  caption,
  className,
}: DataTableProps<TRow>) {
  if (rows.length === 0) {
    return <>{emptyState}</>
  }

  return (
    // Wide tables scroll inside their own container so the page body never
    // scrolls sideways on a phone.
    <div
      className={cn(
        "w-full overflow-x-auto rounded-xl border border-border bg-card shadow-[var(--shadow-subtle)]",
        className
      )}
    >
      <Table className="text-small">
        {caption ? <caption className="sr-only">{caption}</caption> : null}

        <TableHeader className="[&_tr]:border-border">
          <TableRow className="bg-sunken/70 hover:bg-sunken/70">
            {columns.map((column) => (
              <TableHead
                key={column.id}
                className={cn(
                  // Sentence case at 12px rather than tracked capitals: a
                  // header row is read once, then the eye lives in the body,
                  // and capitals are the loudest thing a table can carry.
                  "h-10 px-4 text-xs font-medium text-muted-foreground first:pl-5 last:pr-5",
                  column.align === "right" && "text-right",
                  column.hideBelow && HIDE_CLASSES[column.hideBelow]
                )}
              >
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>

        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={getRowKey(row)}
              className="border-border/70 transition-colors duration-fast hover:bg-sunken/55"
            >
              {columns.map((column) => (
                <TableCell
                  key={column.id}
                  className={cn(
                    "h-14 px-4 align-middle first:pl-5 last:pr-5",
                    column.align === "right" && "text-right",
                    column.hideBelow && HIDE_CLASSES[column.hideBelow]
                  )}
                >
                  {column.render(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/**
 * The first cell of most dashboard rows: what the record is, linked to it, with
 * the reference that identifies it underneath in the mono face.
 *
 * One component so every list reads the same way — the name is the target, the
 * reference is for matching against a phone call or an email.
 */
export function DataTableRecordLink({
  href,
  title,
  reference,
  leading,
}: {
  href: string
  title: React.ReactNode
  /** Mono secondary line: a reference number, part number, email. */
  reference?: React.ReactNode
  /** An optional thumbnail or mark before the text. */
  leading?: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group/record flex min-w-0 items-center gap-3 rounded-sm",
        "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
      )}
    >
      {leading}
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate font-medium text-foreground transition-colors duration-fast group-hover/record:text-gold-ink">
          {title}
        </span>
        {reference ? (
          <span className="truncate font-mono text-xs text-muted-foreground">{reference}</span>
        ) : null}
      </span>
    </Link>
  )
}
