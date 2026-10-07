-- Integrity guards Prisma cannot express in the schema.
ALTER TABLE "meal_plans"
  ADD CONSTRAINT "meal_plans_price_check" CHECK ("pricePaise" >= 0),
  ADD CONSTRAINT "meal_plans_duration_check" CHECK ("durationValue" > 0),
  ADD CONSTRAINT "meal_plans_credits_check" CHECK ("mealCredits" IS NULL OR "mealCredits" > 0),
  ADD CONSTRAINT "meal_plans_meal_check" CHECK ("breakfastIncluded" OR "lunchIncluded" OR "dinnerIncluded");

ALTER TABLE "student_subscriptions"
  ADD CONSTRAINT "student_subscriptions_dates_check" CHECK ("endDate" >= "startDate"),
  ADD CONSTRAINT "student_subscriptions_credits_check" CHECK (
    ("totalMealCredits" IS NULL AND "remainingMealCredits" IS NULL)
    OR ("remainingMealCredits" >= 0 AND "remainingMealCredits" <= "totalMealCredits")
  );
