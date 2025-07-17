-- Create multi-carrier configuration table
CREATE TABLE public.carrier_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  carrier_type TEXT NOT NULL CHECK (carrier_type IN ('ups', 'fedex', 'dhl', 'usps')),
  account_name TEXT NOT NULL, -- User-friendly name like "UPS West Coast Account"
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_sandbox BOOLEAN NOT NULL DEFAULT true,
  
  -- UPS specific fields
  ups_client_id TEXT,
  ups_client_secret TEXT,
  ups_account_number TEXT,
  
  -- FedEx specific fields (for future)
  fedex_account_number TEXT,
  fedex_meter_number TEXT,
  fedex_key TEXT,
  fedex_password TEXT,
  
  -- DHL specific fields (for future)
  dhl_account_number TEXT,
  dhl_site_id TEXT,
  dhl_password TEXT,
  
  -- USPS specific fields (for future)
  usps_user_id TEXT,
  usps_password TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure unique account names per user
  UNIQUE(user_id, account_name)
);

-- Enable RLS
ALTER TABLE public.carrier_configs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own carrier configs" 
ON public.carrier_configs 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own carrier configs" 
ON public.carrier_configs 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own carrier configs" 
ON public.carrier_configs 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own carrier configs" 
ON public.carrier_configs 
FOR DELETE 
USING (auth.uid() = user_id);

-- Update service_mappings to be carrier-specific
ALTER TABLE public.service_mappings 
ADD COLUMN IF NOT EXISTS carrier_type TEXT DEFAULT 'ups';

-- Update shipping_analyses to track which carriers were used
ALTER TABLE public.shipping_analyses 
ADD COLUMN IF NOT EXISTS carrier_configs_used JSONB DEFAULT '[]'::jsonb;

-- Create carrier services table for standardized service codes
CREATE TABLE public.carrier_services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  carrier_type TEXT NOT NULL CHECK (carrier_type IN ('ups', 'fedex', 'dhl', 'usps')),
  service_code TEXT NOT NULL,
  service_name TEXT NOT NULL,
  description TEXT,
  is_international BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(carrier_type, service_code)
);

-- Enable RLS for carrier_services (read-only for authenticated users)
ALTER TABLE public.carrier_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view carrier services" 
ON public.carrier_services 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- Add trigger for automatic timestamp updates on carrier_configs
CREATE TRIGGER update_carrier_configs_updated_at
BEFORE UPDATE ON public.carrier_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert UPS services from existing ups_services table
INSERT INTO public.carrier_services (carrier_type, service_code, service_name, description, is_international, is_active)
SELECT 
  'ups' as carrier_type,
  service_code,
  service_name,
  description,
  is_international,
  is_active
FROM public.ups_services
ON CONFLICT (carrier_type, service_code) DO NOTHING;

-- Migrate existing UPS configs to new carrier_configs table
INSERT INTO public.carrier_configs (
  user_id, 
  carrier_type, 
  account_name, 
  is_active, 
  is_sandbox,
  ups_client_id, 
  ups_client_secret, 
  ups_account_number,
  created_at,
  updated_at
)
SELECT 
  user_id,
  'ups' as carrier_type,
  CASE 
    WHEN account_number IS NOT NULL AND account_number != '' 
    THEN 'UPS Account (' || LEFT(account_number, 6) || '...)'
    ELSE 'UPS Account'
  END as account_name,
  is_active,
  is_sandbox,
  client_id,
  client_secret,
  account_number,
  created_at,
  updated_at
FROM public.ups_configs
WHERE is_active = true
ON CONFLICT (user_id, account_name) DO NOTHING;