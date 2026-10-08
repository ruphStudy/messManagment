-- CreateEnum
CREATE TYPE "PauseStatus" AS ENUM ('ACTIVE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PauseSource" AS ENUM ('STUDENT', 'MESS');

-- AlterTable
ALTER TABLE "messes" ADD COLUMN     "breakfastPauseCutoff" VARCHAR(5) NOT NULL DEFAULT '06:00',
ADD COLUMN     "dinnerPauseCutoff" VARCHAR(5) NOT NULL DEFAULT '16:00',
ADD COLUMN     "lunchPauseCutoff" VARCHAR(5) NOT NULL DEFAULT '09:00';

-- CreateTable
CREATE TABLE "meal_pauses" (
    "id" UUID NOT NULL,
    "messId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "subscriptionId" UUID NOT NULL,
    "pauseDate" DATE NOT NULL,
    "mealType" "MealType" NOT NULL,
    "status" "PauseStatus" NOT NULL DEFAULT 'ACTIVE',
    "activeMarker" BOOLEAN DEFAULT true,
    "source" "PauseSource" NOT NULL,
    "reason" VARCHAR(120),
    "createdById" UUID,
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meal_pauses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "meal_pauses_messId_pauseDate_mealType_idx" ON "meal_pauses"("messId", "pauseDate", "mealType");

-- CreateIndex
CREATE INDEX "meal_pauses_studentId_pauseDate_idx" ON "meal_pauses"("studentId", "pauseDate");

-- CreateIndex
CREATE UNIQUE INDEX "meal_pauses_messId_studentId_pauseDate_mealType_activeMarke_key" ON "meal_pauses"("messId", "studentId", "pauseDate", "mealType", "activeMarker");

-- AddForeignKey
ALTER TABLE "meal_pauses" ADD CONSTRAINT "meal_pauses_messId_fkey" FOREIGN KEY ("messId") REFERENCES "messes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_pauses" ADD CONSTRAINT "meal_pauses_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "mess_students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_pauses" ADD CONSTRAINT "meal_pauses_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "student_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_pauses" ADD CONSTRAINT "meal_pauses_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_pauses" ADD CONSTRAINT "meal_pauses_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
