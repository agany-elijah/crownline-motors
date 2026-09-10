"use client"

import Image from "next/image"
import { useActionState, useEffect, useRef, useState } from "react"
import { AlertCircle, CheckCircle2, Loader2, Upload, X } from "lucide-react"

import { PhotoDropTile, PhotoTile } from "@/components/admin/photo-tile"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { syncFileInput, useStagedPhotos } from "@/hooks/use-staged-photos"
import {
  deleteSparePartPhotoAction,
  reorderSparePartPhotosAction,
  setPrimarySparePartPhotoAction,
  uploadSparePartPhotosAction,
  type SparePartPhotoActionState,
} from "@/lib/actions/spare-part-photo.actions"
import {
  MAX_PHOTOS_PER_SPARE_PART,
  PHOTO_INPUT_ACCEPT,
} from "@/lib/constants/spare-part-photo-options"
import {
  describeSparePartPhoto,
  type SparePartPhotoDTO,
} from "@/types/spare-part-photo"

const INITIAL_STATE: SparePartPhotoActionState = { status: "idle" }

interface SparePartPhotoBoardProps {
  sparePartId: string
  partName: string
  photos: SparePartPhotoDTO[]
}

/**
 * The gallery an operator arranges, on the part's own page.
 *
 * The create form stages photographs in the browser because there is no part
 * id yet; here there is one, so every change is a real mutation that takes
 * effect on its own. That difference is why the two are separate components
 * rather than one with a flag: the create form's Save button implies nothing
 * happens until pressed, and this board's controls imply the opposite.
 *
 * Every control is a real `<form>` posting to a Server Action, not an
 * `onClick` calling one — so the request carries the same CSRF-checked path
 * and the same server-side authorisation as everything else in the dashboard.
 * The tile menus submit those forms; they do not replace them.
 *
 * Feedback is shared across the whole gallery rather than per tile. These
 * actions are mutually exclusive in practice, and a message per tile would
 * put ten live regions on one screen.
 *
 * Unlike the vehicle board there is no per-photograph description dialog —
 * see the note in spare-part-photo.actions.ts for why alt text is generated
 * for parts rather than typed.
 */
