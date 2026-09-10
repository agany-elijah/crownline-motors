import { SparePartStatus } from "@/generated/prisma/enums"

/**
 * Which status a spare part may move to, from where.
 *
 * Pure data, no `server-only` marker, no Next.js import — read by the client
 * to decide which buttons to render and by the Server Action to decide
 * whether to write. One definition, so the two cannot drift. CLAUDE.md rule
 * 8 and SECURITY.MD §6.2 both say the same thing: a control that only exists
 * in the UI is not a control.
 *
 * ── Where this deliberately differs from the vehicle table ────────────
 * `ALLOWED_VEHICLE_TRANSITIONS` refuses PUBLISHED → DRAFT. A specific car
 * that has been shown to customers is withdrawn by archiving it, because a
 * vehicle leaves the floor once and does not come back.
 *
 * A part line does. Stock cycles: the last set of pads sells, the listing
 * comes down, a new box arrives and it goes back up — and the brief asks for
 * exactly that in as many words ("Publish/unpublish parts"). Forcing that
 * routine round trip through ARCHIVED would overload a status that is
 * supposed to mean "this line is finished", and would leave an operator
 * unable to tell a discontinued part from one that is merely between
 * shipments.
 *
 * So unpublishing returns a part to DRAFT, where it is invisible to
 * customers but plainly still part of the catalogue.
 *
 * ── What "out of stock" is not ───────────────────────────────────────
 * It is not a status. A published part with `stockQuantity = 0` stays
 * visible and enquirable, which is the brief's "mark parts as out of stock":
 * the customer sees that we carry it and can ask when the next one lands.
 * Encoding that as a status would mean an operator flipping it by hand every
 * time a box arrives, and getting it wrong in between.
 */
export const ALLOWED_SPARE_PART_TRANSITIONS: Record<
  SparePartStatus,
  readonly SparePartStatus[]
> = {
  DRAFT: [SparePartStatus.PUBLISHED, SparePartStatus.ARCHIVED],
  PUBLISHED: [SparePartStatus.DRAFT, SparePartStatus.ARCHIVED],
  // Back to draft, never straight to live: an archived line has usually been
  // away long enough that its price, stock figure and fitment want checking
  // before customers see it again.
  ARCHIVED: [SparePartStatus.DRAFT],
}

/**
 * May this part move from `from` to `to`?
 *
 * A move to the status it already holds returns false. That is not the same
 * as "forbidden" and callers must not report it as such — the action treats
 * it as a no-op (most often a double submit) and says nothing, rather than
 * writing a second audit row claiming a change that did not happen.
 */
export function canTransitionSparePartStatus(
  from: SparePartStatus,
  to: SparePartStatus
): boolean {
  return ALLOWED_SPARE_PART_TRANSITIONS[from].includes(to)
}

/**
 * The message shown when a transition is refused.
 *
 * Names both states rather than saying "invalid status". The only people who
 * can reach this are administrators, and the two situations that produce it
 * — a stale tab whose buttons predate someone else's change, and a crafted
 * request — are both better served by being told what the part's status
 * actually is now.
 */
export function describeRefusedSparePartTransition(
  from: SparePartStatus,
  to: SparePartStatus
): string {
  return `This part is ${from.toLowerCase()} and cannot be moved straight to ${to.toLowerCase()}. Reload the page to see the actions available now.`
}
