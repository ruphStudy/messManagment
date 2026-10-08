-- servedMarker must mirror status so the unique key really means "one served row per meal".
ALTER TABLE "meal_attendance"
  ADD CONSTRAINT "meal_attendance_marker_check" CHECK (
    ("status" = 'SERVED' AND "servedMarker" IS TRUE AND "reversedAt" IS NULL)
    OR ("status" = 'REVERSED' AND "servedMarker" IS NULL AND "reversedAt" IS NOT NULL)
  );
