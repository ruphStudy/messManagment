-- MessMate SaaS subscriptions (separate from student meal plans/payments).
CREATE TYPE "PlatformSubscriptionStatus" AS ENUM ('PENDING_PAYMENT', 'TRIAL', 'ACTIVE', 'EXPIRED', 'SUSPENDED');
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'YEARLY');

CREATE TABLE "platform_subscriptions" (
    "id" UUID NOT NULL,
    "messId" UUID NOT NULL,
    "status" "PlatformSubscriptionStatus" NOT NULL,
    "planName" VARCHAR(80) NOT NULL,
    "billingCycle" "BillingCycle",
    "amountPaise" INTEGER NOT NULL DEFAULT 0,
    "startDate" DATE,
    "endDate" DATE,
    "trialStartDate" DATE,
    "trialEndDate" DATE,
    "paymentReference" VARCHAR(120),
    "notes" VARCHAR(300),
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "platform_subscriptions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "platform_subscriptions_messId_createdAt_idx" ON "platform_subscriptions"("messId", "createdAt");
ALTER TABLE "platform_subscriptions" ADD CONSTRAINT "platform_subscriptions_messId_fkey" FOREIGN KEY ("messId") REFERENCES "messes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Messes that existed before billing keep working: ACTIVE for one year (recorded, visible to admins).
-- Messes created after this migration start as PENDING_PAYMENT (set by the API).
-- Paid-first: every existing mess starts PENDING_PAYMENT (no free access) ...
INSERT INTO "platform_subscriptions" ("id", "messId", "status", "planName", "amountPaise", "notes", "updatedAt")
SELECT gen_random_uuid(), m."id", 'PENDING_PAYMENT', 'MessMate', 0, 'Billing launched — awaiting payment or trial', CURRENT_TIMESTAMP
FROM "messes" m;

-- ... except the seeded demo messes (owners 9000000001 / 9000000011), which stay usable for development.
-- Inclusive 1-year period: today .. today + 1 year - 1 day (dates in IST).
INSERT INTO "platform_subscriptions" ("id", "messId", "status", "planName", "billingCycle", "amountPaise", "startDate", "endDate", "notes", "createdAt", "updatedAt")
SELECT gen_random_uuid(), m."id", 'ACTIVE', 'Demo', 'YEARLY', 0,
       (now() AT TIME ZONE 'Asia/Kolkata')::date,
       ((now() AT TIME ZONE 'Asia/Kolkata')::date + INTERVAL '1 year' - INTERVAL '1 day')::date,
       'Seed demo mess', CURRENT_TIMESTAMP + INTERVAL '1 second', CURRENT_TIMESTAMP
FROM "messes" m JOIN "users" u ON u."id" = m."ownerId"
WHERE u."mobile" IN ('9000000001', '9000000011');
