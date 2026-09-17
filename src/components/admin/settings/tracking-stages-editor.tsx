"use client"

import * as React from "react"
import { ArrowDown, ArrowUp, Lock, RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs"
import { ShipmentType } from "@/generated/prisma/enums"
import {
  TRACKING_ANCHOR_REASONS,
  TRACKING_STAGE_DESCRIPTION_MAX,
  TRACKING_STAGE_LABEL_MAX,
  defaultTrackingStages,
  isTrackingAnchor,
  type TrackingStageConfig,
  type TrackingStageSetting,
} from "@/lib/settings/tracking-stages"
import { cn } from "@/lib/utils"

const TYPE_LABELS: Record<ShipmentType, string> = {
  VEHICLE: "Vehicle tracking",
  SPARE_PART: "Spare-parts tracking",
}

/**
 * The tracking stages, per shipment type: names, descriptions, on/off and
 * order.
 *
 * Fixed stages carry the payment and delivery rules (see
 * lib/settings/tracking-stages.ts), so they show a lock and their reason,
 * cannot be switched off, and cannot be moved — and a movable stage cannot be
 * moved past one. The arrows simply refuse those moves; the server validates
 * the same rule, because the arrows are not the rule.
 *
 * Arrows rather than drag and drop, for the reason the delivery-steps editor
 * gives: drag needs a pointer, and a reorder that only works with a mouse is
 * missing exactly when someone is standing in the yard with a tablet.
 */
export function TrackingStagesEditor({
  initial,
  onChange,
  error,
}: {
  initial: TrackingStageConfig
  onChange: () => void
  error?: string
}) {
  const [config, setConfig] = React.useState<TrackingStageConfig>(initial)

  function update(type: ShipmentType, next: TrackingStageSetting[]) {
    setConfig((current) => ({ ...current, [type]: next }))
    onChange()
  }

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name="trackingStages" value={JSON.stringify(config)} />

      <Tabs defaultValue={ShipmentType.VEHICLE}>
        <TabsList aria-label="Timeline">
          {[ShipmentType.VEHICLE, ShipmentType.SPARE_PART].map((type) => (
            <TabsTab key={type} value={type}>
              {TYPE_LABELS[type]}
            </TabsTab>
          ))}
        </TabsList>

        {[ShipmentType.VEHICLE, ShipmentType.SPARE_PART].map((type) => (
          <TabsPanel key={type} value={type} keepMounted>
            <StageList type={type} stages={config[type]} onUpdate={(next) => update(type, next)} />
          </TabsPanel>
        ))}
      </Tabs>

      {error ? <p className="text-small text-destructive">{error}</p> : null}
    </div>
  )
}

function StageList({
  type,
  stages,
  onUpdate,
}: {
  type: ShipmentType
  stages: TrackingStageSetting[]
  onUpdate: (next: TrackingStageSetting[]) => void
}) {
  const baseId = React.useId()

  function patch(index: number, change: Partial<TrackingStageSetting>) {
    onUpdate(stages.map((stage, position) => (position === index ? { ...stage, ...change } : stage)))
  }

  /** A swap is allowed only between two movable neighbours — never across or with a fixed stage. */
  function canMove(index: number, direction: -1 | 1): boolean {
    const target = index + direction
    if (target < 0 || target >= stages.length) return false
    return !isTrackingAnchor(type, stages[index].status) && !isTrackingAnchor(type, stages[target].status)
  }

  function move(index: number, direction: -1 | 1) {
    if (!canMove(index, direction)) return
    const next = [...stages]
    ;[next[index], next[index + direction]] = [next[index + direction], next[index]]
    onUpdate(next)
  }

  const isDefault = JSON.stringify(stages) === JSON.stringify(defaultTrackingStages(type))

  return (
    <div className="flex flex-col gap-3">
      {/*
        One compact row per stage: its number, name and switch on the first
        line, the customer-facing description beneath, and the lock note and
        reorder controls last — so both inputs get the full width of a phone.
      */}
      <ol className="flex min-w-0 flex-col divide-y divide-border rounded-lg border border-border">
        {stages.map((stage, index) => {
          const anchor = isTrackingAnchor(type, stage.status)
          const labelId = `${baseId}-${index}-label`
          const descriptionId = `${baseId}-${index}-description`

          return (
            <li
              key={stage.status}
              className={cn(
                "flex min-w-0 flex-col gap-2 px-3 py-3 transition-opacity duration-fast sm:px-4",
                anchor && "bg-muted/30",
                !stage.enabled && "opacity-60"
              )}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className={cn(
                    "tabular flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                    anchor ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"
                  )}
                >
                  {index + 1}
                </span>
                <label htmlFor={labelId} className="sr-only">
                  Stage {index + 1} name
                </label>
                <Input
                  id={labelId}
                  value={stage.label}
                  maxLength={TRACKING_STAGE_LABEL_MAX}
                  onChange={(event) => patch(index, { label: event.target.value })}
                  className="h-9 min-w-0 flex-1 font-medium"
                />
                <Switch
                  checked={stage.enabled}
                  disabled={anchor}
                  onCheckedChange={(enabled) => patch(index, { enabled })}
                  aria-label={`${stage.label} ${stage.enabled ? "enabled" : "disabled"}`}
                />
              </div>

              <div className="flex min-w-0 flex-col gap-2 pl-[2.125rem]">
                <label htmlFor={descriptionId} className="sr-only">
                  Stage {index + 1} description shown to customers
                </label>
                <Input
                  id={descriptionId}
                  value={stage.description}
                  maxLength={TRACKING_STAGE_DESCRIPTION_MAX}
                  placeholder="What this stage tells the customer"
                  onChange={(event) => patch(index, { description: event.target.value })}
                  className="h-9"
                />

                <div className="flex min-w-0 items-center justify-between gap-2">
                  {anchor ? (
                    <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                      <Lock aria-hidden="true" className="size-3 shrink-0" />
                      <span>Fixed stage — {TRACKING_ANCHOR_REASONS[stage.status]?.toLowerCase()}</span>
                    </p>
                  ) : (
                    <span />
                  )}
                  <div className="-my-1 -mr-1 flex shrink-0 items-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={!canMove(index, -1)}
                      onClick={() => move(index, -1)}
                      aria-label={`Move ${stage.label} up`}
                    >
                      <ArrowUp aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={!canMove(index, 1)}
                      onClick={() => move(index, 1)}
                      aria-label={`Move ${stage.label} down`}
                    >
                      <ArrowDown aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </div>
            </li>
          )
        })}
      </ol>

      <div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isDefault}
          onClick={() => onUpdate(defaultTrackingStages(type))}
        >
          <RotateCcw aria-hidden="true" />
          Restore the built-in stages
        </Button>
      </div>
    </div>
  )
}
