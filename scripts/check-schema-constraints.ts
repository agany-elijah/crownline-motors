/**
 * Verifies the database invariants that exist only in SQL.
 *
 *   npm run db:check
 *
 * ── Why this script exists ────────────────────────────────────────────
 * Most of this platform's rules are testable in Vitest because they are
 * TypeScript: reference numbers, fitment matching, status transitions, Zod
 * schemas. A handful are not, because they are CHECK constraints and foreign
 * key actions — and those are precisely the rules that must hold no matter
 * which code path writes the row.
 *
 * They are also invisible to Prisma. `prisma/schema.prisma` cannot express a
 * cross-column CHECK, so the constraints live only in
 * 20260904090000_add_spare_parts_domain/migration.sql. That is safe (the
 * migrate engine does not model them and therefore never drops one), but it
 * means nothing in the repository would notice if a database were restored
 * from a backup taken before them, or provisioned by a path that skipped that
 * migration. A part could then be published QUOTE_ONLY with a price on it, or
 * an order line could sell nothing at all, and the first symptom would be a
 * customer seeing it.
 *
 * ── Safe to run anywhere, including production ────────────────────────
 * Everything happens inside a single transaction that ends in ROLLBACK, and
 * every fixture it needs it creates itself — it reads no existing row and
 * depends on no seed data, so it behaves identically against a fresh database
 * and a live one. Failures are rolled back to a savepoint so one broken
 * constraint does not abort the rest of the run.
 *
 * ── Why raw SQL and not Prisma ────────────────────────────────────────
 * The point is to test the database, not the client. Prisma would reject some
 * of these rows before they reached Postgres, which would prove the schema
 * types are right and say nothing about whether the constraint is installed.
 */

import { config } from "dotenv"
import { existsSync } from "node:fs"

// Matches prisma.config.ts and the other scripts: load .env.local when it
// exists (local dev), and fall through to real environment variables
// otherwise (Codespaces, CI).
if (existsSync(".env.local")) {
  config({ path: ".env.local" })
}

import { Client } from "pg"

/**
 * The session (direct) connection, not the transaction pooler.
 *
 * This script holds one transaction open across many statements and uses
 * savepoints. That is exactly the workload PgBouncer's transaction mode is
 * not for.
 */
const connectionString = process.env.DIRECT_URL

if (!connectionString) {
  throw new Error("DIRECT_URL is not set.")
}

const client = new Client({ connectionString })

let passed = 0
const failures: string[] = []

function record(label: string, ok: boolean, detail = "") {
  if (ok) {
    passed += 1
    console.log(`  ✓ ${label}`)
  } else {
    failures.push(label)
    console.log(`  ✗ FAIL  ${label}${detail ? ` — ${detail}` : ""}`)
  }
}

/** Runs `sql` on a savepoint so a failure cannot poison the transaction. */
async function attempt(sql: string, params: unknown[] = []): Promise<string | null> {
  await client.query("SAVEPOINT probe")

  try {
    await client.query(sql, params)
    await client.query("RELEASE SAVEPOINT probe")
    return null
  } catch (error) {
    await client.query("ROLLBACK TO SAVEPOINT probe")
    return error instanceof Error ? error.message.split("\n")[0] : String(error)
  }
}

/** The statement must be refused, and refused by an integrity rule. */
async function mustReject(label: string, sql: string, params: unknown[] = []) {
  const error = await attempt(sql, params)

  if (error === null) {
    record(label, false, "the database accepted it")
    return
  }

  const isIntegrityFailure =
    /violates check constraint|violates foreign key constraint|duplicate key value/.test(error)

  record(label, isIntegrityFailure, isIntegrityFailure ? "" : `wrong reason: ${error}`)
}

/** The statement must be accepted. */
async function mustAccept(label: string, sql: string, params: unknown[] = []) {
  const error = await attempt(sql, params)
  record(label, error === null, error ?? "")
}

function section(title: string) {
  console.log(`\n── ${title} ──`)
}

/**
 * Fixtures, created inside the transaction.
 *
 * The admin profile mirrors a Supabase auth UID in real life; here it is a
 * literal, because nothing about a foreign key cares where the id came from
 * and this row never survives the rollback.
 */
