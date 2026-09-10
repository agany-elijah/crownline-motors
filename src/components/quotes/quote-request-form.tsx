"use client"

import * as React from "react"
import Image from "next/image"
import {
  AlertCircle,
  Car,
  CheckCircle2,
  ChevronDown,
  Copy,
  ImageOff,
  Loader2,
  Package,
  Send,
} from "lucide-react"

import { QuoteType } from "@/generated/prisma/enums"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useSiteContact } from "@/components/shared/site-contact-provider"
import { WhatsAppGlyph } from "@/components/shared/whatsapp-glyph"
import { siteConfig } from "@/config/site"
import {
  submitQuoteRequestAction,
  type QuoteRequestState,
} from "@/lib/actions/quote-request.actions"
import type { CartItem } from "@/lib/cart/cart-storage"
import {
  COUNTRY_OPTIONS,
  FUEL_TYPE_OPTIONS,
  TRANSMISSION_OPTIONS,
  VEHICLE_YEAR_MIN,
  vehicleYearMax,
} from "@/lib/constants/vehicle-options"
import {
  contactFromFormData,
  getRememberedContactSnapshot,
  getServerRememberedContactSnapshot,
  subscribeRememberedContact,
  writeRememberedContact,
  type RememberedContact,
} from "@/lib/quotes/remembered-contact"
import { cn } from "@/lib/utils"
import { DEFAULT_DIAL_COUNTRY, DIAL_CODES, findDialCode } from "@/lib/utils/phone"
import { buildQuoteFollowUpWhatsAppMessage, buildWhatsAppUrl } from "@/lib/utils/whatsapp"
import { QUOTE_HONEYPOT_FIELD, QUOTE_NOTES_MAX } from "@/lib/validations/quote.schema"

/**
 * The quotation request form — one component behind every "Get a quote" on
 * the site.
 *
 * ── One form, three subjects ──────────────────────────────────────────
 *   VEHICLE_LISTING  the vehicle page. The car is filled in for the
 *                    customer, as one line: "Toyota Harrier XGL 2024
 *                    Automatic".
 *   PARTS_LIST       the parts list. Every shortlisted part is filled in,
 *                    with its quantity.
 *   GENERAL          "haven't found it?" on both catalogues, and the Get a
 *                    Quote page. Nothing to fill in — the customer's own
 *                    words are the request.
 *
 * The contact block is identical in all three, deliberately: a customer who
 * has filled it once recognises it the second time, and it is remembered for
 * the rest of the visit (see remembered-contact.ts), so the second time it is
 * already done.
 *
 * ── What the browser sends ────────────────────────────────────────────
 * Identifiers only — a vehicle slug, or `[{ slug, quantity }]` for parts.
 * Never a name, a description or a price: the server re-reads every one from
 * the catalogue, so nothing this component displays is trusted by it. The
 * summary row here is a courtesy copy of what the server will record.
 *
 * ── Progressive by construction ───────────────────────────────────────
 * A real `<form action>` posting to a Server Action, with native inputs and
 * native selects. It validates on the server, always; the `required` and
 * `type` attributes are there to catch the obvious slip before a round trip
 * on a slow connection, not to decide anything.
 */

export type QuoteRequestSubject =
  | {
      kind: "VEHICLE_LISTING"
      vehicleSlug: string
      /** "Toyota Harrier XGL 2024 Automatic" — see vehicleSubjectLabel. */
      label: string
      imageUrl: string | null
    }
  | {
      kind: "PARTS_LIST"
      items: readonly CartItem[]
    }
  | {
      kind: "GENERAL"
      source: "VEHICLE_CATALOGUE" | "SPARE_PART_CATALOGUE" | "QUOTE_PAGE"
      /** Fixed by a catalogue; chosen by the customer on the Get a Quote page. */
      domain?: QuoteType
      /** Offer the optional structured fields (make, budget, part number…). */
      detailed?: boolean
    }

interface QuoteRequestFormProps {
  subject: QuoteRequestSubject
  /** The submit button's words — "Submit request", "Request items". */
  submitLabel: string
  /** Called once, when a request has been stored. */
  onSubmitted?: (quoteNumber: string) => void
  /** Renders a "Done" button on the confirmation, e.g. to close a dialog. */
  onDone?: () => void
  className?: string
}

