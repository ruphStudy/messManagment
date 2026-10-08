-- AlterTable
ALTER TABLE "messes" ADD COLUMN     "breakfastEnd" VARCHAR(5) NOT NULL DEFAULT '09:30',
ADD COLUMN     "breakfastStart" VARCHAR(5) NOT NULL DEFAULT '07:30',
ADD COLUMN     "dinnerEnd" VARCHAR(5) NOT NULL DEFAULT '21:30',
ADD COLUMN     "dinnerStart" VARCHAR(5) NOT NULL DEFAULT '19:30',
ADD COLUMN     "lunchEnd" VARCHAR(5) NOT NULL DEFAULT '14:30',
ADD COLUMN     "lunchStart" VARCHAR(5) NOT NULL DEFAULT '12:00';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- Serving windows must be valid HH:mm with start before end (HH:mm compares correctly as text).
ALTER TABLE "messes" ADD CONSTRAINT "messes_serving_times_check" CHECK (
  "breakfastStart" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND "breakfastEnd" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND "breakfastStart" < "breakfastEnd" AND
  "lunchStart" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND "lunchEnd" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND "lunchStart" < "lunchEnd" AND
  "dinnerStart" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND "dinnerEnd" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND "dinnerStart" < "dinnerEnd"
);
