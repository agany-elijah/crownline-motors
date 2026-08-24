-- CreateEnum
CREATE TYPE "MilestoneStatus" AS ENUM ('PENDING', 'DUE', 'PARTIALLY_PAID', 'PAID');

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "milestoneId" TEXT;

-- CreateTable
CREATE TABLE "BusinessSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "whatsappNumber" TEXT NOT NULL,
    "defaultInitialPercentage" DECIMAL(5,2) NOT NULL DEFAULT 50.00,
    "defaultMombasaPercentage" DECIMAL(5,2) NOT NULL DEFAULT 25.00,
    "defaultFinalPercentage" DECIMAL(5,2) NOT NULL DEFAULT 25.00,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentMilestone" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL,
    "amountDue" DECIMAL(12,2) NOT NULL,
    "status" "MilestoneStatus" NOT NULL DEFAULT 'PENDING',
    "triggerStatus" "TrackingStatus",
    "becameDueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentMilestone_orderId_idx" ON "PaymentMilestone"("orderId");

-- CreateIndex
CREATE INDEX "PaymentMilestone_status_idx" ON "PaymentMilestone"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMilestone_orderId_sequence_key" ON "PaymentMilestone"("orderId", "sequence");

-- CreateIndex
CREATE INDEX "Payment_milestoneId_idx" ON "Payment"("milestoneId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "PaymentMilestone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentMilestone" ADD CONSTRAINT "PaymentMilestone_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
