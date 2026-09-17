"use client"

import {
  SettingsFormAlert,
  SettingsSaveBar,
  useSettingsForm,
} from "@/components/admin/settings/settings-form-controls"
import { SettingsSwitchGrid, SettingsSwitchTile } from "@/components/admin/settings/settings-switch-grid"
import { SettingsPanel } from "@/components/admin/settings/settings-ui"
import { updateCatalogDisplayAction } from "@/lib/actions/settings.actions"
import { CATALOG_ACTIONS, CATALOG_ACTION_COPY, type CatalogDisplaySettings } from "@/lib/settings/catalog-display"
import {
  SPARE_PART_INFO_COPY,
  SPARE_PART_INFO_FIELDS,
  VEHICLE_INFO_COPY,
  VEHICLE_INFO_FIELDS,
} from "@/lib/visibility/product-visibility"

/**
 * Settings → Catalogue display.
 *
 * What customers can see, for the whole site. A fact switched off here is
 * hidden everywhere it appears — cards, listing pages, the quick view,
 * search, page metadata and messages — not just on the cards. A single
 * listing can additionally hide facts of its own from its edit page.
 *
 * Every switch is always in the DOM, so a save submits all of them together.
 */
export function CatalogDisplayForm({ settings, canEdit }: { settings: CatalogDisplaySettings; canEdit: boolean }) {
  const { state, pending, dirty, markDirty, formProps } = useSettingsForm(updateCatalogDisplayAction)

  return (
    <form {...formProps} className="flex flex-col gap-6">
      <SettingsFormAlert state={state} />

      <fieldset disabled={!canEdit} className="flex min-w-0 flex-col gap-6">
        <SettingsPanel
          id="vehicle-visibility"
          title="Vehicles"
          description="Switch off anything customers should not see. It is hidden across the whole website. To hide details on one vehicle only, use Customer visibility on that vehicle."
        >
          <SettingsSwitchGrid>
            {VEHICLE_INFO_FIELDS.map((field) => (
              <SettingsSwitchTile
                key={field}
                name={`vehicle.${field}`}
                label={VEHICLE_INFO_COPY[field].label}
                description={VEHICLE_INFO_COPY[field].description}
                defaultChecked={settings.vehicle[field]}
                onCheckedChange={markDirty}
              />
            ))}
          </SettingsSwitchGrid>
        </SettingsPanel>

        <SettingsPanel
          id="spare-part-visibility"
          title="Spare parts"
          description="The same rule for parts: off hides it everywhere. A single part can hide details of its own from its edit page."
        >
          <SettingsSwitchGrid>
            {SPARE_PART_INFO_FIELDS.map((field) => (
              <SettingsSwitchTile
                key={field}
                name={`sparePart.${field}`}
                label={SPARE_PART_INFO_COPY[field].label}
                description={SPARE_PART_INFO_COPY[field].description}
                defaultChecked={settings.sparePart[field]}
                onCheckedChange={markDirty}
              />
            ))}
          </SettingsSwitchGrid>
        </SettingsPanel>

        <SettingsPanel id="catalog-actions" title="Website buttons" description="Which calls to action appear on the public site.">
          <SettingsSwitchGrid>
            {CATALOG_ACTIONS.map((action) => (
              <SettingsSwitchTile
                key={action}
                name={`actions.${action}`}
                label={CATALOG_ACTION_COPY[action].label}
                description={CATALOG_ACTION_COPY[action].description}
                defaultChecked={settings.actions[action]}
                onCheckedChange={markDirty}
              />
            ))}
          </SettingsSwitchGrid>
        </SettingsPanel>
      </fieldset>

      {canEdit ? <SettingsSaveBar state={state} pending={pending} dirty={dirty} /> : null}
    </form>
  )
}
