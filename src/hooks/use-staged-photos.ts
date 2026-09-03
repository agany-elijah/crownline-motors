"use client"

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react"

import {
  ACCEPTED_PHOTO_MIME_TYPES,
  MAX_PHOTO_BYTES,
  MAX_UPLOAD_BATCH_BYTES,
  formatMegabytes,
} from "@/lib/constants/vehicle-photo-options"
import { downscalePhoto } from "@/lib/utils/downscale-photo"

/**
 * Photographs chosen but not yet sent.
 *
 * `url` is an object URL and must be revoked when the entry goes, or a
 * session of adding and removing images leaks the decoded bitmap of every
 * one of them.
 */
export interface StagedPhoto {
  id: string
  file: File
  url: string
}

interface UseStagedPhotosOptions {
  /**
   * How many photographs may be staged at once.
   *
   * Passed in rather than read from the constant, because the two callers
   * have different ceilings: the create form stages a whole first gallery,
   * while the uploader on an existing vehicle is also bounded by how many
   * slots that vehicle has left.
   */
  capacity: number
}

/**
 * The shared "choose photographs" behaviour behind both galleries.
 *
 * ── The defects this exists to prevent ────────────────────────────────
 * 1. A second visit to the file picker *replaces* an `<input type="file">`'s
 *    selection rather than adding to it. An operator who picks four images,
 *    then opens the picker again for two more, silently ends up uploading
 *    two. Selections accumulate here instead, in React state, and the input
 *    is re-synced from that list after every commit.
 *
 * 2. Camera originals are large enough that a batch exceeds the request
 *    limit and the whole upload fails. Every file is re-encoded on the way
 *    in — see `downscalePhoto`.
 *
 * 3. A limit discovered by the server after a two-minute upload is a limit
 *    discovered too late. The same numbers are applied here, before anything
 *    is sent. They are *not* the check: the server enforces all of them
 *    again, and reads the leading bytes of what actually arrives.
 *
 * ── Why a selection is trimmed rather than refused ────────────────────
 * Someone picking photographs on a phone taps through a grid and presses
 * Add; over-selecting by three is normal, and it is not worth throwing away
 * the seventeen good ones. Anything that does not fit is dropped and named,
 * so nothing is ever discarded silently — which is the failure this whole
 * component exists to end.
 */
export function useStagedPhotos({ capacity }: UseStagedPhotosOptions) {
  const [staged, setStaged] = useState<StagedPhoto[]>([])
  const [error, setError] = useState<string | null>(null)
  const [preparing, setPreparing] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)

  /**
   * A mirror of `staged`, read by the callbacks below.
   *
   * `add` awaits a re-encode before it appends, so the `staged` captured in
   * its closure can be several picks out of date by the time it resolves.
   * The alternative — deriving the next list inside the `setStaged` updater —
   * would put `setError` and `URL.revokeObjectURL` inside a function React is
   * free to call twice.
   *
   * Written from an effect rather than during render: effects flush before
   * the next user event, so every callback here reads the committed list.
   */
  const stagedRef = useRef<StagedPhoto[]>([])

  useEffect(() => {
    stagedRef.current = staged
  }, [staged])

  /** Object URLs owned by this hook, so unmount can revoke them all. Kept in
   *  a ref because a cleanup effect must not re-run as the list changes. */
  const urlsRef = useRef(new Set<string>())

  useEffect(() => {
    const urls = urlsRef.current
    return () => {
      for (const url of urls) URL.revokeObjectURL(url)
      urls.clear()
    }
  }, [])

  const openPicker = useCallback(() => {
    setError(null)
    inputRef.current?.click()
  }, [])

  const add = useCallback(
    async (chosen: File[]) => {
      if (chosen.length === 0) return

      setError(null)
      setPreparing(true)

      try {
        const current = stagedRef.current
        const accepted: StagedPhoto[] = []

        /** Files the browser could not turn into something storable. */
        const unreadable: string[] = []
        /** Files that were fine but did not fit. */
        const overflowed: string[] = []

        let slotsLeft = capacity - current.length
        let bytesLeft =
          MAX_UPLOAD_BATCH_BYTES -
          current.reduce((sum, photo) => sum + photo.file.size, 0)

        for (const file of chosen) {
          const name = file.name || "Untitled image"

          if (slotsLeft <= 0) {
            overflowed.push(name)
            continue
          }

          /**
           * Re-encode first, then judge the result.
           *
           * The order matters now that the picker offers `image/*`: an
           * iPhone hands over HEIC, which is not a format this system
           * stores, but which Safari can decode — so it comes back out of
           * `downscalePhoto` as WebP and is perfectly acceptable. Checking
           * the *original* type would refuse every photograph taken on an
           * iPhone, which is most of them.
           *
           * Sequential rather than Promise.all: each decode holds a
           * full-size bitmap, and ten at once is where a mid-range phone
           * runs out of memory and the tab reloads with everything lost.
           */
          const prepared = await downscalePhoto(file)

          if (!isStorableType(prepared.type)) {
            unreadable.push(name)
            continue
          }

          if (prepared.size > MAX_PHOTO_BYTES || prepared.size > bytesLeft) {
            overflowed.push(name)
            continue
          }

          const url = URL.createObjectURL(prepared)
          urlsRef.current.add(url)
          accepted.push({ id: crypto.randomUUID(), file: prepared, url })

          slotsLeft -= 1
          bytesLeft -= prepared.size
        }

        if (accepted.length > 0) setStaged([...current, ...accepted])

        setError(describeSkipped(unreadable, overflowed, accepted.length, capacity))
      } finally {
        setPreparing(false)
      }
    },
    [capacity]
  )

  /**
   * Reads a file input.
   *
   * The input is *not* cleared here. The effect in each gallery re-syncs it
   * from the staged list on every commit, which both replaces the browser's
   * own selection and makes the input's payload identical to what the
   * previews show.
   */
  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      void add(Array.from(event.target.files ?? []))
    },
    [add]
  )

  const remove = useCallback((id: string) => {
    setError(null)

    const going = stagedRef.current.find((photo) => photo.id === id)
    if (going) revoke(urlsRef.current, going.url)

    setStaged(stagedRef.current.filter((photo) => photo.id !== id))
  }, [])

  /** Moves one photograph to the front of the list. The front is the main
   *  image, on the create form and in the order files are sent. */
  const promote = useCallback((id: string) => {
    setStaged((current) => {
      const index = current.findIndex((photo) => photo.id === id)
      if (index <= 0) return current

      const next = [...current]
      const [photo] = next.splice(index, 1)
      next.unshift(photo)
      return next
    })
  }, [])

  const reset = useCallback(() => {
    setError(null)
    for (const photo of stagedRef.current) revoke(urlsRef.current, photo.url)
    setStaged([])
  }, [])

  return {
    staged,
    error,
    setError,
    preparing,
    inputRef,
    openPicker,
    handleInputChange,
    add,
    remove,
    promote,
    reset,
  }
}

