-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('RECORDED', 'REVERSED');

-- CreateTable
CREATE TABLE "expense_categories" (
    "id" UUID NOT NULL,
    "messId" UUID NOT NULL,
    "name" VARCHAR(40) NOT NULL,
    "normalizedName" VARCHAR(40) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" UUID NOT NULL,
    "messId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "title" VARCHAR(80) NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "expenseDate" DATE NOT NULL,
    "paymentMethod" "PaymentMethod",
    "vendorName" VARCHAR(80),
    "referenceNumber" VARCHAR(60),
    "note" VARCHAR(200),
    "status" "ExpenseStatus" NOT NULL DEFAULT 'RECORDED',
    "recordedById" UUID,
    "reversedAt" TIMESTAMP(3),
    "reversedById" UUID,
    "reversalReason" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "expense_categories_messId_normalizedName_key" ON "expense_categories"("messId", "normalizedName");

-- CreateIndex
CREATE INDEX "expenses_messId_expenseDate_idx" ON "expenses"("messId", "expenseDate");

-- CreateIndex
CREATE INDEX "expenses_messId_categoryId_expenseDate_idx" ON "expenses"("messId", "categoryId", "expenseDate");

-- CreateIndex
CREATE INDEX "expenses_messId_status_expenseDate_idx" ON "expenses"("messId", "status", "expenseDate");

-- AddForeignKey
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_messId_fkey" FOREIGN KEY ("messId") REFERENCES "messes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_messId_fkey" FOREIGN KEY ("messId") REFERENCES "messes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "expense_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_reversedById_fkey" FOREIGN KEY ("reversedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
