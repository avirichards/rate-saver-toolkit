-- Add rate card specific columns to carrier_configs table
ALTER TABLE public.carrier_configs 
ADD COLUMN IF NOT EXISTS is_rate_card boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS rate_card_filename text,
ADD COLUMN IF NOT EXISTS rate_card_uploaded_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS dimensional_divisor numeric DEFAULT 166,
ADD COLUMN IF NOT EXISTS fuel_surcharge_percent numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS fuel_auto_lookup boolean DEFAULT false;

-- Create rate_card_rates table for storing parsed rate data
CREATE TABLE IF NOT EXISTS public.rate_card_rates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  carrier_config_id uuid NOT NULL REFERENCES public.carrier_configs(id) ON DELETE CASCADE,
  service_code text NOT NULL,
  service_name text,
  zone text,
  weight_break numeric NOT NULL,
  rate_amount numeric NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rate_card_rates ENABLE ROW LEVEL SECURITY;

-- Create policies for rate_card_rates
CREATE POLICY "Users can view rates for their carrier configs" 
ON public.rate_card_rates 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.carrier_configs 
  WHERE carrier_configs.id = rate_card_rates.carrier_config_id 
  AND carrier_configs.user_id = auth.uid()
));

CREATE POLICY "Users can insert rates for their carrier configs" 
ON public.rate_card_rates 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.carrier_configs 
  WHERE carrier_configs.id = rate_card_rates.carrier_config_id 
  AND carrier_configs.user_id = auth.uid()
));

CREATE POLICY "Users can update rates for their carrier configs" 
ON public.rate_card_rates 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.carrier_configs 
  WHERE carrier_configs.id = rate_card_rates.carrier_config_id 
  AND carrier_configs.user_id = auth.uid()
));

CREATE POLICY "Users can delete rates for their carrier configs" 
ON public.rate_card_rates 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM public.carrier_configs 
  WHERE carrier_configs.id = rate_card_rates.carrier_config_id 
  AND carrier_configs.user_id = auth.uid()
));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_rate_card_rates_updated_at
BEFORE UPDATE ON public.rate_card_rates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_rate_card_rates_config_service_zone_weight 
ON public.rate_card_rates(carrier_config_id, service_code, zone, weight_break);

-- Create storage bucket for rate card files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('rate-cards', 'rate-cards', false)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for rate card files
CREATE POLICY "Users can upload their own rate cards" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'rate-cards' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own rate cards" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'rate-cards' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own rate cards" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'rate-cards' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own rate cards" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'rate-cards' AND auth.uid()::text = (storage.foldername(name))[1]);