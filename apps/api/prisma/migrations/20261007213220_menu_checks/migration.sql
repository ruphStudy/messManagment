-- Guard item counts (API also normalizes and validates; limit mirrors MENU_LIMITS.itemsPerMeal).
ALTER TABLE "daily_menus"
  ADD CONSTRAINT "daily_menus_items_check" CHECK (
    cardinality("breakfastItems") <= 15 AND cardinality("lunchItems") <= 15 AND cardinality("dinnerItems") <= 15
  );
