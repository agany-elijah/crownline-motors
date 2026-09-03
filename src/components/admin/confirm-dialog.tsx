"use client"

import * as React from "react"
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
  DialogTrigger,
} from "@/components/ui/dialog"

interface ConfirmDialogProps {
  /**
   * The control that opens the dialog. Rendered as the trigger.
   *
   * Omitted when the caller drives `open` itself — a dialog opened from a
   * menu item has no trigger of its own, because the menu has already
   * closed by the time the dialog appears.
   */
  trigger?: React.ReactElement
  /** Controlled visibility. Supply both, or neither and use `trigger`. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  title: string
  description: React.ReactNode
  /** Label for the button that goes ahead. Name the action — "Remove
   *  photograph", not "OK" — so the consequence is legible at the moment of
   *  committing to it. */
  confirmLabel: string
  cancelLabel?: string
  /** Styles the confirm button as destructive. */
  destructive?: boolean
  /** Runs when confirmed. Closing is handled here, so the caller only has to
   *  do the work. */
  onConfirm: () => void
  /** Disables the confirm button — e.g. while the action is in flight. */
  pending?: boolean
}

/**
 * A confirmation step for an action that is awkward to undo.
 *
 * Used sparingly and deliberately. A confirmation on a routine action
 * trains an operator to dismiss it without reading, which makes it worse
 * than useless — by the time it guards something that matters, it has
 * already become a reflex. Reserve it for actions with no route back
 * through the interface.
 *
 * The dialog closes itself before calling `onConfirm`, so a Server Action
 * started by the callback runs against a settled interface rather than one
 * that is still animating out.
 */
export function ConfirmDialog({
  trigger,
  open: controlledOpen,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  pending = false,
}: ConfirmDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)

  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : uncontrolledOpen
  const setOpen = isControlled ? (onOpenChange ?? (() => {})) : setUncontrolledOpen

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger render={trigger} /> : null}

      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            {cancelLabel}
          </DialogClose>

          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={pending}
            onClick={() => {
              setOpen(false)
              onConfirm()
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
