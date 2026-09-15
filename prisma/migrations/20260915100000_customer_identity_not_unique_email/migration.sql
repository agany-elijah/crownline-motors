-- Customer identity is now the combination of full name, email, phone and
-- WhatsApp (see src/lib/quotes/customer-identity.ts). Two different people
-- may legitimately share an email address — a family or office inbox — so
-- Customer.email can no longer be unique.
--
-- ── Non-destructive ───────────────────────────────────────────────────
-- No row is changed or removed. Dropping a unique index only relaxes a rule;
-- every existing row already satisfies the ordinary index that replaces it,
-- which keeps email lookups (admin search, related-customer panel) indexed.
-- The WhatsApp index serves the same related-customer lookup.
DROP INDEX "Customer_email_key";

CREATE INDEX "Customer_whatsapp_idx" ON "Customer"("whatsapp");

CREATE INDEX "Customer_email_idx" ON "Customer"("email");
