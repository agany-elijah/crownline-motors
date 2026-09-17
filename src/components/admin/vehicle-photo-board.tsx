"use client"

import Image from "next/image"
import { useActionState, useEffect, useRef, useState } from "react"
import { AlertCircle, CheckCircle2, Loader2, Upload, X } from "lucide-react"

import { PhotoDescriptionDialog } from "@/components/admin/photo-description-dialog"
import { PhotoDropTile, PhotoTile } from "@/components/admin/photo-tile"
import { AdminFormBadge, AdminFormSection } from "@/components/admin/admin-form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { syncFileInput, useStagedPhotos } from "@/hooks/use-staged-photos"
import {
  deleteVehiclePhotoAction,
  reorderVehiclePhotosAction,
  setPrimaryVehiclePhotoAction,
  updateVehiclePhotoAltTextAction,
  uploadVehiclePhotosAction,
  type VehiclePhotoActionState,
} from "@/lib/actions/vehicle-photo.actions"
import {
  MAX_PHOTOS_PER_UPLOAD,
  MAX_PHOTOS_PER_VEHICLE,
  PHOTO_INPUT_ACCEPT,
} from "@/lib/constants/vehicle-photo-options"
import {
  describeVehiclePhoto,
  type VehicleNaming,
  type VehiclePhotoDTO,
} from "@/types/vehicle-photo"

const INITIAL_STATE: VehiclePhotoActionState = { status: "idle" }

interface VehiclePhotoBoardProps {
  vehicleId: string
  vehicle: VehicleNaming
  photos: VehiclePhotoDTO[]
}

/**
 * The gallery an operator arranges, on the vehicle's own page.
 *
 * ── What this replaced, and why ───────────────────────────────────────
 * A separate photos screen where every image carried a category select, a
 * description field, two reorder buttons and a delete button — and where
 * which image was the cover was decided by a rule rather than shown as a
 * choice. Categories are gone entirely (they described the photograph to
 * nobody), and the arrangement is now the one distinction that changes what
 * a customer sees: one main image, then the rest.
 *
 * Every control is still a real `<form>` posting to a Server Action, not an
 * `onClick` calling one — so the request carries the same CSRF-checked path
 * and the same server-side authorisation as everything else in the
 * dashboard. The menus submit those forms; they do not replace them.
 *
 * Feedback is shared across the whole gallery rather than per tile. These
 * actions are mutually exclusive in practice, and a message per tile would
 * put a dozen live regions on one screen.
 */
