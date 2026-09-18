import type * as React from "react"

/**
 * Makes Enter move to the next field instead of submitting a half-filled form.
 *
 * ── The bug this fixes ────────────────────────────────────────────────
 * HTML's implicit submission fires the form's submit button when Enter is
 * pressed in any single-line input. On a one-field form — the tracking
 * lookup, a search bar — that is exactly right. On the quotation form it was
 * hostile: a customer typing their name and pressing Enter, which is an
 * ingrained habit and the literal label on many phone keyboards, posted an
 * empty request and got "Please check the highlighted details and try again"
 * across a form they had barely started filling in.
 *
 * ── What this does instead ────────────────────────────────────────────
 * Enter in a single-line input moves focus to the next control. On the last
 * one it submits, because by then submitting is what the customer means and
 * the convention should still hold.
 *
 * ── What it deliberately leaves alone ─────────────────────────────────
 *   • textareas — Enter is a newline there, and always was;
 *   • buttons and links — Enter activates the focused control, so a
 *     keyboard user can still submit from the submit button;
 *   • radios, checkboxes, selects and file inputs — their own Enter and
 *     Space behaviour is what assistive technology expects;
 *   • Enter with a modifier held, which is a browser or OS gesture;
 *   • Enter while an IME is composing, where it is confirming a candidate
 *     and must never reach the form at all.
 *
 * Attach it to the form, not to each field:
 *
 *     <form action={formAction} onKeyDown={advanceOnEnter}>
 */

/**
 * Input types where Enter means "I have finished this field".
 *
 * Everything absent from this set keeps its native behaviour — see the note
 * above. `number` is included because these are typed values like a budget or
 * a year, not steppers someone arrows through.
 */
const ADVANCING_TYPES = new Set(["text", "email", "tel", "url", "search", "number", "password", "date"])

/** Types whose existing value should be selected when focus lands on them. */
const SELECT_ON_FOCUS = new Set(["text", "email", "tel", "url", "search", "number", "password"])

type FormField = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement

/**
 * The form's controls, in tab order, skipping anything the customer cannot
 * reach.
 *
 * `tabIndex < 0` is what excludes the honeypot: it is a real text input
 * positioned off-screen to catch bots, and advancing into it would park a
 * customer's cursor somewhere they cannot see and fill the field whose whole
 * purpose is to stay empty.
 */
function focusableFields(form: HTMLFormElement): FormField[] {
  const candidates = form.querySelectorAll<FormField>("input, select, textarea")

  return Array.from(candidates).filter((field) => {
    if (field.disabled) return false
    if (field instanceof HTMLInputElement && (field.type === "hidden" || field.readOnly)) return false
    if (field instanceof HTMLTextAreaElement && field.readOnly) return false
    if (field.tabIndex < 0) return false
    // `offsetParent` is null for anything `display: none`, which is how a
    // field inside a collapsed section is skipped without knowing about it.
    return field.offsetParent !== null
  })
}

export function advanceOnEnter(event: React.KeyboardEvent<HTMLFormElement>): void {
  if (event.key !== "Enter") return
  if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return
  if (event.nativeEvent.isComposing) return

  const target = event.target
  if (!(target instanceof HTMLInputElement)) return
  if (!ADVANCING_TYPES.has(target.type)) return

  const fields = focusableFields(event.currentTarget)
  const next = fields[fields.indexOf(target) + 1]

  // Nothing after it: let the browser submit, which is what Enter on the
  // last field of a form has always meant.
  if (!next) return

  event.preventDefault()
  next.focus()

  if (next instanceof HTMLInputElement && SELECT_ON_FOCUS.has(next.type) && next.value) {
    next.select()
  }
}
