-- CreateEnum
CREATE TYPE "MealType" AS ENUM ('breakfast', 'lunch', 'dinner');

-- CreateEnum
CREATE TYPE "AttendanceSource" AS ENUM ('QR', 'MANUAL');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('SERVED', 'REVERSED');

-- CreateTable
CREATE TABLE "meal_attendance" (
    "id" UUID NOT NULL,
    "messId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "subscriptionId" UUID NOT NULL,
    "attendanceDate" DATE NOT NULL,
    "mealType" "MealType" NOT NULL,
    "source" "AttendanceSource" NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'SERVED',
    "servedMarker" BOOLEAN DEFAULT true,
    "creditDeducted" BOOLEAN NOT NULL DEFAULT false,
    "servedById" UUID,
    "note" VARCHAR(200),
    "reversedAt" TIMESTAMP(3),
    "reversedById" UUID,
    "reversalReason" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meal_attendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "meal_attendance_messId_attendanceDate_mealType_idx" ON "meal_attendance"("messId", "attendanceDate", "mealType");

-- CreateIndex
CREATE INDEX "meal_attendance_studentId_attendanceDate_idx" ON "meal_attendance"("studentId", "attendanceDate");

-- CreateIndex
CREATE INDEX "meal_attendance_subscriptionId_idx" ON "meal_attendance"("subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "meal_attendance_messId_studentId_attendanceDate_mealType_se_key" ON "meal_attendance"("messId", "studentId", "attendanceDate", "mealType", "servedMarker");

-- AddForeignKey
ALTER TABLE "meal_attendance" ADD CONSTRAINT "meal_attendance_messId_fkey" FOREIGN KEY ("messId") REFERENCES "messes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_attendance" ADD CONSTRAINT "meal_attendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "mess_students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_attendance" ADD CONSTRAINT "meal_attendance_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "student_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_attendance" ADD CONSTRAINT "meal_attendance_servedById_fkey" FOREIGN KEY ("servedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_attendance" ADD CONSTRAINT "meal_attendance_reversedById_fkey" FOREIGN KEY ("reversedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
