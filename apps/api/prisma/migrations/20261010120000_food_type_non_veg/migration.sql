-- Add "Non-Veg only". Existing VEG / VEG_NON_VEG rows keep their meaning (no data change).
ALTER TYPE "FoodType" ADD VALUE 'NON_VEG' BEFORE 'VEG_NON_VEG';