export function SparePartPhotoBoard({
  sparePartId,
  partName,
  photos,
}: SparePartPhotoBoardProps) {
  const [uploadState, uploadAction, uploadPending] = useActionState(
    uploadSparePartPhotosAction,
    INITIAL_STATE
  )
  const [primaryState, primaryAction, primaryPending] = useActionState(
    setPrimarySparePartPhotoAction,
    INITIAL_STATE
  )
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteSparePartPhotoAction,
    INITIAL_STATE
  )
  const [reorderState, reorderAction, reorderPending] = useActionState(
    reorderSparePartPhotosAction,
    INITIAL_STATE
  )

  const remaining = Math.max(0, MAX_PHOTOS_PER_SPARE_PART - photos.length)

  const {
    staged,
    error: stagingError,
    preparing,
    inputRef,
    openPicker,
    handleInputChange,
    remove,
    promote,
    reset,
  } = useStagedPhotos({ capacity: remaining })

  /**
   * Keeps the file input's payload equal to what the previews show, on every
   * commit. React resets a form with a function action once that action
   * settles, which clears the input; without this, a retry after a rejected
   * upload would send nothing at all.
   */
  useEffect(() => {
    syncFileInput(inputRef.current, staged)
  })

  /**
   * Clear the staging area once the server has taken the batch.
   *
   * Adjusted during render rather than in an effect — React documents this as
   * the correct shape for "reset state when something else changes", and it
   * applies before anything is committed, so there is no frame in which
   * photographs already in the gallery are still shown as pending.
   */
  const [lastUpload, setLastUpload] = useState(uploadState)
  if (uploadState !== lastUpload) {
    setLastUpload(uploadState)
    if (uploadState.status === "success") reset()
  }

  const busy =
    uploadPending || primaryPending || deletePending || reorderPending || preparing

  /**
   * The banner shows the result of the action that finished most recently.
   *
   * `useActionState` keeps a settled result for the life of the component, so
   * picking the first non-idle state from a fixed list would leave a stale
   * "Photograph removed." on screen after every later upload. Tracking which
   * state object changed is what actually answers "most recent", and it is
   * adjusted during render so the correct message is in the first commit.
   */
  const [feedback, setFeedback] = useState<SparePartPhotoActionState>(INITIAL_STATE)
  const [seen, setSeen] = useState({
    upload: uploadState,
    primary: primaryState,
    remove: deleteState,
    reorder: reorderState,
  })

  if (
    uploadState !== seen.upload ||
    primaryState !== seen.primary ||
    deleteState !== seen.remove ||
    reorderState !== seen.reorder
  ) {
    // Exactly one action is ever in flight, so at most one of these differs.
    const changed =
      uploadState !== seen.upload
        ? uploadState
        : primaryState !== seen.primary
          ? primaryState
          : deleteState !== seen.remove
            ? deleteState
            : reorderState

    setSeen({
      upload: uploadState,
      primary: primaryState,
      remove: deleteState,
      reorder: reorderState,
    })
    setFeedback(changed)
  }

  const main = photos.find((photo) => photo.isPrimary) ?? null
  const others = photos.filter((photo) => photo.id !== main?.id)

  /**
   * Submits a new gallery order.
   *
   * The action takes the complete ordered list so it can verify the result is
   * a permutation of exactly what is stored. The main image leads it: read
   * ordering floats it to the front regardless, and including it keeps the
   * submitted set equal to the stored set, which is what the server checks.
   *
   * Invoked with a `FormData` rather than through a `<form>` element — it
   * still travels the identical Server Action path, with the same CSRF check
   * and the same authorisation. What it avoids is a hidden form per direction
   * per tile, encoding an order the client already knows.
   */
  function submitOrder(nextOthers: SparePartPhotoDTO[]) {
    const formData = new FormData()
    formData.set("sparePartId", sparePartId)

    for (const photo of [...(main ? [main] : []), ...nextOthers]) {
      formData.append("photoIds", photo.id)
    }

    reorderAction(formData)
  }

  /** Swaps a supporting photograph with its neighbour and saves the result. */
  function movePhoto(index: number, delta: -1 | 1) {
    const target = index + delta
    if (target < 0 || target >= others.length) return

    const next = [...others]
    ;[next[index], next[target]] = [next[target], next[index]]

    submitOrder(next)
  }

  return (
    <section
      id="photographs"
      className="flex flex-col gap-6 rounded-xl border border-border bg-card p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-h3 font-semibold">
          Photographs
          <span className="ml-2 text-body font-normal text-muted-foreground tabular">
            {photos.length}
          </span>
        </h2>
        <p className="text-small text-muted-foreground">
          {photos.length} of {MAX_PHOTOS_PER_SPARE_PART} used.
        </p>
      </div>

      {feedback.status === "success" && feedback.message ? (
        <Alert>
          <CheckCircle2 aria-hidden="true" className="text-success" />
          <AlertDescription>{feedback.message}</AlertDescription>
        </Alert>
      ) : null}

      {feedback.status === "error" && feedback.message ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertDescription>{feedback.message}</AlertDescription>
        </Alert>
      ) : null}

      {stagingError ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertDescription>{stagingError}</AlertDescription>
        </Alert>
      ) : null}

      {/* ── Main image ───────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="font-heading text-small font-semibold">Main image</h3>
          <p className="text-small text-muted-foreground">
            Shown on the catalogue card and first in the gallery.
          </p>
        </div>

        <div className="max-w-xl">
          {main ? (
            <StoredPartPhotoTile
              sparePartId={sparePartId}
              partName={partName}
              photo={main}
              isMain
              busy={busy}
              primaryAction={primaryAction}
              deleteAction={deleteAction}
            />
          ) : (
            <PhotoDropTile
              label="Add the main image"
              hint={
                remaining === 0
                  ? "No slots left"
                  : "The first photograph customers will see"
              }
              onClick={openPicker}
              disabled={busy || remaining === 0}
            />
          )}
        </div>
      </div>

      {/* ── Other images ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
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
            Shown after the main image, in this order. Use the{" "}
            <span aria-hidden="true">⋯</span> menu to reorder or change the
            main image.
          </p>
        </div>

        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {others.map((photo, index) => (
            <li key={photo.id}>
              <StoredPartPhotoTile
                sparePartId={sparePartId}
                partName={partName}
                photo={photo}
                position={index + 1}
                isMain={false}
                busy={busy}
                primaryAction={primaryAction}
                deleteAction={deleteAction}
                onMoveEarlier={index > 0 ? () => movePhoto(index, -1) : undefined}
                onMoveLater={
                  index < others.length - 1 ? () => movePhoto(index, 1) : undefined
                }
              />
            </li>
          ))}

          {main && remaining > 0 ? (
            <li>
              <PhotoDropTile
                label="Add images"
                hint={`Select several at once · ${remaining} slot${remaining === 1 ? "" : "s"} left`}
                onClick={openPicker}
                disabled={busy}
              />
            </li>
          ) : null}
        </ul>
      </div>

      {/* ── Upload ───────────────────────────────────────────────── */}
      <form action={uploadAction} className="flex flex-col gap-4">
        <input type="hidden" name="sparePartId" value={sparePartId} />

        <input
          ref={inputRef}
          // The one field that carries the bytes, kept in step with the
          // previews below. Hidden because the tiles are the control an
          // operator actually uses.
          name="files"
          type="file"
          multiple
          accept={PHOTO_INPUT_ACCEPT}
          onChange={handleInputChange}
          disabled={busy || remaining === 0}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />

        {preparing ? (
          <p
            aria-live="polite"
            className="inline-flex items-center gap-2 text-small text-muted-foreground"
          >
            <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
            Preparing images
          </p>
        ) : null}

        {staged.length > 0 ? (
          <div className="flex flex-col gap-4 rounded-lg border border-border bg-secondary/50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-small font-semibold">
                {staged.length} image{staged.length === 1 ? "" : "s"} ready to
                upload
              </p>

              <button
                type="button"
                onClick={reset}
                disabled={busy}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-small text-muted-foreground transition-colors duration-fast hover:text-gold-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60"
              >
                <X aria-hidden="true" className="size-3.5" />
                Clear
              </button>
            </div>

            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {staged.map((photo, index) => (
                <li key={photo.id}>
                  <PhotoTile
                    image={
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photo.url}
                        alt={`Image ${index + 1} waiting to be uploaded`}
                        className="size-full object-cover"
                      />
                    }
                    label={`image ${index + 1} waiting to be uploaded`}
                    isMain={false}
                    // Promoting a pending image only reorders the batch; it
                    // becomes the main image once uploaded only if the gallery
                    // has none, which the server decides.
                    onMakeMain={
                      photos.length === 0 ? () => promote(photo.id) : undefined
                    }
                    onDelete={() => remove(photo.id)}
                    confirmDelete={false}
                    disabled={busy}
                  />
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={busy}>
                {uploadPending ? (
                  <>
                    <Loader2 aria-hidden="true" className="animate-spin" />
                    Uploading
                  </>
                ) : (
                  <>
                    <Upload aria-hidden="true" />
                    Upload {staged.length} image
                    {staged.length === 1 ? "" : "s"}
                  </>
                )}
              </Button>

              <p className="text-small text-muted-foreground">
                {photos.length === 0
                  ? "The first of these becomes the main image."
                  : "These are added after the existing images. The main image does not change."}
              </p>
            </div>
          </div>
        ) : null}
      </form>
    </section>
  )
}

