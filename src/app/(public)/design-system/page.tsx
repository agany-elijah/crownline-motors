import type { Metadata } from "next"
import {
  ArrowRightIcon,
  BoltIcon,
  CarFrontIcon,
  CogIcon,
  FuelIcon,
  GaugeIcon,
  SearchXIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Container } from "@/components/layout/container"
import { PageHeader } from "@/components/layout/page-header"
import { Section, SectionHeading } from "@/components/layout/section"
import { NavLink } from "@/components/layout/nav-link"
import { Reveal } from "@/components/shared/reveal"
import { EmptyState } from "@/components/shared/empty-state"
import { ErrorState } from "@/components/shared/error-state"
import { CardSkeleton, LoadingState, Spinner } from "@/components/shared/loading-state"

export const metadata: Metadata = {
  title: "Design System",
  // Internal reference, not a customer-facing page — it must never appear
  // in search results alongside real inventory pages.
  robots: { index: false, follow: false },
}

const swatches = [
  { name: "Background", token: "--background", className: "bg-background border border-border" },
  { name: "Foreground", token: "--foreground", className: "bg-foreground" },
  { name: "Gold (fill)", token: "--gold", className: "bg-gold" },
  { name: "Gold (ink)", token: "--gold-ink", className: "bg-gold-ink" },
  { name: "Gold (bright)", token: "--gold-bright", className: "bg-gold-bright" },
  { name: "Accent", token: "--accent", className: "bg-accent" },
  { name: "Price", token: "--price", className: "bg-price" },
  { name: "Charcoal", token: "--charcoal", className: "bg-charcoal" },
  { name: "Secondary", token: "--secondary", className: "bg-secondary" },
  { name: "Muted fg", token: "--muted-foreground", className: "bg-muted-foreground" },
  { name: "Border", token: "--border", className: "bg-border" },
]

const orderRows = [
  { reference: "CLM-O-2026-000012", customer: "John Deng", status: "Deposit confirmed", total: "$22,500.00", badge: "default" },
  { reference: "CLM-O-2026-000013", customer: "Mary Akol", status: "Awaiting final payment", total: "$18,900.00", badge: "outline" },
  { reference: "CLM-O-2026-000014", customer: "Peter Lado", status: "Cancelled", total: "$0.00", badge: "destructive" },
] as const

const navDemo = [
  { label: "Home", active: false },
  { label: "Cars", active: true },
  { label: "Spare Parts", active: false },
  { label: "Track My Order", active: false },
]

const typeSteps = [
  { name: "display", cls: "text-display", sample: "Quality Cars." },
  { name: "h1", cls: "text-h1", sample: "Toyota Harrier 2021" },
  { name: "h2", cls: "text-h2", sample: "Featured Vehicles" },
  { name: "h3", cls: "text-h3", sample: "Key Specifications" },
  { name: "title", cls: "text-title", sample: "Toyota Harrier" },
  { name: "body-lg", cls: "text-body-lg", sample: "Quality vehicles sourced from Japan and Korea." },
  { name: "body", cls: "text-body", sample: "Quality vehicles sourced from Japan and Korea." },
  { name: "small", cls: "text-small", sample: "42,000 km · Automatic · Petrol" },
  { name: "meta", cls: "eyebrow", sample: "CLM-V-2026-000123" },
]

