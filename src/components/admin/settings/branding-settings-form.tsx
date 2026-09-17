"use client"

import { Moon, Sun } from "lucide-react"

import {
  SettingsFormAlert,
  SettingsSaveBar,
  useSettingsForm,
} from "@/components/admin/settings/settings-form-controls"
import { SettingsField, SettingsPanel } from "@/components/admin/settings/settings-ui"
import { Input } from "@/components/ui/input"
import { AdminTheme } from "@/generated/prisma/enums"
import { updateBrandingSettingsAction } from "@/lib/actions/settings.actions"
import { cn } from "@/lib/utils"

const THEMES = [
  { value: AdminTheme.LIGHT, label: "Light", icon: Sun, preview: "bg-[oklch(0.99_0.004_90)]", bar: "bg-[oklch(0.16_0.004_90)]" },
  { value: AdminTheme.DARK, label: "Dark", icon: Moon, preview: "bg-[oklch(0.11_0.003_90)]", bar: "bg-[oklch(0.22_0.004_90)]" },
] as const

/** Settings → Website & branding: the tab title and the dashboard's default appearance. */
export function BrandingSettingsForm({
  siteTitle,
  businessName,
  defaultDashboardTheme,
  canEdit,
}: {
  siteTitle: string | null
  businessName: string
  defaultDashboardTheme: AdminTheme
  canEdit: boolean
}) {
  const { state, pending, dirty, fieldError, formProps } = useSettingsForm(updateBrandingSettingsAction)

  return (
    <form {...formProps} className="flex flex-col gap-6">
      <SettingsFormAlert state={state} />

      <fieldset disabled={!canEdit} className="flex min-w-0 flex-col gap-6">
        <SettingsPanel
          id="site-identity"
          title="Site identity"
          description="How the website names itself in browser tabs and bookmarks."
        >
          <SettingsField
            label="Site title"
            htmlFor="siteTitle"
            hint={`Added after every page title, e.g. “Cars for sale | ${siteTitle || businessName}”. Leave empty to use the business name.`}
            error={fieldError("siteTitle")}
          >
            <Input
              id="siteTitle"
              name="siteTitle"
              defaultValue={siteTitle ?? ""}
              placeholder={businessName}
              maxLength={60}
              aria-invalid={fieldError("siteTitle") ? true : undefined}
              aria-describedby={fieldError("siteTitle") ? "siteTitle-error" : "siteTitle-hint"}
            />
          </SettingsField>
        </SettingsPanel>

        <SettingsPanel
          id="dashboard-theme"
          title="Default dashboard theme"
          description="What the dashboard opens in for an administrator who has not chosen. Each administrator can switch from their profile menu."
        >
          <div role="radiogroup" aria-label="Default dashboard theme" className="grid max-w-md grid-cols-2 gap-3">
            {THEMES.map((theme) => {
              const Icon = theme.icon
              return (
                <label key={theme.value} className="group/theme cursor-pointer">
                  <input
                    type="radio"
                    name="defaultDashboardTheme"
                    value={theme.value}
                    defaultChecked={defaultDashboardTheme === theme.value}
                    className="peer sr-only"
                  />
                  <span
                    className={cn(
                      "flex flex-col gap-2 rounded-lg border border-border p-2.5 transition-[border-color,box-shadow] duration-fast",
                      "peer-checked:border-gold-ink peer-checked:ring-2 peer-checked:ring-gold/30",
                      "peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50"
                    )}
                  >
                    <span aria-hidden="true" className={cn("flex h-16 gap-1.5 overflow-hidden rounded-md p-1.5 ring-1 ring-border", theme.preview)}>
                      <span className={cn("w-1/4 rounded-sm", theme.bar)} />
                      <span className="flex flex-1 flex-col gap-1">
                        <span className={cn("h-2 w-2/3 rounded-sm opacity-40", theme.bar)} />
                        <span className={cn("h-2 w-1/2 rounded-sm opacity-25", theme.bar)} />
                        <span className="mt-auto h-2 w-1/3 rounded-sm bg-[oklch(0.8_0.145_85)]" />
                      </span>
                    </span>
                    <span className="flex items-center gap-1.5 text-small font-medium">
                      <Icon aria-hidden="true" className="size-3.5" />
                      {theme.label}
                    </span>
                  </span>
                </label>
              )
            })}
          </div>
          {fieldError("defaultDashboardTheme") ? (
            <p className="text-small text-destructive">{fieldError("defaultDashboardTheme")}</p>
          ) : null}
        </SettingsPanel>
      </fieldset>

      {canEdit ? <SettingsSaveBar state={state} pending={pending} dirty={dirty} /> : null}
    </form>
  )
}
