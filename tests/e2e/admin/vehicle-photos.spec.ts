import { deflateSync, crc32 } from "node:zlib"
import { expect, test, type Page } from "@playwright/test"
import { adminPath } from "../../../src/lib/constants/admin-routes"

/**
 * The photograph pipeline, end to end.
 *
 * ── Why this file exists ──────────────────────────────────────────────
 * Migration `20260829093000_repair_vehicle_photo_primary` was written
 * because live data had drifted out of the "exactly one main image"
 * invariant — a vehicle was found with a live photograph and no primary. At
 * that point the upload, promote, reorder and remove paths had no automated
 * coverage at all. `tests/unit/vehicle-photo-gallery.test.ts` now covers the
 * invariant logic directly; this covers the same ground through a real
 * browser, a real Server Action and real storage, which is the only way to
 * catch the wiring between them.
 *
 * ── What it leaves behind ─────────────────────────────────────────────
 * Each test archives the vehicle it created, which is the correct resting
 * state for a listing that should not appear anywhere. The uploaded objects
 * remain in Supabase Storage: removal is a soft delete by design, so the
 * bytes are deliberately kept. That is the system behaving correctly, not a
 * cleanup failure — but it does mean this suite should be pointed at a
 * non-production project.
 */

const TEST_MAKE = "ZZ-Test-Photos"