function revoke(owned: Set<string>, url: string): void {
  URL.revokeObjectURL(url)
  owned.delete(url)
}

function isStorableType(type: string): boolean {
  return (ACCEPTED_PHOTO_MIME_TYPES as readonly string[]).includes(type)
}

/** At most three names per reason: a phone selection can drop a dozen files
 *  at once, and a message listing all of them is one nobody reads. */
function nameList(names: string[]): string {
  const shown = names.slice(0, 3).map((name) => `“${name}”`)
  const rest = names.length - shown.length

  return rest > 0 ? `${shown.join(", ")} and ${rest} more` : shown.join(", ")
}

/**
 * One sentence per reason something was left out, or null when everything
 * was taken.
 *
 * Always names what was dropped. A count alone ("3 images skipped") makes an
 * operator re-count a grid of twenty thumbnails to work out which.
 */
function describeSkipped(
  unreadable: string[],
  overflowed: string[],
  acceptedCount: number,
  capacity: number
): string | null {
  const parts: string[] = []

  if (unreadable.length > 0) {
    parts.push(
      `${nameList(unreadable)} could not be read as an image by this browser. Save ${unreadable.length === 1 ? "it" : "them"} as JPEG or PNG and try again.`
    )
  }

  if (overflowed.length > 0) {
    parts.push(
      `${nameList(overflowed)} did not fit — a batch holds up to ${capacity} image${capacity === 1 ? "" : "s"} and ${formatMegabytes(MAX_UPLOAD_BATCH_BYTES)} in total, with each image up to ${formatMegabytes(MAX_PHOTO_BYTES)}. Upload what is here, then add the rest.`
    )
  }

  if (parts.length === 0) return null

  return acceptedCount > 0
    ? `${acceptedCount} image${acceptedCount === 1 ? "" : "s"} added. ${parts.join(" ")}`
    : parts.join(" ")
}

/**
 * Copies a staged list into a real `<input type="file">`.
 *
 * The bytes have to reach the Server Action as part of the form, and an
 * input's `files` cannot be assigned a plain array — a `DataTransfer` is the
 * only way to build a `FileList`. Doing it this way keeps the form a real
 * form: the request carries the same CSRF-checked Server Action path as
 * every other control in the dashboard, with no second endpoint and no
 * browser credential that can write to the storage bucket.
 */
export function syncFileInput(
  input: HTMLInputElement | null,
  photos: StagedPhoto[]
): void {
  if (!input || typeof DataTransfer === "undefined") return

  const transfer = new DataTransfer()
  for (const photo of photos) transfer.items.add(photo.file)
  input.files = transfer.files
}
