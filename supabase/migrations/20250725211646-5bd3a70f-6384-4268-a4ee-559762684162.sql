-- Update carrier_type check constraint to include Amazon
ALTER TABLE public.carrier_configs 
DROP CONSTRAINT carrier_configs_carrier_type_check;

ALTER TABLE public.carrier_configs 
ADD CONSTRAINT carrier_configs_carrier_type_check 
CHECK (carrier_type = ANY (ARRAY['ups'::text, 'fedex'::text, 'dhl'::text, 'usps'::text, 'amazon'::text]));