"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowUpRight, Lock } from "lucide-react"

import {
  SettingsFormAlert,
  SettingsSaveBar,
  useSettingsForm,
} from "@/components/admin/settings/settings-form-controls"
import {
  NATIVE_SELECT_CLASS,
  SettingsField,
  SettingsFieldGrid,
  SettingsPanel,
  SettingsReadOnlyValue,
} from "@/components/admin/settings/settings-ui"
import { WhatsAppGlyph } from "@/components/shared/whatsapp-glyph"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { updateBusinessInformationAction } from "@/lib/actions/settings.actions"
import { adminPath } from "@/lib/constants/admin-routes"
import type { BusinessSettingsDTO } from "@/lib/queries/settings.queries"
import {
  DEFAULT_BUSINESS_HOURS,
  WEEKDAY_LABELS,
  type BusinessHours,
  type BusinessHoursDay,
} from "@/lib/settings/business-hours"
import { cn } from "@/lib/utils"
import { DIAL_CODES } from "@/lib/utils/phone"
import { SOCIAL_NETWORKS, type SocialNetworkField } from "@/lib/validations/settings.schema"

type Props = {
  settings: Pick<
    BusinessSettingsDTO,
    | "businessName"
    | "businessDescription"
    | "defaultCountry"
    | "primaryPhone"
    | "whatsappNumber"
    | "businessEmail"
    | "businessAddress"
    | "businessHours"
    | "social"
  >
  canEdit: boolean
}

const SOCIAL_PLACEHOLDERS: Record<SocialNetworkField, string> = {
  socialFacebook: "https://facebook.com/yourpage",
  socialInstagram: "https://instagram.com/yourhandle",
  socialTiktok: "https://tiktok.com/@yourhandle",
  socialYoutube: "https://youtube.com/@yourchannel",
  socialLinkedin: "https://linkedin.com/company/yourcompany",
  socialX: "https://x.com/yourhandle",
}

/**
 * Settings → Business information.
 *
 * The values here are the ones every other surface reads: the header and
 * footer, page titles, emails, quotation PDFs and WhatsApp messages all take
 * the business name from this form, so a rename happens once.
 */
