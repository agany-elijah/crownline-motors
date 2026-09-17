-- The expected delivery window shown on Track My Order: the existing
-- "estimatedDeliveryDate" becomes its start, and this column its end.
-- Additive — every existing order keeps its single-day estimate.

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "estimatedDeliveryLatest" TIMESTAMP(3);

-- A window needs a start, and cannot end before it begins.
ALTER TABLE "Order" ADD CONSTRAINT "Order_delivery_window_check" CHECK (
  "estimatedDeliveryLatest" IS NULL
  OR ("estimatedDeliveryDate" IS NOT NULL AND "estimatedDeliveryLatest" >= "estimatedDeliveryDate")
);
