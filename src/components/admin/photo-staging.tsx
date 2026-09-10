"use client"

import { useEffect } from "react"
import { AlertCircle, Loader2 } from "lucide-react"

import { PhotoDropTile, PhotoTile } from "@/components/admin/photo-tile"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { syncFileInput, useStagedPhotos } from "@/hooks/use-staged-photos"
import { PHOTO_INPUT_ACCEPT } from "@/lib/constants/vehicle-photo-options"

/**
 * The photographs section of a create form — vehicle or spare part.
 *
 * ── Why the photographs are part of the same form ─────────────────────
 * They used to live on a separate page reached after saving, because a photo
 * is stored against a record id and there is no id until the record exists.
 * That is a database fact, and it had been allowed to become the operator's
 * problem: adding a listing meant a form, a redirect, a second screen, and a
 * mental note about which images had gone where.
 *
 * The id is still needed, so the action still creates the record before it
 * stores the files — but that ordering is now the server's business. Here,
 * entering a listing is one screen: what it is, then what it looks like.
 *
 * ── How the bytes travel ──────────────────────────────────────────────
 * Into the single named `<input type="file">` below, whose `files` are kept
 * in step with the staged list. It is a real field on a real form, so the
 * request carries the same CSRF-checked Server Action path as every other
 * control in the dashboard — no second endpoint, no browser credential that
 * can write to the storage bucket.
 *
 * ── Why this is parameterised rather than duplicated ──────────────────
 * The two product domains stage photographs identically: the same picker,
 * the same accumulate-don't-replace behaviour, the same browser-side
 * downscale, the same "first one is the cover" rule. What differs is the
 * ceiling and the wording. Copying the component to change two sentences
 * would leave two implementations of a file input that has three subtle
 * defects designed out of it (see `useStagedPhotos`), and only one of them
 * would get the next fix.
 */
export interface PhotoStagingCopy {
  /** The paragraph under the section heading. */
  intro: string
  /** What the main image is used for, under its own sub-heading. */
  mainImageHint: string
  /** What the supporting images are, under theirs. */
  otherImagesHint: React.ReactNode
  /** Label on the empty main-image tile. */
  mainDropLabel: string
  /** Hint on the empty main-image tile. */
  mainDropHint: string
  /** Alt text for the staged main image. */
  mainAlt: string
  /** Builds alt text for a staged supporting image, 1-based. */
  otherAlt: (position: number) => string
}

interface PhotoStagingProps {
  /** How many photographs may be staged. The record's own ceiling. */
  capacity: number
  /** The form field the files travel in. Must match what the action reads. */
  inputName: string
  copy: PhotoStagingCopy
  disabled?: boolean
}

export function PhotoStaging({
  capacity,
  inputName,
  copy,
  disabled = false,
}: PhotoStagingProps) {
  const {
    staged,
    error,
    preparing,
    inputRef,
    openPicker,
    handleInputChange,
    remove,
    promote,
  } = useStagedPhotos({ capacity })

  /**
   * Runs after every commit, not only when the list changes.
   *
   * React resets a form with a function action once the action settles —
   * which clears this input. When the action came back with a validation
   * error the operator is still looking at their staged previews, so pressing
   * Save again must send those same files rather than nothing. Re-syncing on
   * every render is what makes the previews and the payload the same thing.
   */
  useEffect(() => {
    syncFileInput(inputRef.current, staged)
  })

  const [main, ...others] = staged
  const busy = disabled || preparing

  return (
    <section className="flex flex-col gap-6 rounded-xl border border-border bg-card p-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-h3 font-semibold">Photographs</h2>
        <p className="max-w-2xl text-small text-muted-foreground">{copy.intro}</p>
      </div>

      <input
        ref={inputRef}
        // The one field that carries the bytes. Named, so it reaches the
        // action as part of the form; hidden, because the tiles below are the
        // control an operator actually uses.
        name={inputName}
        type="file"
        multiple
        accept={PHOTO_INPUT_ACCEPT}
        onChange={handleInputChange}
        disabled={busy}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />

      {error ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {/* ── Main photograph ──────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="font-heading text-small font-semibold">Main image</h3>
          <p className="text-small text-muted-foreground">{copy.mainImageHint}</p>
        </div>

        <div className="max-w-xl">
          {main ? (
            <PhotoTile
              image={
                // A plain <img>: the source is a local object URL, which
                // next/image cannot optimise and should not be asked to.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={main.url} alt={copy.mainAlt} className="size-full object-cover" />
              }
              label="the main image"
              isMain
              onDelete={() => remove(main.id)}
              // Nothing has been uploaded yet, so removing one costs a
              // re-selection and nothing else. A confirmation here would be
              // the kind that teaches an operator to click through them.
              confirmDelete={false}
              disabled={busy}
            />
          ) : (
            <PhotoDropTile
              label={copy.mainDropLabel}
              hint={copy.mainDropHint}
              onClick={openPicker}
              disabled={busy}
            />
          )}
        </div>
      </div>

      {/* ── Supporting photographs ───────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h3 className="font-heading text-small font-semibold">
              Other images
              {others.length > 0 ? (
                <span className="ml-2 font-normal text-muted-foreground tabular">
                  {others.length}
                </span>
              ) : null}
            </h3>
            <p className="text-small text-muted-foreground">{copy.otherImagesHint}</p>
          </div>

          {staged.length > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={openPicker}
              disabled={busy || staged.length >= capacity}
            >
              Add more
            </Button>
          ) : null}
        </div>

        {preparing ? (
          <p
            aria-live="polite"
            className="inline-flex items-center gap-2 text-small text-muted-foreground"
          >
            <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
            Preparing images
          </p>
        ) : null}

        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {others.map((photo, index) => (
            <li key={photo.id}>
              <PhotoTile
                image={
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo.url}
                    alt={copy.otherAlt(index + 1)}
                    className="size-full object-cover"
                  />
                }
                label={`photograph ${index + 1}`}
                isMain={false}
                onMakeMain={() => promote(photo.id)}
                onDelete={() => remove(photo.id)}
                confirmDelete={false}
                disabled={busy}
              />
            </li>
          ))}

          {staged.length < capacity ? (
            <li>
              <PhotoDropTile
                label="Add images"
                hint={`Select several at once · ${capacity - staged.length} left`}
                onClick={openPicker}
                disabled={busy}
              />
            </li>
          ) : null}
        </ul>
      </div>
    </section>
  )
}
