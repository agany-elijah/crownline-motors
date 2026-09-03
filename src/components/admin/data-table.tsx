import * as React from "react"

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
        "w-full overflow-x-auto rounded-xl border border-border bg-card",
        className
      )}
    >
      <Table>
        {caption ? <caption className="sr-only">{caption}</caption> : null}

        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((column) => (
              <TableHead
                key={column.id}
                className={cn(
                  // foreground/70 rather than --muted-foreground: at 10px,
                  // uppercase and widely tracked, a column heading needs
                  // more contrast than body-adjacent secondary text, not
                  // less. Measured at 7.4:1 on --card.
                  "text-[0.625rem] font-bold tracking-[0.13em] text-foreground/70 uppercase",
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
            <TableRow key={getRowKey(row)}>
              {columns.map((column) => (
                <TableCell
                  key={column.id}
                  className={cn(
                    "align-middle",
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
