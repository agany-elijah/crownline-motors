"use client"

import * as React from "react"
import { AlertTriangle } from "lucide-react"

import {
  SettingsFormAlert,
  SettingsSaveBar,
  SettingsSwitchList,
  SettingsSwitchRow,
  useSettingsForm,
} from "@/components/admin/settings/settings-form-controls"
import { SettingsField, SettingsPanel } from "@/components/admin/settings/settings-ui"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { updateSeoSettingsAction } from "@/lib/actions/settings.actions"
import { cn } from "@/lib/utils"

const TITLE_MAX = 70
const DESCRIPTION_MAX = 200

function Counter({ value, max, soft }: { value: string; max: number; soft: number }) {
  return (
    <span className={cn("tabular text-xs", value.length > soft ? "text-warning" : "text-muted-foreground")}>
      {value.length}/{max}
    </span>
  )
}

/**
 * Settings → SEO & social.
 *
 * The preview is an approximation of a search result, not a promise — search
 * engines rewrite titles and snippets as they see fit. It is here so an
 * operator can see a title being cut off before a customer does.
 */
export function SeoSettingsForm({
  settings,
  fallbackTitle,
  fallbackDescription,
  siteUrl,
  canEdit,
}: {
  settings: {
    seoDefaultTitle: string | null
    seoDefaultDescription: string | null
    sitemapEnabled: boolean
    searchIndexingEnabled: boolean
  }
  fallbackTitle: string
  fallbackDescription: string
  siteUrl: string
  canEdit: boolean
}) {
  const { state, pending, dirty, markDirty, fieldError, formProps } = useSettingsForm(updateSeoSettingsAction)
  const [title, setTitle] = React.useState(settings.seoDefaultTitle ?? "")
  const [description, setDescription] = React.useState(settings.seoDefaultDescription ?? "")
  const [indexing, setIndexing] = React.useState(settings.searchIndexingEnabled)

  const shownTitle = title.trim() || fallbackTitle
  const shownDescription = description.trim() || fallbackDescription

  return (
    <form {...formProps} className="flex flex-col gap-6">
      <SettingsFormAlert state={state} />

      <fieldset disabled={!canEdit} className="flex min-w-0 flex-col gap-6">
        <SettingsPanel
          id="search-defaults"
          title="Search engine defaults"
          description="Used by the homepage and any page without its own title and description. Vehicle and part pages write their own."
        >
          <SettingsField
            label={
              <span className="flex w-full items-center justify-between">
                Default SEO title <Counter value={title} max={TITLE_MAX} soft={60} />
              </span>
            }
            htmlFor="seoDefaultTitle"
            hint="Leave empty to use the business name and tagline."
            error={fieldError("seoDefaultTitle")}
          >
            <Input
              id="seoDefaultTitle"
              name="seoDefaultTitle"
              value={title}
              maxLength={TITLE_MAX}
              placeholder={fallbackTitle}
              onChange={(event) => setTitle(event.target.value)}
              aria-invalid={fieldError("seoDefaultTitle") ? true : undefined}
            />
          </SettingsField>

          <SettingsField
            label={
              <span className="flex w-full items-center justify-between">
                Default SEO description <Counter value={description} max={DESCRIPTION_MAX} soft={160} />
              </span>
            }
            htmlFor="seoDefaultDescription"
            hint="Leave empty to use the business description."
            error={fieldError("seoDefaultDescription")}
          >
            <Textarea
              id="seoDefaultDescription"
              name="seoDefaultDescription"
              rows={3}
              value={description}
              maxLength={DESCRIPTION_MAX}
              placeholder={fallbackDescription}
              onChange={(event) => setDescription(event.target.value)}
              aria-invalid={fieldError("seoDefaultDescription") ? true : undefined}
            />
          </SettingsField>

          <div aria-hidden="true" className="flex flex-col gap-1 rounded-lg border border-border bg-background p-4">
            <span className="text-xs text-muted-foreground">Search result preview</span>
            <span className="truncate text-xs text-success">{siteUrl.replace(/^https?:\/\//, "")}</span>
            <span className="line-clamp-1 text-body-lg font-medium text-[oklch(0.45_0.12_260)] dark:text-[oklch(0.78_0.1_260)]">
              {shownTitle}
            </span>
            <span className="line-clamp-2 text-small text-muted-foreground">{shownDescription}</span>
          </div>
        </SettingsPanel>

        <SettingsPanel id="crawling" title="Crawling" description="Whether search engines may find and list the site.">
          <SettingsSwitchList>
            <SettingsSwitchRow
              name="sitemapEnabled"
              label="Sitemap"
              description="Publish /sitemap.xml, the list of pages search engines use to discover the site."
              defaultChecked={settings.sitemapEnabled}
              onCheckedChange={markDirty}
            />
            <SettingsSwitchRow
              name="searchIndexingEnabled"
              label="Search engine indexing"
              description="Allow search engines to list the website in their results."
              checked={indexing}
              onCheckedChange={(checked) => {
                setIndexing(checked)
                markDirty()
              }}
            />
          </SettingsSwitchList>

          {!indexing ? (
            <div className="flex items-start gap-2.5 rounded-lg border border-warning/35 bg-warning/5 px-4 py-3 text-small">
              <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
              <p>
                With indexing off, every page asks search engines not to list it and robots.txt disallows the whole
                site. Existing listings drop out of search results over the following days.
              </p>
            </div>
          ) : null}
        </SettingsPanel>
      </fieldset>

      {canEdit ? <SettingsSaveBar state={state} pending={pending} dirty={dirty} /> : null}
    </form>
  )
}
