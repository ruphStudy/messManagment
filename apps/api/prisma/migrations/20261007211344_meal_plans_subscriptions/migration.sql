-- CreateEnum
CREATE TYPE "MealPlanStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "PlanDurationType" AS ENUM ('DAYS', 'MONTHS');

-- CreateEnum
CREATE TYPE "SubscriptionKind" AS ENUM ('NEW', 'RENEWAL', 'PLAN_CHANGE');

-- CreateTable
CREATE TABLE "meal_plans" (
    "id" UUID NOT NULL,
    "messId" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "description" VARCHAR(300),
    "pricePaise" INTEGER NOT NULL,
    "breakfastIncluded" BOOLEAN NOT NULL DEFAULT false,
    "lunchIncluded" BOOLEAN NOT NULL DEFAULT false,
    "dinnerIncluded" BOOLEAN NOT NULL DEFAULT false,
    "durationType" "PlanDurationType" NOT NULL,
    "durationValue" INTEGER NOT NULL,
    "mealCredits" INTEGER,
    "status" "MealPlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meal_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_subscriptions" (
    "id" UUID NOT NULL,
    "messId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "mealPlanId" UUID,
    "kind" "SubscriptionKind" NOT NULL DEFAULT 'NEW',
    "planName" VARCHAR(80) NOT NULL,
    "planPricePaise" INTEGER NOT NULL,
    "breakfastIncluded" BOOLEAN NOT NULL,
    "lunchIncluded" BOOLEAN NOT NULL,
    "dinnerIncluded" BOOLEAN NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "totalMealCredits" INTEGER,
    "remainingMealCredits" INTEGER,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "meal_plans_messId_status_idx" ON "meal_plans"("messId", "status");

-- CreateIndex
CREATE INDEX "student_subscriptions_messId_endDate_idx" ON "student_subscriptions"("messId", "endDate");

-- CreateIndex
CREATE INDEX "student_subscriptions_messId_startDate_idx" ON "student_subscriptions"("messId", "startDate");

-- CreateIndex
CREATE INDEX "student_subscriptions_studentId_startDate_idx" ON "student_subscriptions"("studentId", "startDate");

-- CreateIndex
CREATE INDEX "student_subscriptions_mealPlanId_idx" ON "student_subscriptions"("mealPlanId");

-- AddForeignKey
ALTER TABLE "meal_plans" ADD CONSTRAINT "meal_plans_messId_fkey" FOREIGN KEY ("messId") REFERENCES "messes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_subscriptions" ADD CONSTRAINT "student_subscriptions_messId_fkey" FOREIGN KEY ("messId") REFERENCES "messes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_subscriptions" ADD CONSTRAINT "student_subscriptions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "mess_students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_subscriptions" ADD CONSTRAINT "student_subscriptions_mealPlanId_fkey" FOREIGN KEY ("mealPlanId") REFERENCES "meal_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
