"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { MAX_PHOTO_ALT_TEXT_LENGTH } from "@/lib/constants/vehicle-photo-options"

interface PhotoDescriptionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The photograph's current alternative text, or null when it has none. */
  value: string | null
  /** What the gallery would read out if this is left empty. Shown so the
   *  operator can see they are replacing something truthful, not filling a
   *  void — which is what makes "leave it blank" a real option. */
  fallback: string
  onSubmit: (altText: string) => void
  pending?: boolean
}

/**
 * Editor for one photograph's alternative text.
 *
 * ── Why this is optional, and says so ─────────────────────────────────
 * Alt text is what a screen reader announces in place of the image, and
 * what a search engine reads. It matters most on the photographs that carry
 * information a sighted buyer gets for free — an auction sheet, a panel of
 * damage, a service record.
 *
 * It matters least on the eleven frames of a walk-around, which is exactly
 * why the dashboard must not demand it for every upload: an operator asked
 * to write twelve descriptions writes twelve copies of "car", and a gallery
 * of "car" is worse for a screen reader than the generated description it
 * replaced. So the field is optional, the generated fallback is shown, and
 * clearing the box restores it.
 */
export function PhotoDescriptionDialog({
  open,
  onOpenChange,
  value,
  fallback,
  onSubmit,
  pending = false,
}: PhotoDescriptionDialogProps) {
  const [draft, setDraft] = useState(value ?? "")

  /**
   * Re-seed the box when the dialog is opened for a different photograph.
   *
   * Adjusted during render, the pattern used elsewhere in this dashboard:
   * the update lands before anything is committed, so the dialog never
   * appears holding the previous photograph's text for a frame.
   */
  const [lastValue, setLastValue] = useState(value)
  if (value !== lastValue) {
    setLastValue(value)
    setDraft(value ?? "")
  }

  const remaining = MAX_PHOTO_ALT_TEXT_LENGTH - draft.trim().length
  const tooLong = remaining < 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Describe this photograph</DialogTitle>
          <DialogDescription>
            Read aloud to visitors using a screen reader, and read by search
            engines. Optional — leave it empty and the website describes the
            photograph automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Label htmlFor="photo-alt-text">Description</Label>

          <Textarea
            id="photo-alt-text"
            rows={3}
            value={draft}
            maxLength={MAX_PHOTO_ALT_TEXT_LENGTH}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={fallback}
            aria-describedby="photo-alt-text-hint"
          />

          <p id="photo-alt-text-hint" className="text-small text-muted-foreground">
            {draft.trim().length === 0 ? (
              <>
                Currently described as{" "}
                <span className="text-foreground">“{fallback}”</span>.
              </>
            ) : (
              <span className={tooLong ? "text-destructive" : undefined}>
                {remaining} character{remaining === 1 ? "" : "s"} left.
              </span>
            )}
          </p>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>

          <Button
            disabled={pending || tooLong}
            onClick={() => {
              onOpenChange(false)
              onSubmit(draft.trim())
            }}
          >
            Save description
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
