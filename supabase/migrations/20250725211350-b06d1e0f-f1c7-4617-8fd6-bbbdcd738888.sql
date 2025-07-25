-- Add weight_unit column to carrier_configs table
ALTER TABLE public.carrier_configs 
ADD COLUMN weight_unit text DEFAULT 'lbs' CHECK (weight_unit IN ('lbs', 'oz'));