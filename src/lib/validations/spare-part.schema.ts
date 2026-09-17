import { z } from "zod"

import {
  CountryOfOrigin,
  SparePartAvailability,
  SparePartCondition,
  SparePartPricingMode,
  SparePartStatus,
} from "@/generated/prisma/enums"
import { SPARE_PART_STOCK_MAX } from "@/lib/constants/spare-part-options"
import { hiddenFieldsField } from "@/lib/validations/hidden-fields.schema"
import { SPARE_PART_INFO_FIELDS } from "@/lib/visibility/product-visibility"

/**
 * Validation for spare-part creation and editing.
 *
 * Every bound here exists to catch a specific mistake an operator can
 * plausibly make. A part listing is customer-facing and priced, and unlike a
 * vehicle it is also *stocked* — so a mistyped figure is not only a
 * commercial problem, it is a promise about something we may not have.
 *
 * The rules that also exist as database CHECK constraints are duplicated
 * here on purpose. The database is the backstop that no code path can route
 * around; this layer is what turns a violation into a sentence the operator
 * can act on instead of a 500.
 */

/** Trimmed, required, bounded. The shape most text fields on this form need. */
const requiredText = (field: string, max = 80) =>
  z
    .string()
    .trim()
    .min(1, `${field} is required.`)
    .max(max, `${field} is too long.`)

/**
 * Trimmed, optional, bounded.
 *
 * An empty box means "not recorded", which is `undefined` and stored as
 * NULL — never an empty string. A part with `oemPartNumber = ""` would match
 * a search for "" and render an empty line on the listing where a number
 * should be.
 */
const optionalText = (field: string, max = 80) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z
      .string()
      .trim()
      .max(max, `${field} is too long.`)
      .optional()
  )

/**
 * Money, as a string from the form.
 *
 * `Decimal(12, 2)` in the database, so two decimal places and a ceiling
 * below 10^10. The precision check uses a tolerance rather than
 * `value * 100 % 1 === 0`, because that comparison is itself a
 * floating-point trap — `33.34 * 100` is 3334.0000000000005, and the exact
 * form rejects valid input. (Same helper as vehicle.schema.ts; kept local
 * rather than shared because the two forms' messages address different
 * operators' mistakes and are free to diverge.)
 */
const money = (field: string) =>
  z.coerce
    .number({ error: `${field} must be a number.` })
    .min(0, `${field} cannot be negative.`)
    .max(9_999_999_999, `${field} is too large.`)
    .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-9, {
      message: `${field} can have at most two decimal places.`,
    })

const optionalMoney = (field: string) =>
  z.preprocess(
    (value) =>
      value === "" || value === null || value === undefined ? undefined : value,
    money(field).optional()
  )

/**
 * An HTML checkbox, read strictly.
 *
 * A browser omits an unchecked box entirely and sends the control's `value`
 * — here `"true"` — when checked. `z.coerce.boolean()` would be wrong: it is
 * `Boolean(input)`, so a request carrying `isFeatured=false` would *set* the
 * flag. `.optional()` comes before the transform because Zod 4 decides key
 * optionality from the input type, and a transformed union merely containing
 * `z.undefined()` still parses as a required key — which fails on exactly
 * the submission this must accept.
 */
const checkboxField = z
  .union([z.string(), z.boolean(), z.null()])
  .optional()
  .transform((value) => value === true || value === "true" || value === "on")

/**
 * An optional enum from a `<select>` whose first option is blank.
 *
 * The empty string a browser sends for "not specified" is not a valid enum
 * member, so it is mapped to `undefined` before the enum ever sees it —
 * otherwise every unset country would be a validation error on a field the
 * operator deliberately left alone.
 */
const optionalEnum = <T extends Record<string, string>>(values: T) =>
  z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    z.enum(values).optional()
  )

const sparePartFields = {
  name: requiredText("Part name", 120),

  /**
   * Validated as present, but its *existence* is checked in the action.
   *
   * A category id that does not exist is not something an operator can fix
   * by editing the field — the select only offers real ones, so a bad value
   * means a stale page or a crafted request. The action looks it up and says
   * so; the foreign key is the backstop behind that.
   */
  categoryId: z.string().min(1, "Choose a category."),

  oemPartNumber: optionalText("Manufacturer part number", 60),
  brand: optionalText("Brand", 60),

  condition: z.enum(SparePartCondition),
  countryOfOrigin: optionalEnum(CountryOfOrigin),

  /**
   * Optional, and it is what decides the pricing mode — see
   * `derivePricingMode` below. There is no separate mode control.
   */
  price: optionalMoney("Price"),

  /**
   * Optional, and an empty box means zero rather than an error.
   *
   * Zero is a normal publishable state (the listing stays visible so a
   * customer can ask when the next shipment lands), so an operator entering
   * a part before the box arrives should not have to type a figure they do
   * not have yet.
   */
  stockQuantity: z.preprocess(
    (value) =>
      value === "" || value === null || value === undefined ? 0 : value,
    z.coerce
      .number({ error: "Stock quantity must be a number." })
      .int("Stock quantity must be a whole number.")
      .min(0, "Stock quantity cannot be negative.")
      .max(SPARE_PART_STOCK_MAX, "That stock figure looks wrong — check the number.")
  ),

  /**
   * What the listing tells a customer about getting hold of the part.
   *
   * Required, with no blank option. It is rendered as a tag on every card
   * and on the part page, so there is no "unset" state for it to fall into —
   * a listing that says nothing about availability is one a customer reads
   * as available. The database default (ON_ORDER) covers a row created by
   * any path that is not this form; here the operator states it.
   *
   * Deliberately independent of `stockQuantity`. They answer different
   * questions — how many we have counted, and what we are willing to
   * promise — and a form that derived one from the other would take the
   * second decision away from the person qualified to make it.
   */
  availability: z.enum(SparePartAvailability),

  description: z
    .string()
    .trim()
    .min(
      15,
      "Write at least a sentence describing the part, what it fits and its condition."
    )
    .max(5000, "Description is too long."),

  isFeatured: checkboxField,

  supplierName: optionalText("Supplier", 120),
  supplierNotes: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(2000, "Supplier notes are too long.").optional()
  ),

  /** Facts withheld from customers on this listing — see product-visibility.ts. */
  hiddenFields: hiddenFieldsField(SPARE_PART_INFO_FIELDS),
}

