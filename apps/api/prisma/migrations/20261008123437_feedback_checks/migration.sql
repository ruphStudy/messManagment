-- Ratings are whole numbers 1–5 everywhere.
ALTER TABLE "feedback"
  ADD CONSTRAINT "feedback_ratings_check" CHECK (
    ("overallRating" IS NULL OR "overallRating" BETWEEN 1 AND 5)
    AND ("tasteRating" IS NULL OR "tasteRating" BETWEEN 1 AND 5)
    AND ("qualityRating" IS NULL OR "qualityRating" BETWEEN 1 AND 5)
    AND ("quantityRating" IS NULL OR "quantityRating" BETWEEN 1 AND 5)
    AND ("cleanlinessRating" IS NULL OR "cleanlinessRating" BETWEEN 1 AND 5)
  ),
  -- Meal feedback: tied to a meal with an overall rating. General: no meal link, and never empty.
  ADD CONSTRAINT "feedback_shape_check" CHECK (
    ("type" = 'MEAL' AND "mealType" IS NOT NULL AND "overallRating" IS NOT NULL)
    OR ("type" = 'GENERAL' AND "attendanceId" IS NULL AND "mealType" IS NULL AND ("overallRating" IS NOT NULL OR "comment" IS NOT NULL))
  );

ALTER TABLE "complaints"
  ADD CONSTRAINT "complaints_description_check" CHECK (btrim("description") <> ''),
  ADD CONSTRAINT "complaints_resolved_check" CHECK (("status" = 'RESOLVED') = ("resolvedAt" IS NOT NULL));

ALTER TABLE "complaint_messages"
  ADD CONSTRAINT "complaint_messages_text_check" CHECK (btrim("message") <> '');

ALTER TABLE "stored_files"
  ADD CONSTRAINT "stored_files_size_check" CHECK ("sizeBytes" > 0 AND "sizeBytes" <= 5242880);
