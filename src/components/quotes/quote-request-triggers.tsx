"use client"

import * as React from "react"
import { MessageSquareText } from "lucide-react"

import { QuoteType } from "@/generated/prisma/enums"
import { QuoteRequestButton } from "@/components/quotes/quote-request-dialog"

/**
 * The quote buttons each surface places, with their words decided once.
 *
 * A vehicle page carries "Get a quote" twice — in the summary band and in
 * the pinned mobile bar — and each catalogue carries its "haven't found it?"
 * prompt in two or three places. If each placement wrote its own title and
 * description they would drift, and a customer would open two slightly
 * different panels for one action. These wrappers are the one place the
 * copy lives.
 */

export const QUOTE_REQUEST_COPY = {
  vehicle: {
    title: "Get a quote for this vehicle",
    description:
      "Leave your details and we will send your full delivered price — shipping and clearing included — before you commit to anything.",
    submitLabel: "Submit request",
  },
  parts: {
    title: "Request your items",
    description:
      "We will confirm availability, fitment and the final delivered price on your quotation. Nothing is charged until you accept it.",
  },
  vehicleCatalogue: {
    title: "Haven't found your vehicle?",
    description:
      "Tell us what you are looking for and we will source it from auction houses and dealers in Japan and Korea.",
    submitLabel: "Submit request",
  },
  partsCatalogue: {
    title: "Can't find the part you need?",
    description:
      "Send the part name or number and the car it is for. We will source it and confirm the price and lead time.",
    submitLabel: "Submit request",
  },
} as const

/** "Request 1 item" / "Request 3 items" — by distinct parts, not units. */
export function requestItemsLabel(lineCount: number): string {
  return lineCount === 1 ? "Request item" : "Request items"
}

interface TriggerProps {
  children?: React.ReactNode
  variant?: "default" | "outline" | "secondary" | "ghost"
  size?: "sm" | "default" | "lg" | "xl"
  className?: string
}

export function VehicleQuoteButton({
  vehicleSlug,
  label,
  imageUrl,
  children = "Get a quote",
  variant,
  size,
  className,
}: TriggerProps & { vehicleSlug: string; label: string; imageUrl: string | null }) {
  return (
    <QuoteRequestButton
      subject={{ kind: "VEHICLE_LISTING", vehicleSlug, label, imageUrl }}
      title={QUOTE_REQUEST_COPY.vehicle.title}
      description={QUOTE_REQUEST_COPY.vehicle.description}
      submitLabel={QUOTE_REQUEST_COPY.vehicle.submitLabel}
      variant={variant}
      size={size}
      className={className}
    >
      {children}
    </QuoteRequestButton>
  )
}

export function VehicleCatalogueQuoteButton({
  children = (
    <>
      <MessageSquareText aria-hidden="true" />
      Get a quote directly
    </>
  ),
  variant,
  size,
  className,
}: TriggerProps) {
  return (
    <QuoteRequestButton
      subject={{ kind: "GENERAL", source: "VEHICLE_CATALOGUE", domain: QuoteType.VEHICLE }}
      title={QUOTE_REQUEST_COPY.vehicleCatalogue.title}
      description={QUOTE_REQUEST_COPY.vehicleCatalogue.description}
      submitLabel={QUOTE_REQUEST_COPY.vehicleCatalogue.submitLabel}
      variant={variant}
      size={size}
      className={className}
    >
      {children}
    </QuoteRequestButton>
  )
}

export function PartsCatalogueQuoteButton({
  children = (
    <>
      <MessageSquareText aria-hidden="true" />
      Get a quote directly
    </>
  ),
  variant,
  size,
  className,
}: TriggerProps) {
  return (
    <QuoteRequestButton
      subject={{ kind: "GENERAL", source: "SPARE_PART_CATALOGUE", domain: QuoteType.SPARE_PART }}
      title={QUOTE_REQUEST_COPY.partsCatalogue.title}
      description={QUOTE_REQUEST_COPY.partsCatalogue.description}
      submitLabel={QUOTE_REQUEST_COPY.partsCatalogue.submitLabel}
      variant={variant}
      size={size}
      className={className}
    >
      {children}
    </QuoteRequestButton>
  )
}
