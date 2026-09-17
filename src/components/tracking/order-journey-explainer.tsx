"use client"

import { Car, Wrench } from "lucide-react"

import { JourneyArt } from "@/components/tracking/journey-art"
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs"
import { ShipmentType } from "@/generated/prisma/enums"
import { JOURNEY_PHASES } from "@/lib/tracking/customer-journey"

/**
 * "What your order goes through" — the journey in its few major phases, for a
 * vehicle and for parts, before a customer has a tracking number to look up.
 *
 * The same phase definitions the tracking result draws, so the stages a
 * customer reads about here are the stages they later see ticked off.
 * Both panels stay mounted, so the whole explanation is in the page for
 * search engines and for anyone reading without JavaScript.
 */
export function OrderJourneyExplainer() {
  return (
    <Tabs defaultValue={ShipmentType.VEHICLE} className="gap-8">
      <TabsList aria-label="Order type" className="mx-auto">
        <TabsTab value={ShipmentType.VEHICLE} className="h-9 px-4">
          <Car aria-hidden="true" />
          Vehicles
        </TabsTab>
        <TabsTab value={ShipmentType.SPARE_PART} className="h-9 px-4">
          <Wrench aria-hidden="true" />
          Spare parts
        </TabsTab>
      </TabsList>

      {[ShipmentType.VEHICLE, ShipmentType.SPARE_PART].map((type) => {
        const phases = JOURNEY_PHASES[type]

        return (
          <TabsPanel key={type} value={type} keepMounted className="data-hidden:hidden">
            <ol
              className={
                phases.length === 5
                  ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-5"
                  : "grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
              }
            >
              {phases.map((phase, index) => (
                <li
                  key={phase.id}
                  className="group/phase flex flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 transition-[box-shadow,translate] duration-slow ease-crownline-soft hover:-translate-y-1 hover:shadow-[var(--shadow-raised)]"
                >
                  <JourneyArt
                    image={phase.image}
                    icon={phase.icon}
                    sizes="(min-width: 1024px) 18vw, (min-width: 640px) 45vw, 90vw"
                    className="aspect-[16/10]"
                  />
                  <div className="flex flex-1 flex-col gap-2 p-5">
                    <span className="tabular font-heading text-small font-bold text-gold-ink">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <h3 className="text-title font-semibold">{phase.title}</h3>
                    <p className="text-small text-muted-foreground">{phase.summary}</p>
                  </div>
                </li>
              ))}
            </ol>
          </TabsPanel>
        )
      })}
    </Tabs>
  )
}