export function BusinessInformationForm({ settings, canEdit }: Props) {
  const { state, pending, dirty, markDirty, fieldError, formProps } = useSettingsForm(updateBusinessInformationAction)

  const [publishHours, setPublishHours] = React.useState(settings.businessHours !== null)
  const [hours, setHours] = React.useState<BusinessHours>(settings.businessHours ?? DEFAULT_BUSINESS_HOURS)

  function updateDay(index: number, patch: Partial<BusinessHoursDay>) {
    setHours((current) => current.map((day, position) => (position === index ? { ...day, ...patch } : day)))
    markDirty()
  }

  /** Monday's hours onto every other open day — the one bulk edit a week of hours needs. */
  function copyMondayToOpenDays() {
    const [monday] = hours
    setHours((current) =>
      current.map((day, index) =>
        index === 0 || day.closed ? day : { ...day, opensAt: monday.opensAt, closesAt: monday.closesAt }
      )
    )
    markDirty()
  }

  const [whatsapp, setWhatsapp] = React.useState(settings.whatsappNumber)
  const whatsappDigits = whatsapp.replace(/\D/g, "")
  const whatsappTestUrl = whatsappDigits.length >= 8 ? `https://wa.me/${whatsappDigits}` : null

  const describedBy = (name: string, hasHint = true) =>
    fieldError(name) ? `${name}-error` : hasHint ? `${name}-hint` : undefined

  return (
    <form {...formProps} className="flex flex-col gap-6">
      <SettingsFormAlert state={state} />

      <fieldset disabled={!canEdit} className="flex min-w-0 flex-col gap-6">
        {/* ── WhatsApp and contact ─────────────────────────────────
            First on the page: the WhatsApp number is what every "WhatsApp
            us" button on the website dials, so it is the setting an
            operator most needs to find and most needs to get right. */}
        <SettingsPanel
          id="contact-information"
          title="WhatsApp & contact"
          description="How customers reach the dealership. Published on the website; leave a field empty to hide it."
        >
          <div data-settings-field="" className="flex min-w-0 flex-col gap-1.5">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="whatsappNumber" className="flex items-center gap-2 text-small font-medium text-foreground">
                <WhatsAppGlyph className="size-4 text-[#25D366]" />
                WhatsApp number
              </label>
              {whatsappTestUrl ? (
                <a
                  href={whatsappTestUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  Test link
                  <ArrowUpRight aria-hidden="true" className="size-3" />
                </a>
              ) : null}
            </div>
            <Input
              id="whatsappNumber"
              name="whatsappNumber"
              type="tel"
              inputMode="tel"
              placeholder="+211900000000"
              value={whatsapp}
              onChange={(event) => setWhatsapp(event.target.value)}
              aria-invalid={fieldError("whatsappNumber") ? true : undefined}
              aria-describedby={describedBy("whatsappNumber")}
            />
            {fieldError("whatsappNumber") ? (
              <p id="whatsappNumber-error" className="text-xs text-destructive">
                {fieldError("whatsappNumber")}
              </p>
            ) : (
              <p id="whatsappNumber-hint" className="text-xs text-muted-foreground">
                Full international format with the country code. Every WhatsApp button on the website uses it.
              </p>
            )}
          </div>

          <SettingsFieldGrid>
            <SettingsField
              label="Primary phone number"
              htmlFor="primaryPhone"
              hint="Used for the “Call us” buttons."
              error={fieldError("primaryPhone")}
            >
              <Input
                id="primaryPhone"
                name="primaryPhone"
                type="tel"
                inputMode="tel"
                placeholder="+211 900 000 000"
                defaultValue={settings.primaryPhone}
                aria-invalid={fieldError("primaryPhone") ? true : undefined}
                aria-describedby={describedBy("primaryPhone")}
              />
            </SettingsField>

            <SettingsField label="Business email" htmlFor="businessEmail" error={fieldError("businessEmail")}>
              <Input
                id="businessEmail"
                name="businessEmail"
                type="email"
                inputMode="email"
                placeholder="info@example.com"
                defaultValue={settings.businessEmail}
                aria-invalid={fieldError("businessEmail") ? true : undefined}
                aria-describedby={describedBy("businessEmail", false)}
              />
            </SettingsField>
          </SettingsFieldGrid>

          <SettingsField label="Address / location" htmlFor="businessAddress" error={fieldError("businessAddress")}>
            <Input
              id="businessAddress"
              name="businessAddress"
              placeholder="Juba, South Sudan"
              defaultValue={settings.businessAddress}
              maxLength={200}
              autoComplete="street-address"
              aria-invalid={fieldError("businessAddress") ? true : undefined}
              aria-describedby={describedBy("businessAddress", false)}
            />
          </SettingsField>
        </SettingsPanel>

        {/* ── Identity ──────────────────────────────────────────── */}
        <SettingsPanel
          id="business-identity"
          title="Business identity"
          description="How the company names and describes itself across the website, emails and quotations."
        >
          <SettingsFieldGrid>
            <SettingsField
              label="Business name"
              htmlFor="businessName"
              hint="Shown in the header, footer, page titles, emails, quotations and WhatsApp messages."
              error={fieldError("businessName")}
            >
              <Input
                id="businessName"
                name="businessName"
                defaultValue={settings.businessName}
                maxLength={80}
                autoComplete="organization"
                aria-invalid={fieldError("businessName") ? true : undefined}
                aria-describedby={describedBy("businessName")}
              />
            </SettingsField>

            <SettingsField
              label="Default country"
              htmlFor="defaultCountry"
              hint="The dialling code customers’ phone numbers start from on the website’s forms."
              error={fieldError("defaultCountry")}
            >
              <select
                id="defaultCountry"
                name="defaultCountry"
                defaultValue={settings.defaultCountry}
                className={NATIVE_SELECT_CLASS}
                aria-describedby={describedBy("defaultCountry")}
              >
                {DIAL_CODES.map((entry) => (
                  <option key={entry.country} value={entry.country}>
                    {entry.label} (+{entry.code})
                  </option>
                ))}
              </select>
            </SettingsField>
          </SettingsFieldGrid>

          <SettingsField
            label="Business description"
            htmlFor="businessDescription"
            hint="One or two sentences. Used in the footer and as the default search description."
            error={fieldError("businessDescription")}
          >
            <Textarea
              id="businessDescription"
              name="businessDescription"
              rows={3}
              maxLength={300}
              defaultValue={settings.businessDescription}
              aria-invalid={fieldError("businessDescription") ? true : undefined}
              aria-describedby={describedBy("businessDescription")}
            />
          </SettingsField>

          <SettingsFieldGrid>
            <SettingsReadOnlyValue
              label="Currency"
              value="US Dollar (USD)"
              icon={<Lock aria-hidden="true" className="size-3.5 text-muted-foreground" />}
              note="Every amount is recorded in US dollars; other currencies arrive with multi-currency support."
            />

            <div className="flex min-w-0 flex-col gap-1.5">
              <span className="text-small font-medium text-foreground">Logo</span>
              <Link
                href={adminPath("/settings/branding")}
                className="flex h-11 items-center justify-between gap-2 rounded-lg border border-border px-3 text-small text-foreground transition-colors duration-fast hover:bg-muted"
              >
                <span className="truncate">Website &amp; branding</span>
                <ArrowUpRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
              </Link>
              <p className="text-xs text-muted-foreground">Logos are managed in one place for the whole site.</p>
            </div>
          </SettingsFieldGrid>
        </SettingsPanel>

        {/* ── Hours ─────────────────────────────────────────────── */}
        <SettingsPanel
          id="business-hours"
          title="Business hours"
          description="When customers can reach the dealership."
          action={
            <label className="flex cursor-pointer items-center gap-2.5 text-small font-medium">
              Publish hours
              <Switch
                name="publishHours"
                checked={publishHours}
                onCheckedChange={(checked) => {
                  setPublishHours(checked)
                  markDirty()
                }}
              />
            </label>
          }
        >
          <input type="hidden" name="businessHours" value={JSON.stringify(hours)} />

          <div className={cn("flex min-w-0 flex-col gap-1 transition-opacity duration-fast", !publishHours && "opacity-50")}>
            <ul className="flex flex-col divide-y divide-border">
              {hours.map((day, index) => (
                <li
                  key={day.day}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 py-2 sm:grid-cols-[7rem_auto_minmax(0,1fr)]"
                >
                  <span className="text-small font-medium">{WEEKDAY_LABELS[day.day]}</span>

                  <label className="flex cursor-pointer items-center gap-2 justify-self-end text-small text-muted-foreground sm:justify-self-start">
                    <Switch
                      checked={!day.closed}
                      onCheckedChange={(open) => updateDay(index, { closed: !open })}
                      disabled={!publishHours}
                      aria-label={`${WEEKDAY_LABELS[day.day]} open`}
                    />
                    <span className="w-11">{day.closed ? "Closed" : "Open"}</span>
                  </label>

                  <div
                    className={cn(
                      "col-span-2 flex min-w-0 items-center gap-2 sm:col-span-1 sm:justify-self-end",
                      day.closed && "hidden sm:flex sm:invisible"
                    )}
                  >
                    <Input
                      type="time"
                      aria-label={`${WEEKDAY_LABELS[day.day]} opening time`}
                      value={day.opensAt}
                      onChange={(event) => updateDay(index, { opensAt: event.target.value })}
                      disabled={!publishHours || day.closed}
                      className="h-9 min-w-0 flex-1 sm:w-32 sm:flex-none"
                    />
                    <span aria-hidden="true" className="text-muted-foreground">
                      –
                    </span>
                    <Input
                      type="time"
                      aria-label={`${WEEKDAY_LABELS[day.day]} closing time`}
                      value={day.closesAt}
                      onChange={(event) => updateDay(index, { closesAt: event.target.value })}
                      disabled={!publishHours || day.closed}
                      className="h-9 min-w-0 flex-1 sm:w-32 sm:flex-none"
                    />
                  </div>
                </li>
              ))}
            </ul>

            {fieldError("businessHours") ? (
              <p className="text-small text-destructive">{fieldError("businessHours")}</p>
            ) : null}

            <div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={copyMondayToOpenDays}
                disabled={!publishHours || hours[0].closed}
              >
                Copy Monday’s hours to every open day
              </Button>
            </div>
          </div>
        </SettingsPanel>

        {/* ── Social ────────────────────────────────────────────── */}
        <SettingsPanel
          id="social-media"
          title="Social media"
          description="Full links to the dealership’s own pages. Networks left empty are not shown."
        >
          <SettingsFieldGrid>
            {(Object.keys(SOCIAL_NETWORKS) as SocialNetworkField[]).map((field) => (
              <SettingsField
                key={field}
                label={SOCIAL_NETWORKS[field].label}
                htmlFor={field}
                error={fieldError(field)}
              >
                <Input
                  id={field}
                  name={field}
                  type="url"
                  inputMode="url"
                  placeholder={SOCIAL_PLACEHOLDERS[field]}
                  defaultValue={settings.social[field] ?? ""}
                  aria-invalid={fieldError(field) ? true : undefined}
                  aria-describedby={fieldError(field) ? `${field}-error` : undefined}
                />
              </SettingsField>
            ))}
          </SettingsFieldGrid>
        </SettingsPanel>
      </fieldset>

      {canEdit ? <SettingsSaveBar state={state} pending={pending} dirty={dirty} /> : null}
    </form>
  )
}
