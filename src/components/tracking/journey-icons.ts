import {
  Anchor,
  ClipboardCheck,
  House,
  KeyRound,
  PackageCheck,
  Route,
  ShieldCheck,
  Ship,
  Truck,
  type LucideIcon,
} from "lucide-react"

import type { JourneyIcon } from "@/lib/tracking/customer-journey"

/**
 * The icon for each journey phase. A plain module rather than an export of a
 * client component's file: a server component importing a value from a
 * "use client" module receives a client reference, not the object, and the
 * icons would render as nothing.
 */
export const JOURNEY_ICONS: Record<JourneyIcon, LucideIcon> = {
  shield: ShieldCheck,
  ship: Ship,
  anchor: Anchor,
  truck: Truck,
  key: KeyRound,
  check: ClipboardCheck,
  package: PackageCheck,
  route: Route,
  home: House,
}