interface StoredPartPhotoTileProps {
  sparePartId: string
  partName: string
  photo: SparePartPhotoDTO
  /** Position among the supporting images, for the accessible description. */
  position?: number
  isMain: boolean
  busy: boolean
  primaryAction: (formData: FormData) => void
  deleteAction: (formData: FormData) => void
  /** Absent for the first supporting photograph and for the main image. */
  onMoveEarlier?: () => void
  /** Absent for the last supporting photograph and for the main image. */
  onMoveLater?: () => void
}

/**
 * One stored photograph, with its two mutations as real forms.
 *
 * The forms are rendered alongside the tile and submitted by its menu through
 * refs, rather than the menu calling the action directly. It costs a few lines
 * and keeps the request identical in shape to every other dashboard mutation —
 * same fields, same Server Action path, same server-side ownership check on
 * `sparePartId` + `photoId`.
 */
function StoredPartPhotoTile({
  sparePartId,
  partName,
  photo,
  position,
  isMain,
  busy,
  primaryAction,
  deleteAction,
  onMoveEarlier,
  onMoveLater,
}: StoredPartPhotoTileProps) {
  const primaryFormRef = useRef<HTMLFormElement>(null)
  const deleteFormRef = useRef<HTMLFormElement>(null)

  const alt = describeSparePartPhoto(photo, partName, position)

  return (
    <>
      <form ref={primaryFormRef} action={primaryAction} className="hidden">
        <input type="hidden" name="sparePartId" value={sparePartId} />
        <input type="hidden" name="photoId" value={photo.id} />
      </form>

      <form ref={deleteFormRef} action={deleteAction} className="hidden">
        <input type="hidden" name="sparePartId" value={sparePartId} />
        <input type="hidden" name="photoId" value={photo.id} />
      </form>

      <PhotoTile
        image={
          <Image
            src={photo.url}
            alt={alt}
            fill
            sizes={
              isMain
                ? "(min-width: 640px) 36rem, 100vw"
                : "(min-width: 1024px) 18rem, (min-width: 640px) 30vw, 45vw"
            }
            className="object-cover"
          />
        }
        label={alt}
        isMain={isMain}
        onMakeMain={
          isMain ? undefined : () => primaryFormRef.current?.requestSubmit()
        }
        onMoveEarlier={onMoveEarlier}
        onMoveLater={onMoveLater}
        onDelete={() => deleteFormRef.current?.requestSubmit()}
        disabled={busy}
      />
    </>
  )
}
