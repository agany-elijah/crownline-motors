"use client"

import * as React from "react"
import Image from "next/image"
import { ImageIcon, Loader2, Trash2, Upload } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  removeBrandingAssetAction,
  uploadBrandingAssetAction,
  type BrandingAssetState,
} from "@/lib/actions/branding.actions"
import { BRANDING_ASSET_RULES, type BrandingAssetKind } from "@/lib/constants/branding-options"
import { cn } from "@/lib/utils"

const IDLE: BrandingAssetState = { status: "idle" }

const PREVIEW_SURFACE: Record<BrandingAssetKind, string> = {
  // Each logo is previewed on the surface it will actually sit on.
  logoLight: "bg-[oklch(0.99_0.004_90)]",
  logoDark: "bg-[oklch(0.11_0.003_90)]",
  favicon: "bg-secondary",
  ogImage: "bg-secondary",
}

/**
 * One branding image: a preview on its own background, and upload / replace /
 * remove.
 *
 * Uploads start as soon as a file is chosen — there is nothing else to fill in
 * — after the same size and type checks the server applies, so an operator
 * is told at once rather than after a slow upload over a mobile connection.
 * The server re-checks everything, including the file's real type.
 */
export function BrandingAssetCard({
  kind,
  url,
  canEdit,
}: {
  kind: BrandingAssetKind
  url: string | null
  canEdit: boolean
}) {
  const rule = BRANDING_ASSET_RULES[kind]
  const [uploadState, uploadAction, uploading] = React.useActionState(uploadBrandingAssetAction, IDLE)
  const [removeState, removeAction, removing] = React.useActionState(removeBrandingAssetAction, IDLE)
  const [clientError, setClientError] = React.useState<string | null>(null)
  const [confirmingRemove, setConfirmingRemove] = React.useState(false)
  const formRef = React.useRef<HTMLFormElement>(null)
  const inputId = React.useId()

  // Whichever action ran last owns the message.
  const [lastState, setLastState] = React.useState<BrandingAssetState>(IDLE)
  const [seen, setSeen] = React.useState({ uploadState, removeState })
  if (seen.uploadState !== uploadState || seen.removeState !== removeState) {
    setLastState(seen.uploadState !== uploadState ? uploadState : removeState)
    setSeen({ uploadState, removeState })
    setConfirmingRemove(false)
  }

  function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    if (file.size > rule.maxBytes) {
      setClientError(`That file is too large for this slot.`)
      event.target.value = ""
      return
    }

    if (!(rule.mimeTypes as readonly string[]).includes(file.type)) {
      setClientError("That file type is not accepted here.")
      event.target.value = ""
      return
    }

    setClientError(null)
    formRef.current?.requestSubmit()
  }

  const busy = uploading || removing
  const message = clientError ?? lastState.message
  const isError = Boolean(clientError) || lastState.status === "error"

  return (
    // A row: the preview beside what it is and what can be done with it, so
    // four slots fit on a phone screen instead of four stacked cards.
    <div className="flex min-w-0 items-start gap-3 py-3 first:pt-0 last:pb-0 sm:gap-4">
      <div
        className={cn(
          "relative flex w-24 shrink-0 items-center justify-center overflow-hidden rounded-md ring-1 ring-border sm:w-32",
          kind === "ogImage" ? "aspect-[1200/630]" : "h-16 sm:h-20",
          PREVIEW_SURFACE[kind],
        )}
      >
        {url ? (
          kind === "favicon" ? (
            <Image src={url} alt="" width={40} height={40} className="size-10 rounded-md" />
          ) : (
            <Image
              src={url}
              alt=""
              fill
              sizes="8rem"
              className={kind === "ogImage" ? "object-cover" : "object-contain p-2"}
            />
          )
        ) : (
          <span
            className={cn(
              "flex flex-col items-center gap-1 text-xs",
              kind === "logoDark" ? "text-white/50" : "text-muted-foreground",
            )}
          >
            <ImageIcon aria-hidden="true" className="size-4" />
            {kind === "logoLight" || kind === "logoDark" ? "Wordmark" : "Not set"}
          </span>
        )}

        {busy ? (
          <span className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm">
            <Loader2 aria-hidden="true" className="size-5 animate-spin" />
          </span>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-small font-semibold">{rule.label}</h3>
          <p className="text-xs text-muted-foreground">{rule.hint}</p>
        </div>

        {canEdit ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <form ref={formRef} action={uploadAction}>
              <input type="hidden" name="kind" value={kind} />
              <input
                id={inputId}
                type="file"
                name="file"
                accept={rule.mimeTypes.join(",")}
                className="sr-only"
                onChange={handleFile}
                disabled={busy}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => document.getElementById(inputId)?.click()}
              >
                <Upload aria-hidden="true" />
                {url ? "Replace" : "Upload"}
              </Button>
            </form>

            {url ? (
              confirmingRemove ? (
                <form action={removeAction} className="flex items-center gap-1.5">
                  <input type="hidden" name="kind" value={kind} />
                  <Button type="submit" variant="destructive" size="sm" disabled={busy}>
                    Remove
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmingRemove(false)}>
                    Cancel
                  </Button>
                </form>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => setConfirmingRemove(true)}
                >
                  <Trash2 aria-hidden="true" />
                  Remove
                </Button>
              )
            ) : null}
          </div>
        ) : null}

        <p aria-live="polite" className={cn("text-xs empty:hidden", isError ? "text-destructive" : "text-success")}>
          {message}
        </p>
      </div>
    </div>
  )
}
