"use client"

import * as React from "react"
import { useState } from "react"
import {
  ArrowLeft,
  ArrowRight,
  ImagePlus,
  MoreVertical,
  Star,
  Trash2,
  Type,
} from "lucide-react"

import { ConfirmDialog } from "@/components/admin/confirm-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

/**
 * One photograph in the dashboard's gallery, with its own controls.
 *
 * ── Why every image gets the same tile ────────────────────────────────
 * The main image and the supporting ones differ in exactly two ways: the
 * main one is larger, and it has nothing to be promoted to. Everything else
 * — the preview, the menu, removal — is identical, and building them as two
 * components is how a dashboard ends up where only the cover image can be
 * removed.
 *
 * The controls sit behind a single overflow menu rather than a row of
 * buttons. A gallery is a grid of photographs; a grid of photographs with
 * three buttons under each one is a control panel with pictures in it. The
 * menu keeps the images the thing you look at, and keeps a destructive
 * action from sitting one mis-tap away from a thumbnail on a phone.
 */

export interface PhotoTileProps {
  /** The rendered preview. A `next/image` for a stored photograph, a plain
   *  `<img>` for a local object URL — the tile does not care which. */
  image: React.ReactNode
  /** Names this photograph in the menu's accessible labels. */
  label: string
  isMain: boolean
  /** Absent on the main tile: there is nothing to promote it to. */
  onMakeMain?: () => void
  /** Absent for the first supporting photograph, and while staging. */
  onMoveEarlier?: () => void
  /** Absent for the last supporting photograph, and while staging. */
  onMoveLater?: () => void
  /** Opens the alternative-text editor. Absent for a photograph that has
   *  not been uploaded yet — there is no row to write it to. */
  onEditDescription?: () => void
  /** True when this photograph carries operator-written alternative text,
   *  so the menu can offer to edit rather than add it. */
  hasDescription?: boolean
  onDelete: () => void
  /** Asks before removing. On by default; off for a photograph that has not
   *  been uploaded yet, where removing it costs nothing. */
  confirmDelete?: boolean
  disabled?: boolean
  className?: string
}

export function PhotoTile({
  image,
  label,
  isMain,
  onMakeMain,
  onMoveEarlier,
  onMoveLater,
  onEditDescription,
  hasDescription = false,
  onDelete,
  confirmDelete = true,
  disabled = false,
  className,
}: PhotoTileProps) {
  const [confirming, setConfirming] = useState(false)

  function requestDelete() {
    if (confirmDelete) {
      setConfirming(true)
      return
    }
    onDelete()
  }

  return (
    <div
      className={cn(
        "media-frame group/tile relative aspect-video w-full overflow-hidden rounded-xl border border-border bg-secondary",
        className
      )}
    >
      {image}

      {/* A short shade under the corner controls, so they hold against a
          bright sky or a white car. Legibility, not decoration. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-black/35 to-transparent"
      />

      {isMain ? (
        <span className="pointer-events-none absolute top-2 left-2 inline-flex h-6 items-center gap-1 rounded-full bg-black/60 px-2.5 text-xs font-medium text-white backdrop-blur-sm">
          <Star aria-hidden="true" className="size-3 fill-gold text-gold" />
          Main image
        </span>
      ) : null}

      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={disabled}
          className={cn(
            "absolute top-2 right-2 inline-flex size-8 items-center justify-center rounded-md",
            "bg-black/55 text-white backdrop-blur-sm",
            "transition-colors duration-fast hover:bg-black/80 data-popup-open:bg-black/80",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            "disabled:pointer-events-none disabled:opacity-50"
          )}
          aria-label={`Options for ${label}`}
        >
          <MoreVertical aria-hidden="true" className="size-4" />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56">
          {onMakeMain ? (
            <DropdownMenuItem onClick={onMakeMain}>
              <Star aria-hidden="true" />
              Make the main image
            </DropdownMenuItem>
          ) : null}

          {/*
            Move by one position rather than drag-and-drop. A grid that
            reflows on drag is hard to operate precisely on a phone — which
            is where an operator photographing a car actually is — and
            impossible from a keyboard without a parallel implementation.
            Two menu items work identically on every input device.
          */}
          {onMoveEarlier ? (
            <DropdownMenuItem onClick={onMoveEarlier}>
              <ArrowLeft aria-hidden="true" />
              Move earlier
            </DropdownMenuItem>
          ) : null}

          {onMoveLater ? (
            <DropdownMenuItem onClick={onMoveLater}>
              <ArrowRight aria-hidden="true" />
              Move later
            </DropdownMenuItem>
          ) : null}

          {onEditDescription ? (
            <DropdownMenuItem onClick={onEditDescription}>
              <Type aria-hidden="true" />
              {hasDescription ? "Edit description" : "Add a description"}
            </DropdownMenuItem>
          ) : null}

          {/*
            "Remove", not "Delete". The photograph is soft-deleted: it stops
            appearing anywhere on the website and in this dashboard, but the
            stored image is deliberately kept, because sourced and auction
            photography is often impossible to obtain again. Calling it
            Delete promised an erasure that does not happen.
          */}
          <DropdownMenuItem variant="destructive" onClick={requestDelete}>
            <Trash2 aria-hidden="true" />
            Remove from listing
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {confirmDelete ? (
        <ConfirmDialog
          open={confirming}
          onOpenChange={setConfirming}
          title="Remove this photograph?"
          description={
            isMain
              ? "It will no longer appear anywhere on the website, and the next photograph in the gallery becomes the main image. The original file is kept on record and is not destroyed."
              : "It will no longer appear anywhere on the website. The original file is kept on record and is not destroyed."
          }
          confirmLabel="Remove image"
          destructive
          pending={disabled}
          onConfirm={onDelete}
        />
      ) : null}
    </div>
  )
}

/**
 * The empty slot that stands in for a photograph that has not been chosen.
 *
 * A button rather than a styled `<input type="file">`: the picker is owned
 * by the board so it can downscale and validate what comes back, and a tile
 * that opens it needs to be reachable from the keyboard and readable by a
 * screen reader as the action it performs.
 */
export function PhotoDropTile({
  label,
  hint,
  onClick,
  disabled = false,
  className,
}: {
  label: string
  hint?: string
  onClick: () => void
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group/drop flex aspect-video w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl px-4 text-center",
        "border border-dashed border-input bg-sunken/60 text-muted-foreground",
        "transition-colors duration-fast hover:border-gold-ink/50 hover:bg-accent/60 hover:text-foreground",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        "disabled:pointer-events-none disabled:opacity-60",
        className
      )}
    >
      <span className="flex size-10 items-center justify-center rounded-full border border-border bg-card shadow-[var(--shadow-subtle)] transition-colors duration-fast group-hover/drop:text-gold-ink">
        <ImagePlus aria-hidden="true" className="size-4.5" strokeWidth={1.75} />
      </span>
      <span className="text-small font-medium">{label}</span>
      {hint ? <span className="text-xs">{hint}</span> : null}
    </button>
  )
}
