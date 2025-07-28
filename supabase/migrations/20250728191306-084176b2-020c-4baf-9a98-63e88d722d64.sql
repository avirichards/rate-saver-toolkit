-- Create rate_card_rates table for storing uploaded CSV rate data
CREATE TABLE IF NOT EXISTS public.rate_card_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  carrier_config_id UUID NOT NULL,
  weight_break NUMERIC NOT NULL,
  rate_amount NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  weight_unit TEXT NOT NULL DEFAULT 'lbs',
  service_code TEXT NOT NULL,
  service_name TEXT,
  zone TEXT
);

-- Enable Row Level Security
ALTER TABLE public.rate_card_rates ENABLE ROW LEVEL SECURITY;

-- Create policies for rate_card_rates
CREATE POLICY "Users can view rates for their carrier configs" 
ON public.rate_card_rates 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM carrier_configs 
  WHERE carrier_configs.id = rate_card_rates.carrier_config_id 
  AND carrier_configs.user_id = auth.uid()
));

CREATE POLICY "Users can insert rates for their carrier configs" 
ON public.rate_card_rates 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM carrier_configs 
  WHERE carrier_configs.id = rate_card_rates.carrier_config_id 
  AND carrier_configs.user_id = auth.uid()
));

CREATE POLICY "Users can update rates for their carrier configs" 
ON public.rate_card_rates 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM carrier_configs 
  WHERE carrier_configs.id = rate_card_rates.carrier_config_id 
  AND carrier_configs.user_id = auth.uid()
));

CREATE POLICY "Users can delete rates for their carrier configs" 
ON public.rate_card_rates 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM carrier_configs 
  WHERE carrier_configs.id = rate_card_rates.carrier_config_id 
  AND carrier_configs.user_id = auth.uid()
));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_rate_card_rates_updated_at
BEFORE UPDATE ON public.rate_card_rates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();