const INITIAL_STATE: QuoteRequestState = { status: "idle" }

const SOURCE_BY_KIND = {
  VEHICLE_LISTING: "VEHICLE_PAGE",
  PARTS_LIST: "SPARE_PART_CART",
} as const

/** How many shortlisted parts are listed before "and N more". */
const PARTS_PREVIEW_LIMIT = 4

export function QuoteRequestForm({
  subject,
  submitLabel,
  onSubmitted,
  onDone,
  className,
}: QuoteRequestFormProps) {
  /**
   * The Server Action itself, not a client wrapper around it: that keeps the
   * form working as a plain POST on the server-rendered Get a Quote page
   * before JavaScript has loaded.
   */
  const [state, formAction, isPending] = React.useActionState(
    submitQuoteRequestAction,
    INITIAL_STATE
  )

  const remembered = React.useSyncExternalStore(
    subscribeRememberedContact,
    getRememberedContactSnapshot,
    getServerRememberedContactSnapshot
  )

  /**
   * Re-mounts the fields whenever the defaults they should show change: after
   * a rejected submission (so they settle on what was echoed back rather than
   * on the blank defaults React's form reset would restore), and once when a
   * remembered contact becomes readable after hydration. The same technique
   * the vehicle form uses — see `controlKey` there.
   */
  const [fieldsKey, setFieldsKey] = React.useState(0)
  const [lastState, setLastState] = React.useState(state)
  const [lastRemembered, setLastRemembered] = React.useState(remembered)

  if (state !== lastState || remembered !== lastRemembered) {
    setLastState(state)
    setLastRemembered(remembered)
    setFieldsKey((key) => key + 1)
  }

  const formRef = React.useRef<HTMLFormElement>(null)
  const reportedRef = React.useRef<string | null>(null)
  /** The contact details of the submission in flight, captured on submit. */
  const submittedContactRef = React.useRef<RememberedContact | null>(null)

  /**
   * Once a request is stored: remember the details it was sent with, and
   * tell the owner (a parts list clears itself). Remembered only on success —
   * remembering a rejected phone number would pre-fill the next form with the
   * same mistake.
   */
  React.useEffect(() => {
    if (state.status !== "success" || !state.quoteNumber) return
    if (reportedRef.current === state.quoteNumber) return

    reportedRef.current = state.quoteNumber

    if (submittedContactRef.current) {
      writeRememberedContact(submittedContactRef.current)
      submittedContactRef.current = null
    }

    onSubmitted?.(state.quoteNumber)
  }, [state, onSubmitted])

  // After a rejection, put the cursor in the first field that needs fixing,
  // so a screen-reader user lands on the problem rather than on the button.
  React.useEffect(() => {
    if (state.status !== "error") return

    const invalid = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')
    invalid?.focus()
  }, [state])

  if (state.status === "success") {
    return (
      <QuoteRequestConfirmation
        quoteNumber={state.quoteNumber}
        skippedItems={state.skippedItems ?? 0}
        onDone={onDone}
        className={className}
      />
    )
  }

  const defaults = resolveDefaults(state.values, remembered)
  const error = (name: string) => state.fieldErrors?.[name]?.[0]

  const source = subject.kind === "GENERAL" ? subject.source : SOURCE_BY_KIND[subject.kind]

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={(event) => {
        submittedContactRef.current = contactFromFormData(new FormData(event.currentTarget))
      }}
      noValidate
      className={cn("flex flex-col gap-6", className)}
      aria-describedby={state.status === "error" && state.message ? "quote-form-error" : undefined}
    >
      <input type="hidden" name="requestKind" value={subject.kind} />
      <input type="hidden" name="source" value={source} />

      {subject.kind === "VEHICLE_LISTING" ? (
        <input type="hidden" name="vehicleSlug" value={subject.vehicleSlug} />
      ) : null}

      {subject.kind === "PARTS_LIST" ? (
        <input
          type="hidden"
          name="items"
          // Slug and quantity only. The server describes and prices every
          // part itself; see the note at the top of this file.
          value={JSON.stringify(
            subject.items.map((item) => ({ slug: item.slug, quantity: item.quantity }))
          )}
        />
      ) : null}

      {/*
        The honeypot. Off-screen rather than `display: none` (some bots skip
        hidden fields), out of the tab order, and hidden from assistive
        technology so nobody real is ever asked to fill it.
      */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Leave this field empty
          <input type="text" name={QUOTE_HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>

      {state.status === "error" && state.message ? (
        <div
          id="quote-form-error"
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-3 text-small text-destructive"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>{state.message}</span>
        </div>
      ) : null}

      <div key={fieldsKey} className="flex flex-col gap-6">
        {/* ── Who is asking ──────────────────────────────────────── */}
        <fieldset className="flex flex-col gap-4">
          <legend className="mb-3 eyebrow text-muted-foreground">Your details</legend>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Full name"
              name="fullName"
              autoComplete="name"
              defaultValue={defaults.fullName}
              error={error("fullName")}
              required
              maxLength={120}
            />
            <TextField
              label="City or town"
              name="city"
              autoComplete="address-level2"
              placeholder="Juba"
              defaultValue={defaults.city}
              error={error("city")}
              required
              maxLength={80}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <PhoneField
              label="Phone number"
              name="phone"
              countryName="phoneCountry"
              autoComplete="tel-national"
              defaultNumber={defaults.phone}
              defaultCountry={defaults.phoneCountry}
              error={error("phone")}
              required
            />
            <TextField
              label="Email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              defaultValue={defaults.email}
              error={error("email")}
              optional
              maxLength={254}
            />
          </div>

          <WhatsAppFields
            defaultSame={defaults.whatsappSameAsPhone}
            defaultNumber={defaults.whatsapp}
            defaultCountry={defaults.whatsappCountry}
            error={error("whatsapp")}
          />
        </fieldset>

        {/* ── What they are asking about ─────────────────────────── */}
        {subject.kind === "VEHICLE_LISTING" ? <VehicleSummary subject={subject} /> : null}
        {subject.kind === "PARTS_LIST" ? <PartsSummary items={subject.items} /> : null}

        {subject.kind === "GENERAL" ? (
          <GeneralRequestFields
            subject={subject}
            defaults={state.values ?? {}}
            error={error}
          />
        ) : null}

        {/* ── In their own words ─────────────────────────────────── */}
        <NotesField
          label={
            subject.kind === "GENERAL"
              ? subject.detailed
                ? "Anything else we should know?"
                : "What are you looking for?"
              : "Additional notes"
          }
          placeholder={notesPlaceholder(subject)}
          defaultValue={state.values?.notes ?? ""}
          error={error("notes")}
          required={subject.kind === "GENERAL" && !subject.detailed}
        />
      </div>

      <div className="flex flex-col gap-3">
        <Button type="submit" size="lg" disabled={isPending} className="w-full">
          {isPending ? (
            <>
              <Loader2 aria-hidden="true" className="animate-spin" />
              Sending
            </>
          ) : (
            <>
              <Send aria-hidden="true" />
              {submitLabel}
            </>
          )}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          No commitment. We confirm the full price before you pay anything, and
          we only use your details to reply to this request.
        </p>
      </div>
    </form>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Defaults
// ─────────────────────────────────────────────────────────────────────

interface ContactDefaults {
  fullName: string
  phoneCountry: string
  phone: string
  whatsappSameAsPhone: boolean
  whatsappCountry: string
  whatsapp: string
  email: string
  city: string
}

/**
 * What was just submitted wins (so a rejected form comes back as typed),
 * then what was remembered from an earlier request this visit, then blank.
 */
function resolveDefaults(
  echoed: Record<string, string> | undefined,
  remembered: RememberedContact | null
): ContactDefaults {
  if (echoed) {
    return {
      fullName: echoed.fullName ?? "",
      phoneCountry: echoed.phoneCountry ?? DEFAULT_DIAL_COUNTRY,
      phone: echoed.phone ?? "",
      whatsappSameAsPhone: echoed.whatsappSameAsPhone === "on",
      whatsappCountry: echoed.whatsappCountry ?? DEFAULT_DIAL_COUNTRY,
      whatsapp: echoed.whatsapp ?? "",
      email: echoed.email ?? "",
      city: echoed.city ?? "",
    }
  }

  return {
    fullName: remembered?.fullName ?? "",
    phoneCountry: remembered?.phoneCountry || DEFAULT_DIAL_COUNTRY,
    phone: remembered?.phone ?? "",
    whatsappSameAsPhone: remembered?.whatsappSameAsPhone ?? true,
    whatsappCountry: remembered?.whatsappCountry || DEFAULT_DIAL_COUNTRY,
    whatsapp: remembered?.whatsapp ?? "",
    email: remembered?.email ?? "",
    city: remembered?.city ?? "",
  }
}

function notesPlaceholder(subject: QuoteRequestSubject): string {
  if (subject.kind === "VEHICLE_LISTING") {
    return "Anything we should know — where you will collect, a colour or grade you prefer, questions about the car…"
  }

  if (subject.kind === "PARTS_LIST") {
    return "Your car's make, model and year help us confirm fitment. Add anything else we should know."
  }

  if (subject.domain === QuoteType.SPARE_PART) {
    return "The part name or number, and your car's make, model and year — e.g. front brake pads for a 2019 Toyota Harrier 2.0L."
  }

  return "The make, model, year and budget you have in mind — e.g. a Toyota Land Cruiser Prado, 2018 or newer, diesel, under $35,000."
}

// ─────────────────────────────────────────────────────────────────────
// Fields
// ─────────────────────────────────────────────────────────────────────

function FieldMessage({ id, error }: { id: string; error?: string }) {
  if (!error) return null

  return (
    <p id={id} className="text-small text-destructive">
      {error}
    </p>
  )
}

function FieldLabel({
  htmlFor,
  label,
  optional,
}: {
  htmlFor: string
  label: string
  optional?: boolean
}) {
  return (
    <Label htmlFor={htmlFor} className="justify-between">
      <span>{label}</span>
      {optional ? <span className="text-xs font-normal text-muted-foreground">Optional</span> : null}
    </Label>
  )
}

function TextField({
  label,
  name,
  error,
  optional,
  className,
  ...inputProps
}: Omit<React.ComponentProps<"input">, "name"> & {
  label: string
  name: string
  error?: string
  optional?: boolean
}) {
  const id = React.useId()
  const errorId = `${id}-error`

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <FieldLabel htmlFor={id} label={label} optional={optional} />
      <Input
        {...inputProps}
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      />
      <FieldMessage id={errorId} error={error} />
    </div>
  )
}

/**
 * A phone number with its country code.
 *
 * The country is asked separately because customers type the national form
 * ("0912 345 678"), and the server needs E.164 to de-duplicate customers and
 * to build a WhatsApp link that reaches anybody — see utils/phone.ts. A
 * number typed in full with its own "+" wins over the select, so a customer
 * whose country is not listed is never stuck.
 *
 * The select is the native control, laid invisibly over a compact "+211"
 * face: keyboard, screen reader and the phone's own picker all operate the
 * real `<select>`, and the full country names are what they announce, while
 * the field still reads as one input rather than two.
 */
function PhoneField({
  label,
  name,
  countryName,
  defaultNumber,
  defaultCountry,
  error,
  required,
  autoComplete,
  className,
}: {
  label: string
  name: string
  countryName: string
  defaultNumber: string
  defaultCountry: string
  error?: string
  required?: boolean
  autoComplete?: string
  className?: string
}) {
  const id = React.useId()
  const errorId = `${id}-error`
  const [country, setCountry] = React.useState(
    findDialCode(defaultCountry) ? defaultCountry : DEFAULT_DIAL_COUNTRY
  )
  const dial = findDialCode(country) ?? DIAL_CODES[0]

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <FieldLabel htmlFor={id} label={label} />

      <div
        className={cn(
          "flex h-11 w-full overflow-hidden rounded-lg border bg-card transition-colors",
          "focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
          error ? "border-destructive ring-3 ring-destructive/20" : "border-input"
        )}
      >
        <div className="relative flex shrink-0 items-center gap-1 border-r border-input bg-secondary/60 pr-2 pl-3 text-small font-medium text-foreground">
          <span aria-hidden="true" className="tabular">
            +{dial.code}
          </span>
          <ChevronDown aria-hidden="true" className="size-3.5 text-muted-foreground" />
          <select
            name={countryName}
            value={country}
            onChange={(event) => setCountry(event.target.value)}
            aria-label={`${label} country code`}
            className="absolute inset-0 cursor-pointer opacity-0"
          >
            {DIAL_CODES.map((entry) => (
              <option key={entry.country} value={entry.country}>
                {entry.label} (+{entry.code})
              </option>
            ))}
          </select>
        </div>

        <input
          id={id}
          name={name}
          type="tel"
          inputMode="tel"
          autoComplete={autoComplete}
          defaultValue={defaultNumber}
          placeholder="912 345 678"
          required={required}
          maxLength={32}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="min-w-0 flex-1 bg-transparent px-3 text-base text-foreground outline-none placeholder:text-muted-foreground md:text-sm"
        />
      </div>

      <FieldMessage id={errorId} error={error} />
    </div>
  )
}

/**
 * The WhatsApp number — usually the same as the phone, so that is the
 * default and the second number only appears when the box is unticked.
 */
function WhatsAppFields({
  defaultSame,
  defaultNumber,
  defaultCountry,
  error,
}: {
  defaultSame: boolean
  defaultNumber: string
  defaultCountry: string
  error?: string
}) {
  const id = React.useId()
  const [same, setSame] = React.useState(defaultSame)

  return (
    <div className="flex flex-col gap-3">
      <label
        htmlFor={id}
        className="flex w-fit cursor-pointer items-center gap-2.5 text-small text-foreground select-none"
      >
        <input
          id={id}
          type="checkbox"
          name="whatsappSameAsPhone"
          checked={same}
          onChange={(event) => setSame(event.target.checked)}
          className="size-4 rounded border-input accent-[#11823f]"
        />
        <span className="flex items-center gap-1.5">
          <WhatsAppGlyph className="size-4 text-[#11823f]" />
          My WhatsApp number is the same as my phone number
        </span>
      </label>

      {same ? null : (
        <PhoneField
          label="WhatsApp number"
          name="whatsapp"
          countryName="whatsappCountry"
          autoComplete="off"
          defaultNumber={defaultNumber}
          defaultCountry={defaultCountry}
          error={error}
          required
          className="sm:max-w-[calc(50%-0.5rem)]"
        />
      )}

      {same && error ? <FieldMessage id={`${id}-error`} error={error} /> : null}
    </div>
  )
}

function NotesField({
  label,
  placeholder,
  defaultValue,
  error,
  required,
}: {
  label: string
  placeholder: string
  defaultValue: string
  error?: string
  required?: boolean
}) {
  const id = React.useId()
  const errorId = `${id}-error`
  const counterId = `${id}-count`
  const [length, setLength] = React.useState(defaultValue.length)
  const nearLimit = length > QUOTE_NOTES_MAX * 0.9

  return (
    <div className="flex flex-col gap-2">
      <FieldLabel htmlFor={id} label={label} optional={!required} />
      <Textarea
        id={id}
        name="notes"
        defaultValue={defaultValue}
        placeholder={placeholder}
        maxLength={QUOTE_NOTES_MAX}
        rows={4}
        onChange={(event) => setLength(event.target.value.length)}
        aria-invalid={error ? true : undefined}
        aria-describedby={cn(error && errorId, nearLimit && counterId) || undefined}
        className="min-h-28"
      />
      <div className="flex items-start justify-between gap-3">
        <FieldMessage id={errorId} error={error} />
        {nearLimit ? (
          <span id={counterId} className="ml-auto text-xs tabular-nums text-muted-foreground">
            {length} / {QUOTE_NOTES_MAX}
          </span>
        ) : null}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// The auto-filled subject
// ─────────────────────────────────────────────────────────────────────

function SubjectFrame({
  heading,
  children,
}: {
  heading: string
  children: React.ReactNode
}) {
  return (
    <section aria-label={heading} className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="eyebrow text-muted-foreground">{heading}</h3>
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <CheckCircle2 aria-hidden="true" className="size-3.5 text-gold-ink" />
          Added for you
        </span>
      </div>
      {children}
    </section>
  )
}

function Thumbnail({ url, fallback }: { url: string | null; fallback: "car" | "part" }) {
  const Icon = fallback === "car" ? Car : ImageOff

  return (
    <div className="relative size-14 shrink-0 overflow-hidden rounded-md border border-border bg-card">
      {url ? (
        <Image
          src={url}
          alt=""
          fill
          sizes="56px"
          className={fallback === "car" ? "object-cover" : "object-contain p-1"}
        />
      ) : (
        <div className="flex size-full items-center justify-center text-muted-foreground">
          <Icon aria-hidden="true" className="size-5" />
        </div>
      )}
    </div>
  )
}

function VehicleSummary({
  subject,
}: {
  subject: Extract<QuoteRequestSubject, { kind: "VEHICLE_LISTING" }>
}) {
  return (
    <SubjectFrame heading="Vehicle">
      <div className="flex items-center gap-3.5 rounded-lg border border-gold-ink/25 bg-accent/60 p-3">
        <Thumbnail url={subject.imageUrl} fallback="car" />
        <p className="min-w-0 text-body font-semibold text-foreground">{subject.label}</p>
      </div>
    </SubjectFrame>
  )
}

function PartsSummary({ items }: { items: readonly CartItem[] }) {
  const shown = items.slice(0, PARTS_PREVIEW_LIMIT)
  const hidden = items.length - shown.length
  const units = items.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <SubjectFrame heading={units === 1 ? "1 item" : `${units} items`}>
      <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-gold-ink/25 bg-accent/60">
        {shown.map((item) => (
          <li key={item.slug} className="flex items-center gap-3 p-2.5">
            <Thumbnail url={item.imageUrl} fallback="part" />
            <p className="min-w-0 flex-1 text-small font-medium text-foreground">
              <span className="line-clamp-2">{item.name}</span>
            </p>
            <span className="shrink-0 rounded-md bg-card px-2 py-0.5 text-xs font-semibold tabular-nums text-foreground ring-1 ring-border">
              × {item.quantity}
            </span>
          </li>
        ))}
        {hidden > 0 ? (
          <li className="flex items-center gap-2 px-3 py-2.5 text-small text-muted-foreground">
            <Package aria-hidden="true" className="size-4" />
            and {hidden} more {hidden === 1 ? "part" : "parts"}
          </li>
        ) : null}
      </ul>
    </SubjectFrame>
  )
}

// ─────────────────────────────────────────────────────────────────────
// A general request's optional detail (the Get a Quote page)
// ─────────────────────────────────────────────────────────────────────

const PREFERRED_COUNTRY_OPTIONS = [
  { value: "", label: "Either" },
  ...COUNTRY_OPTIONS,
] as const

function GeneralRequestFields({
  subject,
  defaults,
  error,
}: {
  subject: Extract<QuoteRequestSubject, { kind: "GENERAL" }>
  defaults: Record<string, string>
  error: (name: string) => string | undefined
}) {
  const initialDomain =
    subject.domain ??
    (defaults.domain === QuoteType.SPARE_PART ? QuoteType.SPARE_PART : QuoteType.VEHICLE)

  const [domain, setDomain] = React.useState<QuoteType>(initialDomain)
  const domainFixed = subject.domain !== undefined

  return (
    <div className="flex flex-col gap-4">
      {domainFixed ? (
        <input type="hidden" name="domain" value={domain} />
      ) : (
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 eyebrow text-muted-foreground">I am looking for</legend>
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: QuoteType.VEHICLE, label: "A vehicle", icon: Car },
              { value: QuoteType.SPARE_PART, label: "Spare parts", icon: Package },
            ].map((option) => {
              const Icon = option.icon
              const active = domain === option.value

              return (
                <label
                  key={option.value}
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3.5 py-3 text-small font-semibold",
                    "transition-colors duration-fast has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                    active
                      ? "border-gold-ink/50 bg-accent text-accent-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-gold-ink/30 hover:text-foreground"
                  )}
                >
                  <input
                    type="radio"
                    name="domain"
                    value={option.value}
                    checked={active}
                    onChange={() => setDomain(option.value)}
                    className="sr-only"
                  />
                  <Icon aria-hidden="true" className="size-4" />
                  {option.label}
                </label>
              )
            })}
          </div>
          {error("domain") ? (
            <p className="text-small text-destructive">{error("domain")}</p>
          ) : null}
        </fieldset>
      )}

      {subject.detailed ? (
        <fieldset className="flex flex-col gap-4">
          <legend className="mb-3 eyebrow text-muted-foreground">
            {domain === QuoteType.SPARE_PART ? "The part, and your car" : "The vehicle"}
          </legend>

          {domain === QuoteType.SPARE_PART ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Part name"
                name="partName"
                placeholder="Front brake pads"
                defaultValue={defaults.partName}
                error={error("partName")}
                optional
                maxLength={120}
              />
              <TextField
                label="Part number"
                name="partNumber"
                placeholder="04465-48150"
                defaultValue={defaults.partNumber}
                error={error("partNumber")}
                optional
                maxLength={60}
              />
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-3">
            <TextField
              label={domain === QuoteType.SPARE_PART ? "Car make" : "Make"}
              name="make"
              placeholder="Toyota"
              defaultValue={defaults.make}
              error={error("make")}
              optional
              maxLength={60}
            />
            <TextField
              label={domain === QuoteType.SPARE_PART ? "Car model" : "Model"}
              name="model"
              placeholder="Harrier"
              defaultValue={defaults.model}
              error={error("model")}
              optional
              maxLength={60}
            />
            <TextField
              label={domain === QuoteType.SPARE_PART ? "Car year" : "Preferred year"}
              name="preferredYear"
              type="number"
              inputMode="numeric"
              min={VEHICLE_YEAR_MIN}
              max={vehicleYearMax()}
              placeholder="2021"
              defaultValue={defaults.preferredYear}
              error={error("preferredYear")}
              optional
            />
          </div>

          {domain === QuoteType.VEHICLE ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Maximum budget (USD)"
                name="maxBudget"
                inputMode="decimal"
                placeholder="25,000"
                defaultValue={defaults.maxBudget}
                error={error("maxBudget")}
                optional
                maxLength={20}
              />
              <SelectField
                label="Source from"
                name="preferredCountry"
                defaultValue={defaults.preferredCountry ?? ""}
                options={PREFERRED_COUNTRY_OPTIONS}
                error={error("preferredCountry")}
              />
              <SelectField
                label="Fuel"
                name="fuelType"
                defaultValue={defaults.fuelType ?? ""}
                options={[{ value: "", label: "No preference" }, ...FUEL_TYPE_OPTIONS]}
                error={error("fuelType")}
              />
              <SelectField
                label="Transmission"
                name="transmission"
                defaultValue={defaults.transmission ?? ""}
                options={[{ value: "", label: "No preference" }, ...TRANSMISSION_OPTIONS]}
                error={error("transmission")}
              />
            </div>
          ) : null}
        </fieldset>
      ) : null}
    </div>
  )
}

