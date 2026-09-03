/**
 * Provisions the Supabase Storage buckets this application expects.
 *
 *   npm run storage:setup
 *
 * Idempotent: an existing bucket is reported and left alone, never
 * reconfigured or emptied. Run it against a new environment before the first
 * photograph is uploaded — an upload into a missing bucket fails with a
 * message that reads like an application fault when it is really a
 * provisioning one.
 *
 * ── Why a script and not a migration ──────────────────────────────────
 * Buckets live in Supabase's `storage` schema, not in ours. Prisma neither
 * models nor migrates that schema, and pointing a Prisma migration at it
 * would put a table we do not own under our migration history. This is
 * infrastructure setup, in the same category as scripts/create-admin.ts.
 *
 * ── Why the vehicle bucket is public ──────────────────────────────────
 * "Public" is about reads. Vehicle photographs are marketing material shown
 * to anonymous visitors, indexed by search engines and cached by the CDN;
 * signed URLs would expire mid-page and buy nothing.
 *
 * No write policy is created for any browser session, so a public read does
 * not imply a public write: every upload goes through a Server Action that
 * has already checked `vehicle:write` and uses the secret key server-side.
 *
 * Payment receipts (Stage 22) are the opposite case and must get their own
 * PRIVATE bucket read through short-lived signed URLs. Do not add them here
 * as public.
 *
 * ── Node version ──────────────────────────────────────────────────────
 * @supabase/supabase-js requires Node 22+; on Node 20 it needs
 * --experimental-websocket, which the npm script passes.
 */

import { config } from "dotenv"
import { existsSync } from "node:fs"

// Matches prisma.config.ts: load .env.local when it exists (local dev), and
// fall through to real environment variables otherwise (Codespaces, CI).
if (existsSync(".env.local")) {
  config({ path: ".env.local" })
}

import { createClient as createSupabaseClient } from "@supabase/supabase-js"

import {
  ACCEPTED_PHOTO_MIME_TYPES,
  MAX_PHOTO_BYTES,
  VEHICLE_PHOTO_BUCKET,
} from "../src/lib/constants/vehicle-photo-options"

interface BucketSpec {
  id: string
  /** Public read. See the note above — it says nothing about writes. */
  public: boolean
  allowedMimeTypes: string[]
  fileSizeLimit: number
  purpose: string
}

/**
 * The MIME allowlist and size ceiling are declared on the bucket as well as
 * enforced in the action. Belt and braces on purpose: the action's check is
 * the one that produces a good error message, and this one holds even if a
 * future code path forgets to call it.
 */
const BUCKETS: BucketSpec[] = [
  {
    id: VEHICLE_PHOTO_BUCKET,
    public: true,
    allowedMimeTypes: [...ACCEPTED_PHOTO_MIME_TYPES],
    fileSizeLimit: MAX_PHOTO_BYTES,
    purpose: "Vehicle listing photography (public read, server-only write)",
  },
]

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secretKey = process.env.SUPABASE_SECRET_KEY

  if (!url || !secretKey) {
    console.error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must both be set.\n" +
        "Copy .env.example to .env.local and fill them in, or set them as Codespaces secrets."
    )
    process.exit(1)
  }

  const supabase = createSupabaseClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: existing, error: listError } = await supabase.storage.listBuckets()

  if (listError) {
    console.error(`Could not list buckets: ${listError.message}`)
    process.exit(1)
  }

  const existingById = new Map(existing.map((bucket) => [bucket.id, bucket]))

  for (const spec of BUCKETS) {
    const current = existingById.get(spec.id)

    if (current) {
      /**
       * An existing bucket is verified, not assumed.
       *
       * This used to print "left unchanged" and move on, which reported
       * success for a bucket that might have been created before the MIME
       * allowlist and size ceiling existed — or by hand, through the
       * dashboard, with neither. Those two settings are the storage-side
       * half of upload validation (SECURITY.MD §21), so a bucket missing
       * them is a hole that provisioning was supposed to close and instead
       * claimed it had.
       *
       * Drift is reported and repaired rather than only warned about: the
       * declared settings are the intended ones, and `updateBucket` changes
       * configuration only — it never touches the objects already stored.
       */
      const drift = describeBucketDrift(current, spec)

      if (drift.length === 0) {
        console.log(`• ${spec.id} — already exists and is configured correctly`)
        continue
      }

      console.warn(`! ${spec.id} — configuration drift:`)
      for (const line of drift) console.warn(`    ${line}`)

      const { error } = await supabase.storage.updateBucket(spec.id, {
        public: spec.public,
        allowedMimeTypes: spec.allowedMimeTypes,
        fileSizeLimit: spec.fileSizeLimit,
      })

      if (error) {
        console.error(`✗ ${spec.id} — could not repair: ${error.message}`)
        process.exit(1)
      }

      console.log(`✓ ${spec.id} — configuration repaired (objects untouched)`)
      continue
    }

    const { error } = await supabase.storage.createBucket(spec.id, {
      public: spec.public,
      allowedMimeTypes: spec.allowedMimeTypes,
      fileSizeLimit: spec.fileSizeLimit,
    })

    if (error) {
      console.error(`✗ ${spec.id} — ${error.message}`)
      process.exit(1)
    }

    console.log(`✓ ${spec.id} — created (${spec.purpose})`)
  }

  console.log("\nStorage is ready.")
}

/**
 * How an existing bucket differs from what this script declares.
 *
 * Returns one human-readable line per difference, empty when it matches.
 *
 * The MIME comparison is order-insensitive: Supabase returns the list in
 * whatever order it stored, and a reordered but identical allowlist is not
 * drift. `fileSizeLimit` comes back as a string on some API versions and a
 * number on others, so it is normalised before comparing rather than being
 * reported as drift on every run.
 */
function describeBucketDrift(
  current: { public: boolean; allowed_mime_types?: string[] | null; file_size_limit?: number | string | null },
  spec: BucketSpec
): string[] {
  const drift: string[] = []

  if (current.public !== spec.public) {
    drift.push(
      `public read is ${current.public}, expected ${spec.public}`
    )
  }

  const currentTypes = [...(current.allowed_mime_types ?? [])].sort()
  const expectedTypes = [...spec.allowedMimeTypes].sort()

  if (currentTypes.join(",") !== expectedTypes.join(",")) {
    drift.push(
      `accepted types are ${currentTypes.length > 0 ? currentTypes.join(", ") : "unrestricted"}, expected ${expectedTypes.join(", ")}`
    )
  }

  const currentLimit =
    current.file_size_limit === null || current.file_size_limit === undefined
      ? null
      : Number(current.file_size_limit)

  if (currentLimit !== spec.fileSizeLimit) {
    drift.push(
      `size limit is ${currentLimit === null ? "unrestricted" : `${currentLimit} bytes`}, expected ${spec.fileSizeLimit} bytes`
    )
  }

  return drift
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
