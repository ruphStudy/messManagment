-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PLATFORM_ADMIN', 'MESS_OWNER', 'MESS_MANAGER', 'MESS_STAFF', 'STUDENT');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "MessStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'INVITED', 'REMOVED');

-- CreateEnum
CREATE TYPE "MessType" AS ENUM ('STUDENT_MESS', 'PG_HOSTEL', 'TIFFIN_SERVICE', 'OTHER');

-- CreateEnum
CREATE TYPE "FoodType" AS ENUM ('VEG', 'VEG_NON_VEG');

-- CreateEnum
CREATE TYPE "ClientType" AS ENUM ('WEB', 'MOBILE');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "firstName" VARCHAR(50) NOT NULL,
    "lastName" VARCHAR(50),
    "mobile" VARCHAR(15) NOT NULL,
    "email" VARCHAR(120),
    "passwordHash" TEXT,
    "role" "Role" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "mobileVerified" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messes" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "mobile" VARCHAR(15) NOT NULL,
    "email" VARCHAR(120),
    "messType" "MessType" NOT NULL DEFAULT 'STUDENT_MESS',
    "foodType" "FoodType" NOT NULL DEFAULT 'VEG',
    "address" VARCHAR(200) NOT NULL,
    "city" VARCHAR(60) NOT NULL,
    "state" VARCHAR(60) NOT NULL,
    "pincode" VARCHAR(6) NOT NULL,
    "breakfastAvailable" BOOLEAN NOT NULL DEFAULT false,
    "lunchAvailable" BOOLEAN NOT NULL DEFAULT true,
    "dinnerAvailable" BOOLEAN NOT NULL DEFAULT true,
    "openingTime" VARCHAR(5),
    "closingTime" VARCHAR(5),
    "logoUrl" TEXT,
    "status" "MessStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mess_memberships" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "messId" UUID NOT NULL,
    "role" "Role" NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mess_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "previousTokenHash" TEXT,
    "rotatedAt" TIMESTAMP(3),
    "persistent" BOOLEAN NOT NULL DEFAULT true,
    "clientType" "ClientType" NOT NULL,
    "userAgent" VARCHAR(255),
    "ipAddress" VARCHAR(64),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_challenges" (
    "id" UUID NOT NULL,
    "mobile" VARCHAR(15) NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_mobile_key" ON "users"("mobile");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "messes_ownerId_idx" ON "messes"("ownerId");

-- CreateIndex
CREATE INDEX "mess_memberships_messId_role_idx" ON "mess_memberships"("messId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "mess_memberships_userId_messId_key" ON "mess_memberships"("userId", "messId");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "otp_challenges_mobile_createdAt_idx" ON "otp_challenges"("mobile", "createdAt");

-- AddForeignKey
ALTER TABLE "messes" ADD CONSTRAINT "messes_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mess_memberships" ADD CONSTRAINT "mess_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mess_memberships" ADD CONSTRAINT "mess_memberships_messId_fkey" FOREIGN KEY ("messId") REFERENCES "messes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