/**
 * The pricing mode is derived from the price, never chosen.
 *
 * ── Why the form no longer asks ───────────────────────────────────────
 * It used to carry a "Fixed price / Price on enquiry" select, and an
 * operator who left the price blank under the wrong one got a validation
 * error about a decision they had not knowingly made. The two states are
 * the same fact said twice: a part with a price is priced, and a part
 * without one is quoted on enquiry. Deriving it removes a control, removes
 * an error nobody could act on, and makes the price genuinely optional —
 * which is what the dealership asked for.
 *
 * It also keeps `SparePart_pricing_mode_check` satisfied by construction:
 * FIXED always carries a price and QUOTE_ONLY never does, because the two
 * are computed from the same value in the same expression. The constraint
 * stays as the backstop for any path that is not this one.
 *
 * The customer never sees the mode either way — the public catalogue shows
 * a figure or "Price on enquiry", and nothing else.
 */
function derivePricingMode<T extends { price?: number }>(
  data: T
): T & { pricingMode: SparePartPricingMode } {
  return data.price === undefined
    ? { ...data, pricingMode: SparePartPricingMode.QUOTE_ONLY }
    : { ...data, pricingMode: SparePartPricingMode.FIXED }
}

/**
 * Creation.
 *
 * `status` is absent on purpose. A new part is always a DRAFT — the database
 * default — because publishing is a decision made after the price, the stock
 * figure and the photographs are in place, not a dropdown set absently while
 * typing a part number. It is changed afterwards through
 * `updateSparePartStatusAction`, which is separately permissioned.
 *
 * `pricingMode` is absent because it is derived, not submitted.
 *
 * `referenceNumber` and `slug` are likewise absent: both are generated
 * server-side. Accepting either from the client would let a caller choose
 * its own reference, and they are what the business and its customers use to
 * identify a part.
 */
export const createSparePartSchema = z
  .object(sparePartFields)
  .transform(derivePricingMode)
export type CreateSparePartInput = z.infer<typeof createSparePartSchema>

/**
 * Editing. Same fields; the part is identified separately.
 *
 * `expectedUpdatedAt` is the value `SparePart.updatedAt` held when this form
 * was rendered, carried back so the action can refuse a write built on a
 * stale reading. Without it the last save wins silently: two administrators
 * open the same part, one corrects the stock figure, the other the price,
 * and whoever saves second reverts the first change without either seeing
 * anything go wrong. On a record carrying a customer-facing price and a
 * stock promise, a silent revert is the worst available failure — it looks
 * exactly like a save that worked.
 *
 * Required rather than optional: treating its absence as "skip the check"
 * would leave the hole open for any caller that simply omits the field,
 * which is every caller that is not this form.
 */
export const updateSparePartSchema = z
  .object({
    id: z.string().min(1, "Missing part."),
    expectedUpdatedAt: z.coerce.date({
      error: "Reload this page before saving — it was opened a while ago.",
    }),
    ...sparePartFields,
  })
  .transform(derivePricingMode)
export type UpdateSparePartInput = z.infer<typeof updateSparePartSchema>

export const updateSparePartStatusSchema = z.object({
  id: z.string().min(1, "Missing part."),
  status: z.enum(SparePartStatus),
})
export type UpdateSparePartStatusInput = z.infer<typeof updateSparePartStatusSchema>

/**
 * Filters for the admin list.
 *
 * Every field is optional and forgiving: these come from a query string a
 * user can edit, and a malformed filter should show an unfiltered list
 * rather than an error page. `catch` turns a bad value into the default
 * instead of a failed parse.
 */
export const sparePartListFiltersSchema = z.object({
  search: z.string().trim().max(100).optional().catch(undefined),
  status: z.enum(SparePartStatus).optional().catch(undefined),
  availability: z.enum(SparePartAvailability).optional().catch(undefined),
  categoryId: z.string().trim().max(60).optional().catch(undefined),
  /**
   * "Show me what I cannot sell." Published parts at zero stock are the ones
   * customers are enquiring about and nobody has reordered, so they need to
   * be reachable in one click rather than by reading down a column.
   */
  outOfStock: z
    .union([z.literal("1"), z.literal("true")])
    .optional()
    .catch(undefined)
    .transform((value) => value !== undefined),
  page: z.coerce.number().int().min(1).catch(1),
})
export type SparePartListFilters = z.infer<typeof sparePartListFiltersSchema>
