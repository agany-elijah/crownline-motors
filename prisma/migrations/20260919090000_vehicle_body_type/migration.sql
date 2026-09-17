-- A vehicle's body type (sedan, SUV, pickup…), for browsing the inventory by
-- category. Additive: the column is nullable, so every existing listing keeps
-- its data and simply has no body type until an operator sets one.

-- CreateEnum
CREATE TYPE "VehicleBodyType" AS ENUM ('SEDAN', 'HATCHBACK', 'SUV', 'PICKUP', 'VAN', 'MINIBUS', 'WAGON', 'COUPE', 'CONVERTIBLE', 'TRUCK');

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN "bodyType" "VehicleBodyType";

-- CreateIndex
CREATE INDEX "Vehicle_status_bodyType_idx" ON "Vehicle"("status", "bodyType");