async function createFixtures() {
  await client.query(`
    INSERT INTO "SparePartCategory" (id, slug, name, "updatedAt")
    VALUES ('chk-cat', 'chk-brakes', 'Check Brakes', NOW())
  `)
  await client.query(`
    INSERT INTO "Vehicle" (
      id, "referenceNumber", slug, make, model, year, price, "mileageKm", "fuelType",
      transmission, "engineSize", "driveType", "exteriorColor", "interiorColor",
      "countryOfOrigin", "currentLocation", description, "updatedAt"
    ) VALUES (
      'chk-veh', 'CHK-V-0001', 'chk-vehicle', 'Toyota', 'Harrier', 2021, 22500.00, 42000,
      'PETROL', 'AUTOMATIC', '2.0L', 'FWD', 'Black', 'Black', 'JAPAN', 'Juba',
      'Fixture for schema constraint checks.', NOW()
    )
  `)
  await client.query(`
    INSERT INTO "AdminProfile" (id, email, "displayName", "updatedAt")
    VALUES ('chk-admin', 'schema-check@example.invalid', 'Schema Check', NOW())
  `)
  await client.query(`
    INSERT INTO "Customer" (id, "fullName", phone, "updatedAt")
    VALUES ('chk-cust', 'Schema Check', '+211000000000', NOW())
  `)
}

/** A publishable part, so each probe below only varies what it is about. */
async function createPart(id: string, columns = "", values = "") {
  await client.query(
    `INSERT INTO "SparePart" (
       id, "referenceNumber", slug, name, "categoryId", description,
       "pricingMode", price, "stockQuantity"${columns}, "updatedAt"
     ) VALUES ($1, $2, $3, 'Front Brake Pads', 'chk-cat', 'Fixture.',
       'FIXED', 120.00, 4${values}, NOW())`,
    [id, `CHK-SP-${id}`, `chk-slug-${id}`]
  )
}

