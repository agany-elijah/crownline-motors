"use client"

import * as React from "react"
import { Lock } from "lucide-react"

import { SparePartDeliveryStepsEditor } from "@/components/admin/spare-part-delivery-steps-editor"
import {
  SettingsFormAlert,
  SettingsSaveBar,
  useSettingsForm,
} from "@/components/admin/settings/settings-form-controls"
import { TrackingStagesEditor } from "@/components/admin/settings/tracking-stages-editor"
import {
  SettingsField,
  SettingsFieldGrid,
  SettingsPanel,
  SettingsReadOnlyValue,
} from "@/components/admin/settings/settings-ui"
import { Input } from "@/components/ui/input"
import { updateOrdersTrackingSettingsAction } from "@/lib/actions/settings.actions"
import type { BusinessSettingsDTO } from "@/lib/queries/settings.queries"

type Props = {
  settings: Pick<BusinessSettingsDTO, "trackingNumberPrefix" | "trackingStages" | "sparePartDeliverySteps">
  sequence: { year: number; nextValue: number }
  canEdit: boolean
}

/** Settings → Orders & tracking. */
export function OrdersTrackingSettingsForm({ settings, sequence, canEdit }: Props) {
  const { state, pending, dirty, markDirty, fieldError, formProps } = useSettingsForm(
    updateOrdersTrackingSettingsAction
  )
  const [prefix, setPrefix] = React.useState(settings.trackingNumberPrefix)

  const padded = String(sequence.nextValue).padStart(6, "0")
  const previewPrefix = /^[A-Z]{2,6}$/.test(prefix) ? prefix : settings.trackingNumberPrefix

  return (
    <form {...formProps} className="flex flex-col gap-6">
      <SettingsFormAlert state={state} />

      <fieldset disabled={!canEdit} className="flex min-w-0 flex-col gap-6">
        <SettingsPanel
          id="tracking-number"
          title="Tracking numbers"
          description="Generated automatically when tracking is activated on an order. Only the letters at the start are configurable."
        >
          <SettingsFieldGrid>
            <SettingsField
              label="Tracking prefix"
              htmlFor="trackingNumberPrefix"
              hint="2–6 letters. Numbers already issued keep their prefix and still work."
              error={fieldError("trackingNumberPrefix")}
            >
              <Input
                id="trackingNumberPrefix"
                name="trackingNumberPrefix"
                value={prefix}
                onChange={(event) => setPrefix(event.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6))}
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                className="font-mono tracking-wider uppercase"
                aria-invalid={fieldError("trackingNumberPrefix") ? true : undefined}
                aria-describedby={fieldError("trackingNumberPrefix") ? "trackingNumberPrefix-error" : "trackingNumberPrefix-hint"}
              />
            </SettingsField>

            <SettingsReadOnlyValue
              label="Next number"
              value={
                <span className="font-mono">
                  {previewPrefix}-{sequence.year}-{padded}
                </span>
              }
              icon={<Lock aria-hidden="true" className="size-3.5 text-muted-foreground" />}
              note={
                <>
                  Format <span className="font-mono">{previewPrefix}-YYYY-######</span>. The sequence restarts each
                  January and is system-controlled, so no two orders share a number.
                </>
              }
            />
          </SettingsFieldGrid>
        </SettingsPanel>

        <SettingsPanel
          id="tracking-stages"
          title="Tracking stages"
          description="What customers see on Track My Order, and the stages staff can record. Stages between two fixed stages can be renamed, reordered or turned off."
        >
          <TrackingStagesEditor
            initial={settings.trackingStages}
            onChange={markDirty}
            error={fieldError("trackingStages")}
          />
        </SettingsPanel>

        <SettingsPanel
          id="spare-part-delivery"
          title="How a spare part reaches the customer"
          description="The steps shown on every spare-part page. Remove every step to hide the section."
        >
          {/* The editor's reorder and remove buttons change state without a
              change event, so any click inside it counts as an edit. */}
          <div onClick={markDirty}>
            <SparePartDeliveryStepsEditor
              steps={settings.sparePartDeliverySteps}
              error={fieldError("sparePartDeliverySteps")}
            />
          </div>
        </SettingsPanel>
      </fieldset>

      {canEdit ? <SettingsSaveBar state={state} pending={pending} dirty={dirty} /> : null}
    </form>
  )
}
