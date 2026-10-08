-- activeMarker mirrors status (makes the unique key mean "one active pause per meal").
ALTER TABLE "meal_pauses"
  ADD CONSTRAINT "meal_pauses_marker_check" CHECK (
    ("status" = 'ACTIVE' AND "activeMarker" IS TRUE AND "cancelledAt" IS NULL)
    OR ("status" = 'CANCELLED' AND "activeMarker" IS NULL AND "cancelledAt" IS NOT NULL)
  );

ALTER TABLE "messes"
  ADD CONSTRAINT "messes_pause_cutoff_check" CHECK (
    "breakfastPauseCutoff" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    AND "lunchPauseCutoff" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    AND "dinnerPauseCutoff" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  );
