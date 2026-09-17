"use client"

import * as React from "react"
import Link from "next/link"
import { EyeOff } from "lucide-react"

import { AdminFormBadge, AdminFormSection } from "@/components/admin/admin-form"
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
    <AdminFormSection
      id="customer-visibility"
      title="Customer visibility"
      description={`Switch off anything you are not sure of yet. It disappears from this ${noun} across the website — cards, its page, search and messages — and stays saved here.`}
      badge={
        <AdminFormBadge tone={hiddenCount > 0 ? "warning" : "neutral"} icon={<EyeOff aria-hidden="true" />}>
          {hiddenCount === 0 ? "Everything shown" : `${hiddenCount} hidden`}
        </AdminFormBadge>
      }
      bodyClassName="flex flex-col gap-4 py-2 sm:py-3"
    >
      <input type="hidden" name="hiddenFields" value={JSON.stringify(hiddenFields)} />

      <ul className="grid gap-x-8 sm:grid-cols-2 xl:grid-cols-3">
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
    </AdminFormSection>
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
    <li className="flex min-h-12 items-center justify-between gap-3 border-b border-border/60 py-2">
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
