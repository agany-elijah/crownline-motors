import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Filter } from "lucide-react"

import { NATIVE_SELECT_CLASS, SettingsPanel } from "@/components/admin/settings/settings-ui"
import { Pagination } from "@/components/shared/pagination"
import { Button } from "@/components/ui/button"
import { requirePermission } from "@/lib/auth/admin-guard"
import { adminPath } from "@/lib/constants/admin-routes"
import { AUDIT_CATEGORIES, humaniseCode, isAuditCategory } from "@/lib/constants/audit-actions"
import { SECURITY_ACTIVITY_PATH } from "@/lib/constants/settings-nav"
import { listAuditActors, listAuditLog } from "@/lib/queries/audit.queries"
import { formatDateTime } from "@/lib/utils/format-date-time"

export const metadata: Metadata = {
  title: "Security activity · Settings",
}

/** Records that have a page of their own in the dashboard. */
const ENTITY_PATHS: Record<string, string> = {
  Vehicle: "/vehicles",
  SparePart: "/spare-parts",
  Quote: "/quotes",
  Order: "/orders",
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

/**
 * Settings → Admin users & security → Security activity: the audit trail of
 * administrative actions, newest first. Read-only — nothing in the
 * application can edit or delete an entry.
 */
export default async function SecurityActivityPage(props: PageProps<"/Ricky@2000/settings/security/activity">) {
  await requirePermission("audit:read")

  const params = await props.searchParams
  const rawCategory = single(params.category)
  const category = isAuditCategory(rawCategory) ? rawCategory : undefined
  const rawActor = single(params.admin)
  const actorId = rawActor && rawActor.length <= 64 ? rawActor : undefined
  const requestedPage = Number.parseInt(single(params.page) ?? "1", 10)

  const [log, actors] = await Promise.all([
    listAuditLog({ page: Number.isFinite(requestedPage) ? requestedPage : 1, category, actorId }),
    listAuditActors(),
  ])

  const hrefFor = (page: number) => {
    const search = new URLSearchParams()
    if (category) search.set("category", category)
    if (actorId) search.set("admin", actorId)
    if (page > 1) search.set("page", String(page))
    const query = search.toString()
    return query ? `${SECURITY_ACTIVITY_PATH}?${query}` : SECURITY_ACTIVITY_PATH
  }

  return (
    <SettingsPanel
      id="security-activity"
      title="Security activity"
      description="Every administrative action — who did it, when, what it affected and what changed."
    >
      {/* A GET form: filters are in the URL, so a filtered view can be bookmarked and shared. */}
      <form
        method="get"
        action={SECURITY_ACTIVITY_PATH}
        className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <label htmlFor="category" className="text-xs font-medium text-muted-foreground">
            Activity
          </label>
          <select id="category" name="category" defaultValue={category ?? ""} className={NATIVE_SELECT_CLASS}>
            <option value="">All activity</option>
            {Object.entries(AUDIT_CATEGORIES).map(([value, entry]) => (
              <option key={value} value={value}>
                {entry.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <label htmlFor="admin" className="text-xs font-medium text-muted-foreground">
            Administrator
          </label>
          <select id="admin" name="admin" defaultValue={actorId ?? ""} className={NATIVE_SELECT_CLASS}>
            <option value="">All administrators</option>
            {actors.map((actor) => (
              <option key={actor.id} value={actor.id}>
                {actor.displayName}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="outline" className="col-span-2 h-(--control-height) sm:col-span-1">
          <Filter aria-hidden="true" />
          Apply
        </Button>
      </form>

      <p className="text-xs text-muted-foreground tabular-nums">
        {log.total === 0 ? "No entries" : `${log.total.toLocaleString("en-GB")} entr${log.total === 1 ? "y" : "ies"}`}
      </p>

      {log.entries.length > 0 ? (
        <ol className="flex flex-col divide-y divide-border">
          {log.entries.map((entry) => {
            const path = ENTITY_PATHS[entry.entityType]
            return (
              <li key={entry.id} className="flex flex-col gap-2 py-3.5 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className="text-small font-semibold">{entry.actionLabel}</span>
                  <time dateTime={entry.createdAt.toISOString()} className="text-xs text-muted-foreground tabular-nums">
                    {formatDateTime(entry.createdAt)}
                  </time>
                </div>
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    By <span className="font-medium text-foreground">{entry.actorName}</span>
                  </span>
                  <span aria-hidden="true">·</span>
                  {path ? (
                    <Link
                      href={adminPath(`${path}/${entry.entityId}`)}
                      className="inline-flex items-center gap-1 underline-offset-2 hover:text-gold-ink hover:underline"
                    >
                      {humaniseCode(entry.entityType.replace(/([a-z])([A-Z])/g, "$1_$2"))}
                      <ArrowRight aria-hidden="true" className="size-3" />
                    </Link>
                  ) : (
                    <span>{humaniseCode(entry.entityType.replace(/([a-z])([A-Z])/g, "$1_$2"))}</span>
                  )}
                </p>
                {entry.changes.length > 0 ? (
                  <ul className="flex flex-col gap-1 rounded-lg border border-border bg-sunken/60 px-3 py-2">
                    {entry.changes.map((change, index) => (
                      <li key={`${change.field}-${index}`} className="grid gap-x-3 text-xs sm:grid-cols-[10rem_minmax(0,1fr)]">
                        <span className="font-medium text-foreground">{change.field}</span>
                        <span className="min-w-0 break-words text-muted-foreground">
                          <span className="line-through decoration-muted-foreground/40">{change.from ?? "—"}</span>
                          <span aria-hidden="true"> → </span>
                          <span className="sr-only"> changed to </span>
                          <span className="text-foreground">{change.to ?? "—"}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            )
          })}
        </ol>
      ) : (
        <p className="text-small text-muted-foreground">Nothing matches those filters.</p>
      )}

      {log.pageCount > 1 ? (
        <Pagination page={log.page} pageCount={log.pageCount} hrefFor={hrefFor} label="Security activity pages" />
      ) : null}
    </SettingsPanel>
  )
}