async function main() {
  await client.connect()
  await client.query("BEGIN")

  try {
    await createFixtures()

    section("A part is either priced or quoted, never both or neither")
    await mustAccept(
      "FIXED with a price",
      `INSERT INTO "SparePart" (id,"referenceNumber",slug,name,"categoryId",description,"pricingMode",price,"updatedAt")
       VALUES ('a1','CHK-A1','chk-a1','P','chk-cat','d','FIXED',99.00,NOW())`
    )
    await mustReject(
      "FIXED without a price",
      `INSERT INTO "SparePart" (id,"referenceNumber",slug,name,"categoryId",description,"pricingMode",price,"updatedAt")
       VALUES ('a2','CHK-A2','chk-a2','P','chk-cat','d','FIXED',NULL,NOW())`
    )
    await mustAccept(
      "QUOTE_ONLY without a price",
      `INSERT INTO "SparePart" (id,"referenceNumber",slug,name,"categoryId",description,"pricingMode",price,"updatedAt")
       VALUES ('a3','CHK-A3','chk-a3','P','chk-cat','d','QUOTE_ONLY',NULL,NOW())`
    )
    await mustReject(
      "QUOTE_ONLY carrying an 'indicative' price",
      `INSERT INTO "SparePart" (id,"referenceNumber",slug,name,"categoryId",description,"pricingMode",price,"updatedAt")
       VALUES ('a4','CHK-A4','chk-a4','P','chk-cat','d','QUOTE_ONLY',50.00,NOW())`
    )
    await mustReject(
      "a negative price",
      `INSERT INTO "SparePart" (id,"referenceNumber",slug,name,"categoryId",description,"pricingMode",price,"updatedAt")
       VALUES ('a5','CHK-A5','chk-a5','P','chk-cat','d','FIXED',-1.00,NOW())`
    )

    section("Stock cannot go negative, so a part cannot be oversold")
    await createPart("b1")
    const within = await client.query(
      `UPDATE "SparePart" SET "stockQuantity" = "stockQuantity" - 3
        WHERE id = 'b1' AND "stockQuantity" >= 3`
    )
    record("a guarded decrement within stock succeeds", within.rowCount === 1)

    const beyond = await client.query(
      `UPDATE "SparePart" SET "stockQuantity" = "stockQuantity" - 3
        WHERE id = 'b1' AND "stockQuantity" >= 3`
    )
    record(
      "a guarded decrement beyond stock touches no row — the caller learns it lost the race",
      beyond.rowCount === 0
    )
    await mustReject(
      "an unguarded decrement past zero is refused outright",
      `UPDATE "SparePart" SET "stockQuantity" = "stockQuantity" - 99 WHERE id = 'b1'`
    )

    section("A fitment year range must run forwards")
    await createPart("c1")
    await mustAccept(
      "2020–2023",
      `INSERT INTO "SparePartCompatibility" (id,"sparePartId",make,model,"yearFrom","yearTo","updatedAt")
       VALUES ('c-a','c1','Toyota','Harrier',2020,2023,NOW())`
    )
    await mustAccept(
      "a single year",
      `INSERT INTO "SparePartCompatibility" (id,"sparePartId",make,"yearFrom","yearTo","updatedAt")
       VALUES ('c-b','c1','Toyota',2021,2021,NOW())`
    )
    await mustAccept(
      "an open-ended range",
      `INSERT INTO "SparePartCompatibility" (id,"sparePartId",make,"yearFrom","yearTo","updatedAt")
       VALUES ('c-c','c1','Toyota',2015,NULL,NOW())`
    )
    await mustReject(
      "a reversed range, which would silently match nothing",
      `INSERT INTO "SparePartCompatibility" (id,"sparePartId",make,"yearFrom","yearTo","updatedAt")
       VALUES ('c-d','c1','Toyota',2023,2020,NOW())`
    )

    section("An order line sells exactly one product")
    await createPart("d1")
    await client.query(`
      INSERT INTO "Quote" (id,"quoteNumber","customerId",type,"updatedAt")
      VALUES ('chk-quote','CHK-Q-0001','chk-cust','SPARE_PART',NOW())
    `)
    await client.query(`
      INSERT INTO "Order" (id,"orderNumber","quoteId","customerId",type,status,"totalAmount","updatedAt")
      VALUES ('chk-order','CHK-O-0001','chk-quote','chk-cust','SPARE_PART','AWAITING_PAYMENT',240.00,NOW())
    `)
    record("an order can be typed SPARE_PART and opened AWAITING_PAYMENT", true)

    await mustAccept(
      "a line naming a spare part",
      `INSERT INTO "OrderItem" (id,"orderId","sparePartId",description,"unitPrice",quantity,"lineTotal")
       VALUES ('d-a','chk-order','d1','Pads',120.00,2,240.00)`
    )
    await mustAccept(
      "a line naming a vehicle",
      `INSERT INTO "OrderItem" (id,"orderId","vehicleId",description,"unitPrice",quantity,"lineTotal")
       VALUES ('d-b','chk-order','chk-veh','Harrier',22500.00,1,22500.00)`
    )
    await mustReject(
      "a line naming neither",
      `INSERT INTO "OrderItem" (id,"orderId",description,"unitPrice",quantity,"lineTotal")
       VALUES ('d-c','chk-order','Nothing',1.00,1,1.00)`
    )
    await mustReject(
      "a line naming both",
      `INSERT INTO "OrderItem" (id,"orderId","vehicleId","sparePartId",description,"unitPrice",quantity,"lineTotal")
       VALUES ('d-d','chk-order','chk-veh','d1','Both',1.00,1,1.00)`
    )
    await mustReject(
      "a zero-quantity line",
      `INSERT INTO "OrderItem" (id,"orderId","sparePartId",description,"unitPrice",quantity,"lineTotal")
       VALUES ('d-e','chk-order','d1','Pads',120.00,0,0.00)`
    )

    section("A quote line may name at most one product, and legitimately none")
    await mustAccept(
      "a line naming a spare part",
      `INSERT INTO "QuoteItem" (id,"quoteId","sparePartId",description,quantity,"updatedAt")
       VALUES ('e-a','chk-quote','d1','Pads',2,NOW())`
    )
    await mustAccept(
      "a line naming nothing in the catalogue",
      `INSERT INTO "QuoteItem" (id,"quoteId",description,quantity,"updatedAt")
       VALUES ('e-b','chk-quote','Rear bumper for a 2018 Prado',1,NOW())`
    )
    await mustAccept(
      "a quotation spanning a vehicle and a part",
      `INSERT INTO "QuoteItem" (id,"quoteId","vehicleId",description,quantity,"updatedAt")
       VALUES ('e-c','chk-quote','chk-veh','Harrier',1,NOW())`
    )
    await mustReject(
      "one line naming both",
      `INSERT INTO "QuoteItem" (id,"quoteId","vehicleId","sparePartId",description,quantity,"updatedAt")
       VALUES ('e-d','chk-quote','chk-veh','d1','Both',1,NOW())`
    )
    await mustReject(
      "a zero-quantity line",
      `INSERT INTO "QuoteItem" (id,"quoteId",description,quantity,"updatedAt")
       VALUES ('e-e','chk-quote','X',0,NOW())`
    )
    await mustReject(
      "a negative quoted price",
      `INSERT INTO "QuoteItem" (id,"quoteId",description,quantity,"quotedUnitPrice","updatedAt")
       VALUES ('e-f','chk-quote','X',1,-5.00,NOW())`
    )

    section("A quotation's extras and fees stay honest")
    await mustAccept(
      "an accessory line that names nothing in the catalogue",
      `INSERT INTO "QuoteItem" (id,"quoteId",kind,description,quantity,"quotedUnitPrice","updatedAt")
       VALUES ('q-a','chk-quote','ACCESSORY','Window tint',1,150.00,NOW())`
    )
    await mustReject(
      "an accessory line claiming to be a vehicle",
      `INSERT INTO "QuoteItem" (id,"quoteId",kind,"vehicleId",description,quantity,"updatedAt")
       VALUES ('q-b','chk-quote','ACCESSORY','chk-veh','Harrier',1,NOW())`
    )
    await mustAccept(
      "fees that are unquoted or real figures",
      `UPDATE "Quote" SET "shippingCost" = 1800.00, "clearingCost" = NULL, "importDuty" = 0 WHERE id = 'chk-quote'`
    )
    await mustReject(
      "a negative shipping cost",
      `UPDATE "Quote" SET "shippingCost" = -1.00 WHERE id = 'chk-quote'`
    )
    await mustReject(
      "a negative import duty on an order",
      `UPDATE "Order" SET "importDuty" = -5.00 WHERE id = 'chk-order'`
    )
    await mustReject(
      "an order line reserving more stock than it sold",
      `UPDATE "OrderItem" SET "stockReserved" = 3 WHERE id = 'd-a'`
    )
    await mustAccept(
      "an order line reserving what it sold",
      `UPDATE "OrderItem" SET "stockReserved" = 2 WHERE id = 'd-a'`
    )
    await mustReject(
      "a quotation validity of zero days",
      `UPDATE "BusinessSettings" SET "quoteValidityDays" = 0`
    )

    section("Nothing that has touched money can be hard-deleted")
    await mustReject(
      "a part that has been ordered (Restrict)",
      `DELETE FROM "SparePart" WHERE id = 'd1'`
    )
    await mustAccept(
      "archiving it instead",
      `UPDATE "SparePart" SET status = 'ARCHIVED' WHERE id = 'd1'`
    )
    await mustReject(
      "a category still holding parts (Restrict)",
      `DELETE FROM "SparePartCategory" WHERE id = 'chk-cat'`
    )

    section("Dependents follow their parent")
    await createPart("f1")
    await client.query(
      `INSERT INTO "SparePartPhoto" (id,"sparePartId","storagePath") VALUES ('f-photo','f1','f1/a.jpg')`
    )
    await client.query(
      `INSERT INTO "SparePartCompatibility" (id,"sparePartId",make,"updatedAt") VALUES ('f-fit','f1','Toyota',NOW())`
    )
    await client.query(
      `UPDATE "Quote" SET "linkedSparePartId" = 'f1' WHERE id = 'chk-quote'`
    )
    await client.query(`DELETE FROM "SparePart" WHERE id = 'f1'`)

    const photos = await client.query(
      `SELECT count(*)::int AS n FROM "SparePartPhoto" WHERE "sparePartId" = 'f1'`
    )
    const fitment = await client.query(
      `SELECT count(*)::int AS n FROM "SparePartCompatibility" WHERE "sparePartId" = 'f1'`
    )
    const quote = await client.query(
      `SELECT "linkedSparePartId" AS linked FROM "Quote" WHERE id = 'chk-quote'`
    )
    record("photographs cascade with the part", photos.rows[0].n === 0)
    record("fitment rules cascade with the part", fitment.rows[0].n === 0)
    record(
      "a quote loses only its provenance link, never the enquiry itself (SetNull)",
      quote.rows[0].linked === null
    )

    section("The parts workflow reuses the vehicle side's infrastructure")
    await mustAccept(
      "one 100% milestone on a parts order",
      `INSERT INTO "PaymentMilestone" (id,"orderId",sequence,label,percentage,"amountDue",status,"updatedAt")
       VALUES ('g-m','chk-order',1,'Payment in full (100%)',100.00,240.00,'DUE',NOW())`
    )
    await mustAccept(
      "a payment recorded against it in the shared ledger",
      `INSERT INTO "Payment" (id,"orderId",amount,method,status,"milestoneId","updatedAt")
       VALUES ('g-p','chk-order',240.00,'MOBILE_MONEY','CONFIRMED','g-m',NOW())`
    )

    const balance = await client.query(`
      SELECT o."totalAmount" - COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'CONFIRMED'), 0) AS balance
        FROM "Order" o LEFT JOIN "Payment" p ON p."orderId" = o.id
       WHERE o.id = 'chk-order'
       GROUP BY o."totalAmount"
    `)
    record(
      "the balance derives live from confirmed payments, not a stored column",
      Number(balance.rows[0].balance) === 0,
      `got ${balance.rows[0].balance}`
    )

    await mustAccept(
      "a SPARE_PART shipment opening at ORDER_CONFIRMED",
      `INSERT INTO "Shipment" (id,"trackingNumber","orderId","shipmentType","currentStatus","updatedAt")
       VALUES ('g-s','CHK-2026-000001','chk-order','SPARE_PART','ORDER_CONFIRMED',NOW())`
    )

    for (const status of [
      "PROCESSING",
      "PACKED",
      "DISPATCHED",
      "IN_TRANSIT",
      "OUT_FOR_DELIVERY",
      "DELIVERED",
    ]) {
      await mustAccept(
        `a ${status} tracking event`,
        `INSERT INTO "TrackingEvent" (id,"shipmentId",status,"createdByAdminId")
         VALUES ($1,'g-s',$2::"TrackingStatus",'chk-admin')`,
        [`g-e-${status}`, status]
      )
    }

    section("The objects the catalogue depends on are installed")
    const expectedConstraints = [
      "BusinessSettings_quote_validity_check",
      "Order_import_duty_non_negative_check",
      "OrderItem_exactly_one_product_check",
      "OrderItem_quantity_positive_check",
      "OrderItem_stock_reserved_check",
      "Quote_costs_non_negative_check",
      "QuoteItem_accessory_no_product_check",
      "QuoteItem_at_most_one_product_check",
      "QuoteItem_price_non_negative_check",
      "QuoteItem_quantity_positive_check",
      "SparePart_price_non_negative_check",
      "SparePart_pricing_mode_check",
      "SparePart_stock_non_negative_check",
      "SparePartCompatibility_year_range_check",
    ]
    const installed = new Set(
      (
        await client.query<{ conname: string }>(
          `SELECT conname FROM pg_constraint WHERE contype = 'c'`
        )
      ).rows.map((row) => row.conname)
    )
    for (const name of expectedConstraints) {
      record(`constraint ${name}`, installed.has(name))
    }

    /**
     * The search indexes must be GIN over trigrams, not B-trees. A B-tree on
     * these columns is not merely slower — the planner cannot use it at all
     * for the ILIKE '%term%' the search boxes compile to, so it would sit
     * there looking like an index while every keystroke scanned the table.
     */
    const trigram = await client.query<{ table: string; index: string }>(`
      SELECT t.relname AS table, i.relname AS index
        FROM pg_index x
        JOIN pg_class i ON i.oid = x.indexrelid
        JOIN pg_class t ON t.oid = x.indrelid
        JOIN pg_am am ON am.oid = i.relam
       WHERE am.amname = 'gin' AND t.relname IN ('SparePart', 'SparePartCompatibility')
    `)
    const trigramNames = new Set(trigram.rows.map((row) => row.index))
    for (const name of [
      "SparePart_name_idx",
      "SparePart_oemPartNumber_idx",
      "SparePart_referenceNumber_idx",
      "SparePartCompatibility_make_idx",
      "SparePartCompatibility_model_idx",
    ]) {
      record(`trigram index ${name}`, trigramNames.has(name))
    }
  } finally {
    // Always. Nothing this script writes is meant to survive it.
    await client.query("ROLLBACK")
    await client.end()
  }

  console.log(
    `\n${failures.length === 0 ? "✅" : "❌"}  ${passed} passed, ${failures.length} failed`
  )

  if (failures.length > 0) {
    console.error(`\nFailed checks:\n${failures.map((f) => `  - ${f}`).join("\n")}`)
    process.exit(1)
  }
}

main().catch((error) => {
  console.error("❌ Schema check failed to run:", error)
  process.exit(1)
})
