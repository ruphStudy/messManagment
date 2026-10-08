-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'UPI', 'BANK_TRANSFER', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('RECORDED', 'REVERSED');

-- AlterTable
ALTER TABLE "messes" ADD COLUMN     "receiptSequence" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "student_subscriptions" ADD COLUMN     "amountPaidPaise" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "messId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "subscriptionId" UUID NOT NULL,
    "receiptNumber" VARCHAR(30) NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "paymentDate" DATE NOT NULL,
    "referenceNumber" VARCHAR(60),
    "note" VARCHAR(200),
    "status" "PaymentStatus" NOT NULL DEFAULT 'RECORDED',
    "balanceAfterPaise" INTEGER NOT NULL,
    "idempotencyKey" VARCHAR(64),
    "recordedById" UUID,
    "reversedAt" TIMESTAMP(3),
    "reversedById" UUID,
    "reversalReason" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payments_messId_paymentDate_idx" ON "payments"("messId", "paymentDate");

-- CreateIndex
CREATE INDEX "payments_messId_status_paymentDate_idx" ON "payments"("messId", "status", "paymentDate");

-- CreateIndex
CREATE INDEX "payments_studentId_paymentDate_idx" ON "payments"("studentId", "paymentDate");

-- CreateIndex
CREATE INDEX "payments_subscriptionId_idx" ON "payments"("subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_messId_receiptNumber_key" ON "payments"("messId", "receiptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "payments_messId_idempotencyKey_key" ON "payments"("messId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_messId_fkey" FOREIGN KEY ("messId") REFERENCES "messes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "mess_students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "student_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_reversedById_fkey" FOREIGN KEY ("reversedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
