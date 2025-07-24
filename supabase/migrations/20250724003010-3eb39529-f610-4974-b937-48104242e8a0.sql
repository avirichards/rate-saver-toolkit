-- Remove the constraint that prevents negative total savings
-- Users should be able to see when recommended rates are actually more expensive
ALTER TABLE shipping_analyses 
DROP CONSTRAINT IF EXISTS check_total_savings_non_negative;