-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('PAYMENT_DUE', 'SUBSCRIPTION_EXPIRING', 'SUBSCRIPTION_EXPIRED', 'MENU_CHANGED', 'MEAL_PAUSE_CREATED', 'MEAL_PAUSE_CANCELLED', 'MANUAL_REMINDER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "PushStatus" AS ENUM ('NOT_SENT', 'PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "PushPlatform" AS ENUM ('IOS', 'ANDROID');

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "messId" UUID,
    "userId" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" VARCHAR(80) NOT NULL,
    "body" VARCHAR(300) NOT NULL,
    "data" JSONB,
    "dedupeKey" VARCHAR(150),
    "pushStatus" "PushStatus" NOT NULL DEFAULT 'NOT_SENT',
    "createdById" UUID,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_devices" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "platform" "PushPlatform" NOT NULL,
    "pushToken" VARCHAR(200) NOT NULL,
    "deviceLabel" VARCHAR(80),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "userId" UUID NOT NULL,
    "paymentDueEnabled" BOOLEAN NOT NULL DEFAULT true,
    "subscriptionExpiryEnabled" BOOLEAN NOT NULL DEFAULT true,
    "menuUpdatesEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pauseUpdatesEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_userId_readAt_idx" ON "notifications"("userId", "readAt");

-- CreateIndex
CREATE INDEX "notifications_messId_type_createdAt_idx" ON "notifications"("messId", "type", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_userId_dedupeKey_key" ON "notifications"("userId", "dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "push_devices_pushToken_key" ON "push_devices"("pushToken");

-- CreateIndex
CREATE INDEX "push_devices_userId_isActive_idx" ON "push_devices"("userId", "isActive");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_messId_fkey" FOREIGN KEY ("messId") REFERENCES "messes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_devices" ADD CONSTRAINT "push_devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