export function VehiclePhotoBoard({
  vehicleId,
  vehicle,
  photos,
}: VehiclePhotoBoardProps) {
  const [uploadState, uploadAction, uploadPending] = useActionState(
    uploadVehiclePhotosAction,
    INITIAL_STATE
  )
  const [primaryState, primaryAction, primaryPending] = useActionState(
    setPrimaryVehiclePhotoAction,
    INITIAL_STATE
  )
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteVehiclePhotoAction,
    INITIAL_STATE
  )
  const [reorderState, reorderAction, reorderPending] = useActionState(
    reorderVehiclePhotosAction,
    INITIAL_STATE
  )
  const [altTextState, altTextAction, altTextPending] = useActionState(
    updateVehiclePhotoAltTextAction,
    INITIAL_STATE
  )

  const remaining = Math.max(0, MAX_PHOTOS_PER_VEHICLE - photos.length)

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
  } = useStagedPhotos({ capacity: Math.min(remaining, MAX_PHOTOS_PER_UPLOAD) })

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
   * Adjusted during render rather than in an effect — React documents this
   * as the correct shape for "reset state when something else changes", and
   * it applies before anything is committed, so there is no frame in which
   * photographs that are already in the gallery are still shown as pending.
   */
  const [lastUpload, setLastUpload] = useState(uploadState)
  if (uploadState !== lastUpload) {
    setLastUpload(uploadState)
    if (uploadState.status === "success") reset()
  }

  const busy =
    uploadPending ||
    primaryPending ||
    deletePending ||
    reorderPending ||
    altTextPending ||
    preparing

  /**
   * The banner shows the result of the action that finished most recently.
   *
   * This used to pick the first non-idle state from a fixed list, which is
   * not the same thing: `useActionState` keeps a settled result for the life
   * of the component, so once a delete had succeeded, every later "make main
   * image" and every upload still displayed "Photograph removed." The
   * operator was told they had done something they had not.
   *
   * Tracking which state object changed is what actually answers "most
   * recent". Adjusted during render — the pattern used throughout this
   * dashboard — so the correct message is in the first commit rather than
   * appearing a frame later.
   */
  const [feedback, setFeedback] = useState<VehiclePhotoActionState>(INITIAL_STATE)
  const [seen, setSeen] = useState({
    upload: uploadState,
    primary: primaryState,
    remove: deleteState,
    reorder: reorderState,
    altText: altTextState,
  })

  if (
    uploadState !== seen.upload ||
    primaryState !== seen.primary ||
    deleteState !== seen.remove ||
    reorderState !== seen.reorder ||
    altTextState !== seen.altText
  ) {
    // Exactly one action is ever in flight, so at most one of these differs.
    const changed =
      uploadState !== seen.upload
        ? uploadState
        : primaryState !== seen.primary
          ? primaryState
          : deleteState !== seen.remove
            ? deleteState
            : reorderState !== seen.reorder
              ? reorderState
              : altTextState

    setSeen({
      upload: uploadState,
      primary: primaryState,
      remove: deleteState,
      reorder: reorderState,
      altText: altTextState,
    })
    setFeedback(changed)
  }

  const main = photos.find((photo) => photo.isPrimary) ?? null
  const others = photos.filter((photo) => photo.id !== main?.id)

  /**
   * Submits a new gallery order.
   *
   * The action takes the complete ordered list so it can verify the result
   * is a permutation of exactly what is stored (see the action). The main
   * image leads it: read ordering floats it to the front regardless, and
   * including it keeps the submitted set equal to the stored set, which is
   * what the server checks.
   *
   * Invoked with a `FormData` rather than through a `<form>` element. Every
   * other control here is a real form, and for the same reason — this still
   * travels the identical Server Action path, with the same CSRF check and
   * the same server-side authorisation. What it avoids is rendering a
   * separate hidden form per direction per tile, which on a forty-image
   * gallery is thousands of hidden inputs whose only purpose is to encode an
   * order the client already knows.
   */
  function submitOrder(nextOthers: VehiclePhotoDTO[]) {
    const formData = new FormData()
    formData.set("vehicleId", vehicleId)

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

  /** The photograph whose description is being edited, if any. */
  const [editing, setEditing] = useState<VehiclePhotoDTO | null>(null)

  function submitAltText(photo: VehiclePhotoDTO, altText: string) {
    const formData = new FormData()
    formData.set("vehicleId", vehicleId)
    formData.set("photoId", photo.id)
    formData.set("altText", altText)

    altTextAction(formData)
  }

  return (
    <AdminFormSection
      id="photographs"
      title="Photographs"
      description="The main image appears on the vehicle's card and leads its gallery. Changes here take effect straight away."
      badge={
        <AdminFormBadge tone={photos.length === 0 ? "warning" : "neutral"}>
          <span className="tabular-nums">
            {photos.length}/{MAX_PHOTOS_PER_VEHICLE}
          </span>
          photographs
        </AdminFormBadge>
      }
      bodyClassName="flex flex-col gap-6"
    >

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
        <h3 className="text-small font-medium text-foreground">Main image</h3>

        <div className="max-w-xl">
          {main ? (
            <StoredPhotoTile
              vehicleId={vehicleId}
              vehicle={vehicle}
              photo={main}
              isMain
              busy={busy}
              primaryAction={primaryAction}
              deleteAction={deleteAction}
              onEditDescription={() => setEditing(main)}
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
        <h3 className="text-small font-medium text-foreground">
          Other images
          {others.length > 0 ? (
            <span className="ml-2 font-normal text-muted-foreground tabular-nums">
              {others.length}
            </span>
          ) : null}
        </h3>

        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {others.map((photo, index) => (
            <li key={photo.id}>
              <StoredPhotoTile
                vehicleId={vehicleId}
                vehicle={vehicle}
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
                onEditDescription={() => setEditing(photo)}
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
        <input type="hidden" name="vehicleId" value={vehicleId} />

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
          <div className="flex flex-col gap-4 rounded-lg border border-dashed border-gold-ink/35 bg-accent/40 p-4">
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
                    // becomes the main image once uploaded only if the
                    // gallery has none, which the server decides.
                    onMakeMain={photos.length === 0 ? () => promote(photo.id) : undefined}
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
            </div>
          </div>
        ) : null}
      </form>

      {/*
        One dialog for the whole gallery rather than one per tile. It is only
        ever open for a single photograph, and forty mounted dialogs would put
        forty labelled textareas in the accessibility tree for no benefit.
      */}
      {editing ? (
        <PhotoDescriptionDialog
          open
          onOpenChange={(open) => {
            if (!open) setEditing(null)
          }}
          value={editing.altText}
          fallback={describeVehiclePhoto(
            { altText: null, isPrimary: editing.isPrimary },
            vehicle,
            others.findIndex((photo) => photo.id === editing.id) + 1 || undefined
          )}
          pending={altTextPending}
          onSubmit={(altText) => {
            submitAltText(editing, altText)
            setEditing(null)
          }}
        />
      ) : null}
    </AdminFormSection>
  )
}

interface StoredPhotoTileProps {
  vehicleId: string
  vehicle: VehicleNaming
  photo: VehiclePhotoDTO
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
  onEditDescription: () => void
}

/**
 * One stored photograph, with its two mutations as real forms.
 *
 * The forms are rendered alongside the tile and submitted by its menu
 * through refs, rather than the menu calling the action directly. It costs a
 * few lines and keeps the request identical in shape to every other
 * dashboard mutation — same fields, same Server Action path, same
 * server-side ownership check on `vehicleId` + `photoId`.
 */
function StoredPhotoTile({
  vehicleId,
  vehicle,
  photo,
  position,
  isMain,
  busy,
  primaryAction,
  deleteAction,
  onMoveEarlier,
  onMoveLater,
  onEditDescription,
}: StoredPhotoTileProps) {
  const primaryFormRef = useRef<HTMLFormElement>(null)
  const deleteFormRef = useRef<HTMLFormElement>(null)

  const alt = describeVehiclePhoto(photo, vehicle, position)

  return (
    <>
      <form ref={primaryFormRef} action={primaryAction} className="hidden">
        <input type="hidden" name="vehicleId" value={vehicleId} />
        <input type="hidden" name="photoId" value={photo.id} />
      </form>

      <form ref={deleteFormRef} action={deleteAction} className="hidden">
        <input type="hidden" name="vehicleId" value={vehicleId} />
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
        onEditDescription={onEditDescription}
        hasDescription={photo.altText !== null}
        onDelete={() => deleteFormRef.current?.requestSubmit()}
        disabled={busy}
      />
    </>
  )
}