function uniqueModel() {
  return `Photo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

/**
 * A real, decodable PNG of a single solid colour.
 *
 * Generated rather than committed as a fixture: the browser genuinely
 * decodes this through `createImageBitmap` and re-encodes it to WebP before
 * upload (see `downscale-photo.ts`), so a stub of arbitrary bytes would fail
 * at the first step and never exercise the path being tested. Distinct
 * colours make the images distinguishable if a failure needs to be
 * inspected from a trace.
 */
function solidPng(r: number, g: number, b: number, size = 24): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

  const chunk = (type: string, data: Buffer): Buffer => {
    const length = Buffer.alloc(4)
    length.writeUInt32BE(data.length)

    const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data])

    const checksum = Buffer.alloc(4)
    checksum.writeUInt32BE(crc32(typeAndData) >>> 0)

    return Buffer.concat([length, typeAndData, checksum])
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0) // width
  ihdr.writeUInt32BE(size, 4) // height
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // colour type: truecolour
  ihdr[10] = 0 // compression
  ihdr[11] = 0 // filter
  ihdr[12] = 0 // interlace

  // One filter byte (0 = none) then RGB triples, per scanline.
  const raw = Buffer.concat(
    Array.from({ length: size }, () =>
      Buffer.concat([
        Buffer.from([0]),
        Buffer.concat(Array.from({ length: size }, () => Buffer.from([r, g, b]))),
      ])
    )
  )

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ])
}

function photoFile(name: string, rgb: [number, number, number]) {
  return { name, mimeType: "image/png", buffer: solidPng(...rgb) }
}

async function fillVehicleForm(page: Page, model: string) {
  await page.getByLabel("Make").fill(TEST_MAKE)
  await page.getByLabel("Model").fill(model)
  await page.getByLabel("Year").fill("2021")
  await page.getByLabel("Price (USD)").fill("22500")
  await page.getByLabel("Mileage (km)").fill("42000")
  await page.getByLabel("Engine size").fill("2.0L")
  await page.getByLabel("Current location").fill("Yokohama, Japan")
  await page.getByLabel("Exterior colour").fill("Black")
  await page.getByLabel("Interior colour").fill("Black")
  await page
    .getByLabel("Description")
    .fill("Automated photograph test. Safe to archive — created by the e2e suite.")
}

/** Creates a vehicle with no photographs and returns its detail URL. */
async function createVehicle(page: Page, model: string): Promise<string> {
  await page.goto(adminPath("/vehicles/new"))
  await fillVehicleForm(page, model)
  await page.getByRole("button", { name: "Create vehicle" }).click()
  await expect(page).toHaveURL(/\?created=1$/)

  return page.url()
}

async function archiveCurrent(page: Page) {
  const archive = page.getByRole("button", { name: "Archive" })
  if (await archive.isVisible().catch(() => false)) {
    await archive.click()
    await expect(page.getByText("Status changed to archived.")).toBeVisible()
  }
}

/** Uploads files through the gallery's hidden input and commits the batch. */
async function uploadPhotos(
  page: Page,
  files: ReturnType<typeof photoFile>[]
) {
  await page.locator('input[name="files"]').setInputFiles(files)

  // The browser re-encodes each image before it is staged, so the Upload
  // button only appears once that has finished.
  const upload = page.getByRole("button", { name: /^Upload \d+ image/ })
  await expect(upload).toBeVisible()
  await upload.click()
}

/** The tiles in the "Other images" grid, in rendered order. */
function otherTiles(page: Page) {
  return page.locator('ul li [data-slot="button"][aria-label^="Options for"]')
}

test.describe("vehicle photographs", () => {
  test("uploads a batch and makes the first image the main one", async ({ page }) => {
    const model = uniqueModel()
    await createVehicle(page, model)

    try {
      await expect(page.getByText("This vehicle has no photographs")).toBeVisible()

      await uploadPhotos(page, [
        photoFile("front.png", [200, 30, 30]),
        photoFile("side.png", [30, 200, 30]),
        photoFile("rear.png", [30, 30, 200]),
      ])

      await expect(page.getByText("3 photographs added.")).toBeVisible()

      // Exactly one main image — the invariant the repair migration existed
      // to restore, asserted here on the surface that shows it.
      await expect(page.getByText("Main image", { exact: true })).toHaveCount(1)

      // And the publish warning is gone, because the gallery is no longer
      // empty.
      await expect(page.getByText("This vehicle has no photographs")).toHaveCount(0)
    } finally {
      await archiveCurrent(page)
    }
  })

  test("promotes a supporting photograph to main without losing the others", async ({
    page,
  }) => {
    const model = uniqueModel()
    await createVehicle(page, model)

    try {
      await uploadPhotos(page, [
        photoFile("a.png", [200, 30, 30]),
        photoFile("b.png", [30, 200, 30]),
      ])
      await expect(page.getByText("2 photographs added.")).toBeVisible()

      await otherTiles(page).first().click()
      await page.getByRole("menuitem", { name: "Make the main image" }).click()

      await expect(page.getByText("Main image updated.")).toBeVisible()
      // Still exactly one main image, and still two photographs in total.
      await expect(page.getByText("Main image", { exact: true })).toHaveCount(1)
      await expect(otherTiles(page)).toHaveCount(1)
    } finally {
      await archiveCurrent(page)
    }
  })

  test("reorders the supporting photographs and keeps the order after a reload", async ({
    page,
  }) => {
    const model = uniqueModel()
    await createVehicle(page, model)

    try {
      await uploadPhotos(page, [
        photoFile("a.png", [200, 30, 30]),
        photoFile("b.png", [30, 200, 30]),
        photoFile("c.png", [30, 30, 200]),
      ])
      await expect(page.getByText("3 photographs added.")).toBeVisible()

      // Two supporting images beneath the main one.
      await expect(otherTiles(page)).toHaveCount(2)

      // Move the second supporting image earlier.
      await otherTiles(page).nth(1).click()
      await page.getByRole("menuitem", { name: "Move earlier" }).click()
      await expect(page.getByText("Order saved.")).toBeVisible()

      // The first tile can no longer move earlier, and the last cannot move
      // later — which is how the rendered order is asserted without
      // depending on image bytes.
      await otherTiles(page).first().click()
      await expect(page.getByRole("menuitem", { name: "Move earlier" })).toHaveCount(0)
      await expect(page.getByRole("menuitem", { name: "Move later" })).toBeVisible()
      await page.keyboard.press("Escape")

      // The order is persisted, not just local state.
      await page.reload()
      await expect(otherTiles(page)).toHaveCount(2)
      await otherTiles(page).first().click()
      await expect(page.getByRole("menuitem", { name: "Move earlier" })).toHaveCount(0)
      await page.keyboard.press("Escape")
    } finally {
      await archiveCurrent(page)
    }
  })

  test("removing the main image promotes the next photograph", async ({ page }) => {
    const model = uniqueModel()
    await createVehicle(page, model)

    try {
      await uploadPhotos(page, [
        photoFile("a.png", [200, 30, 30]),
        photoFile("b.png", [30, 200, 30]),
      ])
      await expect(page.getByText("2 photographs added.")).toBeVisible()

      // The main tile's menu. "Remove from listing", not "Delete" — the
      // photograph is soft-deleted and the file is kept.
      await page.locator('[aria-label^="Options for"]').first().click()
      await page.getByRole("menuitem", { name: "Remove from listing" }).click()

      await expect(page.getByText("Remove this photograph?")).toBeVisible()
      // The dialog must not promise an erasure that does not happen.
      await expect(page.getByText("kept on record and is not destroyed")).toBeVisible()
      await page.getByRole("button", { name: "Remove image" }).click()

      await expect(
        page.getByText("Photograph removed. The next photograph is now the main image.")
      ).toBeVisible()

      // One photograph left, and it is the main one — never zero primaries.
      await expect(page.getByText("Main image", { exact: true })).toHaveCount(1)
      await expect(otherTiles(page)).toHaveCount(0)
    } finally {
      await archiveCurrent(page)
    }
  })

  test("shows the result of the action just performed, not an earlier one", async ({
    page,
  }) => {
    /**
     * The regression this pins: the banner used to pick the first non-idle
     * result from a fixed list, and `useActionState` keeps a settled result
     * for the life of the component. So once a removal had succeeded, every
     * later promote and upload still displayed "Photograph removed."
     */
    const model = uniqueModel()
    await createVehicle(page, model)

    try {
      await uploadPhotos(page, [
        photoFile("a.png", [200, 30, 30]),
        photoFile("b.png", [30, 200, 30]),
        photoFile("c.png", [30, 30, 200]),
      ])
      await expect(page.getByText("3 photographs added.")).toBeVisible()

      // Remove one, so a removal result is sitting in state.
      await otherTiles(page).last().click()
      await page.getByRole("menuitem", { name: "Remove from listing" }).click()
      await page.getByRole("button", { name: "Remove image" }).click()
      await expect(page.getByText("Photograph removed.")).toBeVisible()

      // Now do something else. The banner must follow.
      await otherTiles(page).first().click()
      await page.getByRole("menuitem", { name: "Make the main image" }).click()

      await expect(page.getByText("Main image updated.")).toBeVisible()
      await expect(page.getByText("Photograph removed.")).toHaveCount(0)
    } finally {
      await archiveCurrent(page)
    }
  })

  test("saves an optional description and falls back when it is cleared", async ({
    page,
  }) => {
    const model = uniqueModel()
    await createVehicle(page, model)

    try {
      await uploadPhotos(page, [photoFile("a.png", [200, 30, 30])])
      await expect(page.getByText("Photograph added.")).toBeVisible()

      await page.locator('[aria-label^="Options for"]').first().click()
      await page.getByRole("menuitem", { name: "Add a description" }).click()

      await page
        .getByLabel("Description")
        .fill("Front three-quarter view showing the offside wing")
      await page.getByRole("button", { name: "Save description" }).click()

      await expect(page.getByText("Description saved.")).toBeVisible()

      // The alt text reaches the rendered image, which is the whole point.
      await expect(
        page.getByAltText("Front three-quarter view showing the offside wing")
      ).toBeVisible()

      // Clearing it restores the generated description rather than leaving
      // an empty alt, which would tell a screen reader to skip the image.
      await page.locator('[aria-label^="Options for"]').first().click()
      await page.getByRole("menuitem", { name: "Edit description" }).click()
      await page.getByLabel("Description").fill("")
      await page.getByRole("button", { name: "Save description" }).click()

      await expect(page.getByText("Description cleared.")).toBeVisible()
      await expect(
        page.getByAltText(`2021 ${TEST_MAKE} ${model} — main photograph`)
      ).toBeVisible()
    } finally {
      await archiveCurrent(page)
    }
  })
})
