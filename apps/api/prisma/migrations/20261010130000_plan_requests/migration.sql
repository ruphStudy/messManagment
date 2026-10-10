-- CreateEnum
CREATE TYPE "PlanRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "plan_requests" (
    "id" UUID NOT NULL,
    "messId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "mealPlanId" UUID NOT NULL,
    "status" "PlanRequestStatus" NOT NULL DEFAULT 'PENDING',
    "planName" VARCHAR(80) NOT NULL,
    "planPricePaise" INTEGER NOT NULL,
    "decidedById" UUID,
    "decidedAt" TIMESTAMP(3),
    "rejectReason" VARCHAR(200),
    "subscriptionId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "plan_requests_messId_status_createdAt_idx" ON "plan_requests"("messId", "status", "createdAt");
CREATE INDEX "plan_requests_studentId_createdAt_idx" ON "plan_requests"("studentId", "createdAt");
-- One open request per student (prevents duplicate taps / parallel requests).
CREATE UNIQUE INDEX "plan_requests_one_pending_per_student" ON "plan_requests"("studentId") WHERE "status" = 'PENDING';

-- AddForeignKey
ALTER TABLE "plan_requests" ADD CONSTRAINT "plan_requests_messId_fkey" FOREIGN KEY ("messId") REFERENCES "messes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "plan_requests" ADD CONSTRAINT "plan_requests_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "mess_students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "plan_requests" ADD CONSTRAINT "plan_requests_mealPlanId_fkey" FOREIGN KEY ("mealPlanId") REFERENCES "meal_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