function SelectField({
  label,
  name,
  defaultValue,
  options,
  error,
}: {
  label: string
  name: string
  defaultValue: string
  options: ReadonlyArray<{ value: string; label: string }>
  error?: string
}) {
  const id = React.useId()
  const errorId = `${id}-error`

  return (
    <div className="flex flex-col gap-2">
      <FieldLabel htmlFor={id} label={label} optional />
      <select
        id={id}
        name={name}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          "h-11 w-full rounded-lg border border-input bg-card px-3 text-base text-foreground",
          "transition-colors outline-none",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "aria-invalid:border-destructive md:text-sm"
        )}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <FieldMessage id={errorId} error={error} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// After sending
// ─────────────────────────────────────────────────────────────────────

const NEXT_STEPS = [
  "We check availability and work out your full price, including shipping and clearing.",
  "You receive your quotation by WhatsApp or email, with everything itemised.",
  "Nothing is reserved or charged until you accept it.",
] as const

function QuoteRequestConfirmation({
  quoteNumber,
  skippedItems,
  onDone,
  className,
}: {
  quoteNumber?: string
  skippedItems: number
  onDone?: () => void
  className?: string
}) {
  const { whatsappNumber } = useSiteContact()
  const [copied, setCopied] = React.useState(false)
  const headingRef = React.useRef<HTMLHeadingElement>(null)

  // Move focus to the confirmation, so a keyboard or screen-reader user is
  // told the outcome instead of being left on a button that no longer exists.
  React.useEffect(() => {
    headingRef.current?.focus()
  }, [])

  React.useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(timer)
  }, [copied])

  const followUpUrl = quoteNumber
    ? buildWhatsAppUrl({
        phoneNumber: whatsappNumber,
        message: buildQuoteFollowUpWhatsAppMessage({ siteName: siteConfig.name, quoteNumber }),
      })
    : null

  async function copyReference() {
    if (!quoteNumber) return

    try {
      await navigator.clipboard.writeText(quoteNumber)
      setCopied(true)
    } catch {
      // Clipboard blocked (an insecure origin, or a denied permission). The
      // reference is on screen as selectable text either way, so there is
      // nothing worth interrupting the customer with.
    }
  }

  return (
    <div className={cn("flex flex-col items-center gap-6 py-2 text-center", className)}>
      <span className="flex size-14 items-center justify-center rounded-full bg-success/10 text-success ring-8 ring-success/5 duration-base animate-in zoom-in-75 fade-in-0">
        <CheckCircle2 aria-hidden="true" className="size-7" />
      </span>

      <div className="flex flex-col gap-2">
        <h3 ref={headingRef} tabIndex={-1} className="text-title font-semibold outline-none">
          Request received
        </h3>
        <p className="mx-auto max-w-sm text-small text-muted-foreground">
          Thank you. Our team will be in touch shortly with your quotation.
        </p>
      </div>

      {quoteNumber ? (
        <div className="flex flex-col items-center gap-1.5">
          <span className="eyebrow text-muted-foreground">Your reference</span>
          <button
            type="button"
            onClick={copyReference}
            className="group/copy inline-flex items-center gap-2 rounded-lg border border-gold-ink/30 bg-accent px-4 py-2 font-mono text-body font-semibold text-foreground transition-colors duration-fast hover:border-gold-ink/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            aria-label={`Copy reference ${quoteNumber}`}
          >
            {quoteNumber}
            {copied ? (
              <CheckCircle2 aria-hidden="true" className="size-4 text-success" />
            ) : (
              <Copy aria-hidden="true" className="size-4 text-muted-foreground group-hover/copy:text-gold-ink" />
            )}
          </button>
          <span aria-live="polite" className="h-4 text-xs text-muted-foreground">
            {copied ? "Copied" : ""}
          </span>
        </div>
      ) : null}

      {skippedItems > 0 ? (
        <p className="max-w-sm rounded-lg border border-warning/30 bg-warning/5 px-3.5 py-2.5 text-small text-warning">
          {skippedItems === 1
            ? "One part in your list is no longer listed and was left out. Mention it in a message if you still need it."
            : `${skippedItems} parts in your list are no longer listed and were left out. Mention them in a message if you still need them.`}
        </p>
      ) : null}

      <ol className="flex w-full max-w-sm flex-col gap-2.5 text-left">
        {NEXT_STEPS.map((step, index) => (
          <li key={step} className="flex gap-3 text-small text-muted-foreground">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary text-[0.6875rem] font-bold text-foreground">
              {index + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>

      <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
        {followUpUrl ? (
          <Button
            render={<a href={followUpUrl} target="_blank" rel="noopener noreferrer" />}
            variant="whatsapp"
            size="lg"
            className="w-full sm:w-auto"
          >
            <WhatsAppGlyph />
            Chat on WhatsApp
          </Button>
        ) : null}
        {onDone ? (
          <Button type="button" variant="outline" size="lg" onClick={onDone} className="w-full sm:w-auto">
            Done
          </Button>
        ) : null}
      </div>
    </div>
  )
}
