-- CreateTable
CREATE TABLE "daily_menus" (
    "id" UUID NOT NULL,
    "messId" UUID NOT NULL,
    "menuDate" DATE NOT NULL,
    "breakfastItems" TEXT[],
    "lunchItems" TEXT[],
    "dinnerItems" TEXT[],
    "breakfastAvailable" BOOLEAN NOT NULL DEFAULT true,
    "lunchAvailable" BOOLEAN NOT NULL DEFAULT true,
    "dinnerAvailable" BOOLEAN NOT NULL DEFAULT true,
    "breakfastNote" VARCHAR(200),
    "lunchNote" VARCHAR(200),
    "dinnerNote" VARCHAR(200),
    "generalNote" VARCHAR(300),
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_menus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "daily_menus_messId_isPublished_menuDate_idx" ON "daily_menus"("messId", "isPublished", "menuDate");

-- CreateIndex
CREATE UNIQUE INDEX "daily_menus_messId_menuDate_key" ON "daily_menus"("messId", "menuDate");

-- AddForeignKey
ALTER TABLE "daily_menus" ADD CONSTRAINT "daily_menus_messId_fkey" FOREIGN KEY ("messId") REFERENCES "messes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
