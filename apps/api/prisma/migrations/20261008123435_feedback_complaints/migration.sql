-- CreateEnum
CREATE TYPE "FeedbackType" AS ENUM ('MEAL', 'GENERAL');

-- CreateEnum
CREATE TYPE "ComplaintCategory" AS ENUM ('FOOD_QUALITY', 'QUANTITY', 'CLEANLINESS', 'WRONG_OR_MISSING_ITEM', 'STAFF_BEHAVIOUR', 'PAYMENT', 'QR_ATTENDANCE', 'MENU', 'OTHER');

-- CreateEnum
CREATE TYPE "ComplaintStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED');

-- CreateEnum
CREATE TYPE "MessageAuthor" AS ENUM ('STUDENT', 'MESS');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'COMPLAINT_UPDATED';
ALTER TYPE "NotificationType" ADD VALUE 'COMPLAINT_CREATED';

-- CreateTable
CREATE TABLE "feedback" (
    "id" UUID NOT NULL,
    "messId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "type" "FeedbackType" NOT NULL,
    "attendanceId" UUID,
    "feedbackDate" DATE NOT NULL,
    "mealType" "MealType",
    "overallRating" INTEGER,
    "tasteRating" INTEGER,
    "qualityRating" INTEGER,
    "quantityRating" INTEGER,
    "cleanlinessRating" INTEGER,
    "comment" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complaints" (
    "id" UUID NOT NULL,
    "messId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "category" "ComplaintCategory" NOT NULL,
    "description" VARCHAR(1000) NOT NULL,
    "status" "ComplaintStatus" NOT NULL DEFAULT 'OPEN',
    "attachmentId" UUID,
    "idempotencyKey" VARCHAR(64),
    "inProgressAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "complaints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complaint_messages" (
    "id" UUID NOT NULL,
    "complaintId" UUID NOT NULL,
    "authorId" UUID,
    "author" "MessageAuthor" NOT NULL,
    "message" VARCHAR(1000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "complaint_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stored_files" (
    "id" UUID NOT NULL,
    "messId" UUID NOT NULL,
    "uploadedById" UUID NOT NULL,
    "storageKey" VARCHAR(100) NOT NULL,
    "mimeType" VARCHAR(40) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stored_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "feedback_attendanceId_key" ON "feedback"("attendanceId");

-- CreateIndex
CREATE INDEX "feedback_messId_feedbackDate_idx" ON "feedback"("messId", "feedbackDate");

-- CreateIndex
CREATE INDEX "feedback_messId_type_feedbackDate_idx" ON "feedback"("messId", "type", "feedbackDate");

-- CreateIndex
CREATE INDEX "feedback_studentId_feedbackDate_idx" ON "feedback"("studentId", "feedbackDate");

-- CreateIndex
CREATE UNIQUE INDEX "complaints_attachmentId_key" ON "complaints"("attachmentId");

-- CreateIndex
CREATE INDEX "complaints_messId_status_createdAt_idx" ON "complaints"("messId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "complaints_messId_category_createdAt_idx" ON "complaints"("messId", "category", "createdAt");

-- CreateIndex
CREATE INDEX "complaints_studentId_createdAt_idx" ON "complaints"("studentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "complaints_studentId_idempotencyKey_key" ON "complaints"("studentId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "complaint_messages_complaintId_createdAt_idx" ON "complaint_messages"("complaintId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "stored_files_storageKey_key" ON "stored_files"("storageKey");

-- CreateIndex
CREATE INDEX "stored_files_messId_idx" ON "stored_files"("messId");

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_messId_fkey" FOREIGN KEY ("messId") REFERENCES "messes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "mess_students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "meal_attendance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_messId_fkey" FOREIGN KEY ("messId") REFERENCES "messes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "mess_students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "stored_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_messages" ADD CONSTRAINT "complaint_messages_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "complaints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_messages" ADD CONSTRAINT "complaint_messages_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stored_files" ADD CONSTRAINT "stored_files_messId_fkey" FOREIGN KEY ("messId") REFERENCES "messes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stored_files" ADD CONSTRAINT "stored_files_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
