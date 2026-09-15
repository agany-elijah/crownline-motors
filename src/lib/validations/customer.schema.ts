import { z } from "zod"

export const customerListFiltersSchema = z.object({
  search: z.string().trim().max(100).optional().catch(undefined),
  page: z.coerce.number().int().min(1).catch(1),
})

export type CustomerListFilters = z.infer<typeof customerListFiltersSchema>
