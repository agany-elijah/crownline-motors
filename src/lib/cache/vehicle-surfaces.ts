import "server-only"

import { revalidatePath } from "next/cache"

import { ADMIN_BASE_PATH } from "@/lib/constants/admin-routes"

/**
 * Every screen a change to a vehicle can be seen on — the dashboard and the
 * public site.
 *
 * The public catalogue and the listing's own page are included for the same
 * reason spare-part actions include theirs: an operator who archives a car or
 * corrects its price, then finds the old version still on the website, has
 * been given a tool that lies to them. `/cars` covers the catalogue at every
 * filter, because `revalidatePath` invalidates the path rather than one query
 * string.
 */
export function revalidateVehicleSurfaces(vehicleId: string, slug: string | null): void {
  revalidatePath(`${ADMIN_BASE_PATH}/vehicles`)
  revalidatePath(`${ADMIN_BASE_PATH}/vehicles/${vehicleId}`)
  revalidatePath("/cars")
  if (slug) revalidatePath(`/cars/${slug}`)
}
