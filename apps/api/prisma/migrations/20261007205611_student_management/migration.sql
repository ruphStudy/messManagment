-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "mess_students" (
    "id" UUID NOT NULL,
    "messId" UUID NOT NULL,
    "userId" UUID,
    "firstName" VARCHAR(50) NOT NULL,
    "lastName" VARCHAR(50),
    "mobile" VARCHAR(15) NOT NULL,
    "email" VARCHAR(120),
    "collegeName" VARCHAR(120),
    "courseName" VARCHAR(120),
    "hostelOrPg" VARCHAR(120),
    "localAddress" VARCHAR(200),
    "parentName" VARCHAR(50),
    "parentMobile" VARCHAR(15),
    "emergencyContactName" VARCHAR(50),
    "emergencyContactMobile" VARCHAR(15),
    "joiningDate" DATE NOT NULL,
    "status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" VARCHAR(1000),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mess_students_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mess_students_messId_status_createdAt_idx" ON "mess_students"("messId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "mess_students_mobile_idx" ON "mess_students"("mobile");

-- CreateIndex
CREATE INDEX "mess_students_userId_idx" ON "mess_students"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "mess_students_messId_mobile_key" ON "mess_students"("messId", "mobile");

-- CreateIndex
CREATE UNIQUE INDEX "mess_students_messId_userId_key" ON "mess_students"("messId", "userId");

-- AddForeignKey
ALTER TABLE "mess_students" ADD CONSTRAINT "mess_students_messId_fkey" FOREIGN KEY ("messId") REFERENCES "messes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mess_students" ADD CONSTRAINT "mess_students_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
