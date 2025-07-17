-- Add account grouping and service configuration tables

-- Add group support to carrier_configs
ALTER TABLE public.carrier_configs 
ADD COLUMN account_group text,
ADD COLUMN enabled_services jsonb DEFAULT '[]'::jsonb;

-- Create indexes for better performance
CREATE INDEX idx_carrier_configs_account_group ON public.carrier_configs(account_group);
CREATE INDEX idx_carrier_configs_enabled_services ON public.carrier_configs USING gin(enabled_services);

-- Add constraint to ensure enabled_services is an array
ALTER TABLE public.carrier_configs 
ADD CONSTRAINT check_enabled_services_is_array 
CHECK (jsonb_typeof(enabled_services) = 'array');

-- Update existing accounts to have all services enabled by default
UPDATE public.carrier_configs 
SET enabled_services = (
  SELECT jsonb_agg(service_code)
  FROM carrier_services 
  WHERE carrier_type = carrier_configs.carrier_type
)
WHERE enabled_services = '[]'::jsonb OR enabled_services IS NULL;