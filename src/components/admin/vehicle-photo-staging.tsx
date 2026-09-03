"use client"

import { useEffect } from "react"
import { AlertCircle, Loader2 } from "lucide-react"

import { PhotoDropTile, PhotoTile } from "@/components/admin/photo-tile"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { syncFileInput, useStagedPhotos } from "@/hooks/use-staged-photos"
import {
  MAX_PHOTOS_PER_UPLOAD,
  PHOTO_INPUT_ACCEPT,
} from "@/lib/constants/vehicle-photo-options"

/**
 * The photographs section of the create-vehicle form.
 *
 * ── Why the photographs are part of the same form ─────────────────────
 * They used to live on a separate page reached after saving, because a photo
 * is stored against a vehicle id and there is no id until the record exists.
 * That is a database fact, and it had been allowed to become the operator's
 * problem: adding a car meant a form, a redirect, a second screen, and a
 * mental note about which images had gone where.
 *
 * The id is still needed, so the action still creates the vehicle before it
 * stores the files — but that ordering is now the server's business. Here,
 * entering a vehicle is one screen: what it is, then what it looks like.
 *
 * ── How the bytes travel ──────────────────────────────────────────────
 * Into the single named `<input type="file">` below, whose `files` are kept
 * in step with the staged list. It is a real field on a real form, so the
 * request carries the same CSRF-checked Server Action path as every other
 * control in the dashboard — no second endpoint, no browser credential that
 * can write to the storage bucket.
 */
export function VehiclePhotoStaging({ disabled = false }: { disabled?: boolean }) {
  const {
    staged,
    error,
    preparing,
    inputRef,
    openPicker,
    handleInputChange,
    remove,
    promote,
  } = useStagedPhotos({ capacity: MAX_PHOTOS_PER_UPLOAD })

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
        <p className="max-w-2xl text-small text-muted-foreground">
          Added when you save the vehicle. You can select several at once,
          on a phone as well as a computer. Landscape photographs look best —
          every image is shown at 16:9 across the website, and each one is
          resized in your browser before it is sent so the listing stays fast
          on a mobile connection.
        </p>
      </div>

      <input
        ref={inputRef}
        // The one field that carries the bytes. Named, so it reaches the
        // action as part of the form; hidden, because the tiles below are the
        // control an operator actually uses.
        name="photos"
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
          <p className="text-small text-muted-foreground">
            This is the first image customers see — on the vehicle card, in
            search results, and at the top of the gallery.
          </p>
        </div>

        <div className="max-w-xl">
          {main ? (
            <PhotoTile
              image={
                // A plain <img>: the source is a local object URL, which
                // next/image cannot optimise and should not be asked to.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={main.url}
                  alt="Main photograph of this vehicle"
                  className="size-full object-cover"
                />
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
              label="Choose the main image"
              hint="The first photograph customers will see"
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
            <p className="text-small text-muted-foreground">
              The rest of the walk-around, shown after the main image. Pick
              as many as you like in one go. Use the{" "}
              <span aria-hidden="true">⋯</span> menu on any of them to make it
              the main image instead.
            </p>
          </div>

          {staged.length > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={openPicker}
              disabled={busy || staged.length >= MAX_PHOTOS_PER_UPLOAD}
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
                    alt={`Photograph ${index + 1} of this vehicle`}
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

          {staged.length < MAX_PHOTOS_PER_UPLOAD ? (
            <li>
              <PhotoDropTile
                label="Add images"
                hint={`Select several at once · ${MAX_PHOTOS_PER_UPLOAD - staged.length} left`}
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
