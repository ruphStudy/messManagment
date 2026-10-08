-- Money integrity guards.
ALTER TABLE "payments"
  ADD CONSTRAINT "payments_amount_check" CHECK ("amountPaise" > 0),
  ADD CONSTRAINT "payments_balance_check" CHECK ("balanceAfterPaise" >= 0),
  ADD CONSTRAINT "payments_reversal_check" CHECK (
    ("status" = 'RECORDED' AND "reversedAt" IS NULL) OR ("status" = 'REVERSED' AND "reversedAt" IS NOT NULL)
  );

-- Paid can never exceed the fee or go negative (overpayment is not supported).
ALTER TABLE "student_subscriptions"
  ADD CONSTRAINT "student_subscriptions_paid_check" CHECK ("amountPaidPaise" >= 0 AND "amountPaidPaise" <= "planPricePaise");
