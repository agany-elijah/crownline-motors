import type { Metadata } from "next"
import { ArrowRightIcon, CarFrontIcon, SearchXIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
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
  { name: "Accent", token: "--accent", className: "bg-accent" },
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
  { name: "body-lg", cls: "text-body-lg", sample: "Quality vehicles sourced from Japan and Korea." },
  { name: "body", cls: "text-body", sample: "Quality vehicles sourced from Japan and Korea." },
  { name: "small", cls: "text-small", sample: "42,000 km · Automatic · Petrol" },
  { name: "meta", cls: "eyebrow", sample: "CLM-V-2026-000123" },
]

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="eyebrow text-muted-foreground">{label}</span>
      <span className="tabular text-small font-medium">{value}</span>
    </div>
  )
}

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
          description="Hover lifts the card 2–4px, deepens a soft two-layer shadow, scales the image inside its fixed crop, and shifts the arrow. Roughly 300ms, once — nothing bounces."
        />

        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {["Toyota Harrier", "Toyota Land Cruiser", "Nissan X-Trail"].map((name, index) => (
            <Reveal key={name} delay={index * 70}>
              {/* Card supplies the elevation and the hover recipe; this page
                  demonstrates the primitive rather than restating its
                  styles, so the two cannot drift apart. */}
              <a href="#" className="block">
                <Card interactive className="gap-0 py-0">
                {/* Fixed 16:9 crop. Photography lands here — the gradient is
                    a stand-in until real vehicle imagery exists. */}
                <div className="media-frame aspect-video">
                  <div className="size-full bg-gradient-to-br from-charcoal via-muted-foreground/40 to-muted transition-transform duration-base ease-crownline group-hover/card:scale-[1.04]" />
                </div>

                <div className="flex flex-col gap-4 p-5">
                  <div className="flex flex-col gap-0.5">
                    <h3 className="text-h3">{name}</h3>
                    <span className="tabular text-small text-muted-foreground">2021</span>
                  </div>

                  <div className="grid grid-cols-2 gap-y-3">
                    <SpecRow label="Mileage" value="42,000 km" />
                    <SpecRow label="Transmission" value="Automatic" />
                    <SpecRow label="Fuel" value="Petrol" />
                    <SpecRow label="Engine" value="2.0L" />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <span className="tabular text-h3">$22,500</span>
                    <span className="flex items-center gap-1.5 text-small font-medium text-muted-foreground transition-colors group-hover/card:text-gold-ink">
                      View details
                      <ArrowRightIcon className="size-4 transition-transform duration-fast group-hover/card:translate-x-1" />
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
            <h2 className="text-h2">Two speeds, one curve</h2>
            <p className="text-body-lg text-background/70">
              250ms for hover and micro-interaction, 400ms for section reveals and modals, on a
              single easing curve. Reveals fire once and lock. Everything collapses to nothing
              when a visitor prefers reduced motion.
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