export default function DesignSystemPage() {
  return (
    <>
      <PageHeader
        eyebrow="Internal reference"
        title="Crownline Design System"
        description="The locked visual language: palette, type scale, elevation, components, and motion. Pages compose from these — they don't invent alongside them."
        breadcrumbs={[{ label: "Design System" }]}
      />

      {/* ── Palette ───────────────────────────────────────────── */}
      <Section reveal>
        <SectionHeading
          eyebrow="01 — Colour"
          title="Palette"
          description="Roughly 65% warm white, 25% deep black, 10% champagne gold. The gold is an accent: branding, active states, and one primary CTA per surface — never a background."
        />
        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {swatches.map((swatch) => (
            <div key={swatch.token} className="flex flex-col gap-2">
              <div className={`h-20 rounded-lg ${swatch.className}`} />
              <div className="flex flex-col">
                <span className="text-small font-medium">{swatch.name}</span>
                <span className="text-meta text-muted-foreground">{swatch.token}</span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Typography ────────────────────────────────────────── */}
      <Section variant="muted" reveal>
        <SectionHeading
          eyebrow="02 — Typography"
          title="Type scale"
          description="Manrope for headings, Inter for body. Seven closed steps — pages use these names, never an arbitrary size."
        />
        <div className="mt-10 flex flex-col gap-8">
          {typeSteps.map((step) => (
            <div key={step.name} className="flex flex-col gap-2 border-b border-border pb-6 last:border-0">
              <span className="text-meta text-muted-foreground uppercase">{step.name}</span>
              <p className={step.cls}>{step.sample}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Buttons ───────────────────────────────────────────── */}
      <Section reveal>
        <SectionHeading
          eyebrow="03 — Actions"
          title="Buttons"
          description="One gold fill per surface. Secondary actions are outlined; tertiary are text with a shifting arrow. Large sizes uppercase because at this scale a button is always a headline CTA."
        />

        <div className="mt-10 flex flex-col gap-8">
          <div className="flex flex-wrap items-center gap-3">
            <Button size="xl">View Cars</Button>
            <Button size="lg">Get a Quote</Button>
            <Button size="lg" variant="outline">Track My Order</Button>
            <Button>Default</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Reject payment</Button>
            <Button disabled>Disabled</Button>
          </div>

          {/* The same three buttons on a dark surface. Nothing here passes
              on-dark classes — the wrapper's data-tone="dark" is the only
              difference, and the neutral variants restyle themselves. */}
          <div
            data-tone="dark"
            className="flex flex-wrap items-center gap-3 rounded-xl bg-foreground p-6 text-background"
          >
            <Button size="lg">Get a Quote</Button>
            <Button size="lg" variant="outline">Track My Order</Button>
            <Button variant="ghost">Ghost</Button>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <Button variant="link" className="group/button">
              Explore vehicle
              <ArrowRightIcon className="transition-transform duration-fast group-hover/button:translate-x-1" />
            </Button>
            <div className="flex items-center gap-2">
              <Badge>Available</Badge>
              <Badge variant="secondary">Reserved</Badge>
              <Badge variant="outline">In transit</Badge>
              <Badge variant="destructive">Sold</Badge>
            </div>
          </div>

          {/* Hover these — the label rotates up to a gold copy while a gold
              rule wipes in underneath. "Cars" is shown in its active state. */}
          <div className="flex flex-col gap-4">
            <span className="eyebrow text-muted-foreground">Navigation — hover</span>
            <ul className="flex flex-wrap items-center gap-6">
              {navDemo.map((item) => (
                <li key={item.label}>
                  <NavLink href="#" label={item.label} active={item.active} />
                </li>
              ))}
            </ul>
            <div data-tone="dark" className="rounded-xl bg-foreground px-6 py-5">
              <ul className="flex flex-wrap items-center gap-6">
                {navDemo.map((item) => (
                  <li key={item.label}>
                    <NavLink href="#" label={item.label} active={item.active} tone="dark" />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Section>

      {/* ── Cards + elevation ─────────────────────────────────── */}
      <Section variant="muted" reveal>
        <SectionHeading
          eyebrow="04 — Surfaces"
          title="Cards & elevation"
          description="Three bands: a 16:10 photograph holding roughly 60% of the height, an identity line in Inter with the price in green, then a 2×2 specification matrix beside the gold Explore cue, its icons deliberately faint. Hover lifts the card 6px, swells it 1.5%, deepens a soft two-layer shadow and drifts the photograph closer — 800ms on a curve that spends the whole 800ms, long enough to be felt, never enough to bounce."
        />

        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {["Toyota Harrier", "Toyota Land Cruiser", "Nissan X-Trail"].map((name, index) => (
            <Reveal key={name} delay={index * 70}>
              {/* Card supplies the elevation and the hover recipe; this page
                  demonstrates the primitive rather than restating its
                  styles, so the two cannot drift apart. */}
              <a href="#" className="block">
                <Card interactive className="gap-0 py-0">
                {/* Fixed 16:10 crop. Photography lands here — the gradient
                    is a stand-in until real vehicle imagery exists. */}
                <div className="media-frame aspect-[16/10]">
                  {/* The real card scales an <img>, which `media-frame`
                      transitions for it. This stand-in is a div, so it
                      carries the same timing explicitly. */}
                  <div className="size-full bg-gradient-to-br from-charcoal via-muted-foreground/40 to-muted transition-transform duration-cinematic ease-crownline-soft group-hover/card:scale-[1.08]" />
                </div>

                <div className="@container flex flex-1 flex-col p-4 sm:p-5">
                  <div className="flex items-baseline justify-between gap-3 font-sans">
                    <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                      <h3 className="truncate font-sans text-title font-semibold text-foreground">
                        {name}
                      </h3>
                      <span className="tabular text-body font-normal text-foreground/60">
                        2021
                      </span>
                    </div>
                    <span className="tabular shrink-0 text-title font-bold text-price">
                      $22,500
                    </span>
                  </div>

                  <div className="mt-auto flex items-end justify-between gap-4 border-t border-border pt-5 @max-[322px]:gap-2 @max-[288px]:flex-col @max-[288px]:items-stretch @max-[288px]:gap-4">
                    <div className="grid min-w-0 flex-1 grid-cols-[auto_auto] justify-start gap-x-6 gap-y-3 @max-[322px]:gap-x-2 @max-[322px]:gap-y-2.5">
                      {[
                        { icon: CogIcon, value: "Automatic" },
                        { icon: FuelIcon, value: "Petrol" },
                        { icon: BoltIcon, value: "2.0L" },
                        { icon: GaugeIcon, value: "42,000 km" },
                      ].map(({ icon: Icon, value }) => (
                        <div
                          key={value}
                          className="flex min-w-0 items-center gap-2 font-sans text-small text-muted-foreground @max-[322px]:gap-1.5"
                        >
                          <Icon
                            aria-hidden="true"
                            strokeWidth={1.5}
                            className="size-3 shrink-0 text-muted-foreground/40"
                          />
                          <span className="tabular truncate">{value}</span>
                        </div>
                      ))}
                    </div>

                    <span className="eyebrow inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-gold-bright px-3 py-2.5 text-gold-bright-foreground @max-[322px]:px-2 shadow-[var(--shadow-gold)] transition-[box-shadow,transform,translate,scale] duration-slow ease-crownline-soft group-hover/card:shadow-[var(--shadow-gold-strong)]">
                      Explore
                      <ArrowRightIcon className="size-3.5 transition-transform duration-slow ease-crownline-soft group-hover/card:translate-x-1" />
                    </span>
                  </div>
                </div>
                </Card>
              </a>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ── Forms ─────────────────────────────────────────────── */}
      <Section reveal>
        <SectionHeading eyebrow="05 — Inputs" title="Form controls" />
        <div className="mt-10 grid max-w-2xl grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="ds-name">Full name</Label>
            <Input id="ds-name" placeholder="e.g. John Deng" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ds-ref">Tracking number</Label>
            <Input id="ds-ref" placeholder="CLM-2026-000125" className="tabular" />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="ds-err">With validation error</Label>
            <Input id="ds-err" defaultValue="not-an-email" aria-invalid />
            <span className="text-small text-destructive">Enter a valid email address.</span>
          </div>
        </div>
      </Section>

      {/* ── States ────────────────────────────────────────────── */}
      <Section variant="muted" reveal>
        <SectionHeading
          eyebrow="06 — States"
          title="Loading, empty & error"
          description="Every data surface needs all three. Empty is neutral — nothing has gone wrong. Error never shows a raw exception."
        />

        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-xl bg-card p-2 ring-1 ring-foreground/10">
            <LoadingState label="Loading vehicles…" />
          </div>
          <EmptyState
            className="bg-card"
            icon={<SearchXIcon />}
            title="No vehicles match"
            description="Try widening your price range or clearing a filter."
            action={<Button variant="outline" size="sm">Clear filters</Button>}
          />
          <ErrorState
            size="compact"
            reference="a1b2c3d4"
            action={<Button size="sm">Try again</Button>}
          />
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <CardSkeleton className="bg-card" />
          <div className="flex flex-col gap-4">
            <Alert>
              <CarFrontIcon />
              <AlertTitle>Estimated pricing</AlertTitle>
              <AlertDescription>
                Shipping and clearing figures are estimates until your quote is confirmed.
              </AlertDescription>
            </Alert>
            <div className="flex items-center gap-3 text-small text-muted-foreground">
              <Spinner className="text-gold-ink" />
              Inline spinner
            </div>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Card primitive</CardTitle>
              <CardDescription>Base shadcn card on the Crownline palette.</CardDescription>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              Used for admin panels and dense content. Marketing surfaces compose their own.
            </CardContent>
          </Card>
        </div>
      </Section>

      {/* ── Data & overlays ───────────────────────────────────── */}
      <Section reveal>
        <SectionHeading
          eyebrow="07 — Data"
          title="Tables & dialogs"
          description="The admin surfaces run on these. Reference numbers and money take lining, fixed-width figures so columns stay aligned and never jitter as values update."
        />

        <div className="mt-10 overflow-x-auto">
          <Table>
            <TableCaption>Recent orders</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orderRows.map((row) => (
                <TableRow key={row.reference}>
                  <TableCell className="tabular font-medium">{row.reference}</TableCell>
                  <TableCell>{row.customer}</TableCell>
                  <TableCell>
                    <Badge variant={row.badge}>{row.status}</Badge>
                  </TableCell>
                  <TableCell className="tabular text-right">{row.total}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="mt-10">
          <Dialog>
            <DialogTrigger render={<Button variant="outline">Open confirmation dialog</Button>} />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm this payment?</DialogTitle>
                <DialogDescription>
                  Confirming records the payment against the order and advances its milestone.
                  The action is written to the audit trail and cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose render={<Button variant="outline">Cancel</Button>} />
                <DialogClose render={<Button>Confirm payment</Button>} />
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </Section>

      {/* ── Motion ────────────────────────────────────────────── */}
      <Section variant="dark" className="gold-ambient" reveal>
        <Container>
          <div className="flex max-w-2xl flex-col gap-5">
            <span className="eyebrow text-gold-ink">08 — Motion</span>
            <h2 className="text-h2">Four speeds, two curves</h2>
            <p className="text-body-lg text-background/70">
              250ms for hover and micro-interaction and 400ms for section reveals and modals, on
              a fast-out expo curve. The card hover gets 800ms and the photograph inside it
              1200ms, on a softer curve that spends the whole duration — the one gesture on the
              site that is meant to be felt rather than registered. Reveals fire once and lock.
              Everything collapses to nothing when a visitor prefers reduced motion.
            </p>
            <div className="mt-2 flex flex-wrap gap-3">
              <Button size="lg">Primary on dark</Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white/25 text-background hover:border-white/50 hover:bg-white/10 hover:text-background"
              >
                Secondary
              </Button>
            </div>
          </div>
        </Container>
      </Section>
    </>
  )
}
