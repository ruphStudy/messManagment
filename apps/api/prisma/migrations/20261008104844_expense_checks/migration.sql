ALTER TABLE "expenses"
  ADD CONSTRAINT "expenses_amount_check" CHECK ("amountPaise" > 0 AND "amountPaise" <= 100000000),
  ADD CONSTRAINT "expenses_reversal_check" CHECK (
    ("status" = 'RECORDED' AND "reversedAt" IS NULL) OR ("status" = 'REVERSED' AND "reversedAt" IS NOT NULL)
  );

ALTER TABLE "expense_categories"
  ADD CONSTRAINT "expense_categories_normalized_check" CHECK ("normalizedName" = lower(btrim("name")) AND "normalizedName" <> '');
