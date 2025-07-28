-- Add weight_unit column to rate_card_rates table for service-specific weight units
ALTER TABLE rate_card_rates 
ADD COLUMN weight_unit text NOT NULL DEFAULT 'lbs';

-- Add comment for clarity
COMMENT ON COLUMN rate_card_rates.weight_unit IS 'Weight unit for this specific service rate card (lbs or oz)';