"use client"

import * as React from "react"
import Link from "next/link"
import { EyeOff } from "lucide-react"

import { Switch } from "@/components/ui/switch"
import { adminPath } from "@/lib/constants/admin-routes"
import { cn } from "@/lib/utils"
import {
  normalizeHiddenFields,
  type InfoFieldCopy,
  type Visibility,
} from "@/lib/visibility/product-visibility"

/**
 * "Customer visibility" on the vehicle and spare-part forms.
 *
 * One switch per fact. Off withholds that fact from this listing everywhere a
 * customer can see it; the value stays stored and editable here. Facts hidden
 * for the whole catalogue in Settings are shown switched off and locked, with
 * a link to where they are controlled, so the form never suggests a fact is
 * public when it is not.
 *
 * Submitted as one hidden `hiddenFields` input holding a JSON array, which
 * the schema validates against the same field list.
 */
export function CustomerVisibilitySection<F extends string>({
  fields,
  copy,
  siteWide,
  hidden,
  error,
  noun,
}: {
  fields: readonly F[]
  copy: Record<F, InfoFieldCopy>
  /** Settings → Catalogue display, for this kind of listing. */
  siteWide: Visibility<F>
  /** What the form should start from: the echoed submission, else the stored value. */
  hidden: readonly string[]
  error?: string
  /** "vehicle" or "part", for the copy. */
  noun: string
}) {
  const [hiddenFields, setHiddenFields] = React.useState<F[]>(() => normalizeHiddenFields(fields, hidden))
  const hiddenSet = new Set<string>(hiddenFields)

  const toggle = (field: F, visible: boolean) =>
    setHiddenFields((current) =>
      normalizeHiddenFields(fields, visible ? current.filter((entry) => entry !== field) : [...current, field])
    )

  const hiddenCount = fields.filter((field) => hiddenSet.has(field) || !siteWide[field]).length

  return (
    <section
      aria-labelledby="customer-visibility-heading"
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6"
    >
      <input type="hidden" name="hiddenFields" value={JSON.stringify(hiddenFields)} />

      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="flex flex-col gap-1">
          <h2 id="customer-visibility-heading" className="font-heading text-h3 font-semibold">
            Customer visibility
          </h2>
          <p className="max-w-2xl text-small text-muted-foreground">
            Switch off anything you are not sure of yet. It disappears from this {noun} across the website —
            cards, its page, search and messages — and stays saved here.
          </p>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
            hiddenCount > 0 ? "bg-warning/10 text-foreground" : "bg-muted text-muted-foreground"
          )}
        >
          <EyeOff aria-hidden="true" className="size-3.5" />
          {hiddenCount === 0 ? "Everything shown" : `${hiddenCount} hidden`}
        </span>
      </div>

      <ul className="grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map((field) => (
          <VisibilityRow
            key={field}
            label={copy[field].label}
            lockedBySettings={!siteWide[field]}
            checked={siteWide[field] && !hiddenSet.has(field)}
            onCheckedChange={(visible) => toggle(field, visible)}
          />
        ))}
      </ul>

      {error ? (
        <p role="alert" className="text-small text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  )
}

function VisibilityRow({
  label,
  checked,
  lockedBySettings,
  onCheckedChange,
}: {
  label: string
  checked: boolean
  lockedBySettings: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  const id = React.useId()

  return (
    <li className="flex min-h-11 items-center justify-between gap-3 border-b border-border/70 py-2">
      <label htmlFor={id} className={cn("flex min-w-0 flex-col", lockedBySettings ? "cursor-not-allowed" : "cursor-pointer")}>
        <span className={cn("truncate text-small", checked ? "text-foreground" : "text-muted-foreground")}>{label}</span>
        {lockedBySettings ? (
          <Link
            href={`${adminPath("/settings/catalog-display")}`}
            className="w-fit text-xs text-muted-foreground underline underline-offset-2 hover:text-gold-ink"
          >
            Hidden site-wide
          </Link>
        ) : null}
      </label>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={lockedBySettings}
        aria-label={`Show ${label.toLowerCase()} to customers`}
      />
    </li>
  )
}
