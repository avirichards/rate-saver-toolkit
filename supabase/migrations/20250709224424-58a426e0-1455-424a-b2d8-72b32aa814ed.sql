-- Create tables for UPS API integration

-- Table to store UPS API configurations
CREATE TABLE public.ups_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  client_id TEXT NOT NULL,
  client_secret TEXT NOT NULL,
  account_number TEXT,
  is_sandbox BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table to store rate quotes
CREATE TABLE public.rate_quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  shipment_data JSONB NOT NULL,
  ups_response JSONB,
  rates JSONB NOT NULL,
  service_codes TEXT[] NOT NULL DEFAULT '{}',
  total_cost DECIMAL(10,2),
  currency TEXT NOT NULL DEFAULT 'USD',
  quote_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'used')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table to store shipping history and analysis
CREATE TABLE public.shipping_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  original_data JSONB NOT NULL,
  ups_quotes JSONB,
  savings_analysis JSONB,
  recommendations JSONB,
  total_shipments INTEGER NOT NULL DEFAULT 0,
  total_savings DECIMAL(10,2),
  analysis_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table to cache UPS service information
CREATE TABLE public.ups_services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_code TEXT NOT NULL UNIQUE,
  service_name TEXT NOT NULL,
  description TEXT,
  is_international BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert common UPS service codes
INSERT INTO public.ups_services (service_code, service_name, description, is_international) VALUES
('01', 'UPS Next Day Air', 'Next business day delivery by 10:30 AM', false),
('02', 'UPS 2nd Day Air', 'Second business day delivery', false),
('03', 'UPS Ground', 'Standard ground delivery', false),
('12', 'UPS 3 Day Select', 'Third business day delivery', false),
('13', 'UPS Next Day Air Saver', 'Next business day delivery by end of day', false),
('14', 'UPS Express Early', 'Next business day delivery by 8:00 AM', false),
('11', 'UPS Standard', 'International standard delivery', true),
('07', 'UPS Worldwide Express', 'International express delivery', true),
('08', 'UPS Worldwide Expedited', 'International expedited delivery', true),
('65', 'UPS Worldwide Saver', 'International saver delivery', true);

-- Enable Row Level Security
ALTER TABLE public.ups_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ups_services ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for ups_configs
CREATE POLICY "Users can view their own UPS configs" 
ON public.ups_configs 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own UPS configs" 
ON public.ups_configs 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own UPS configs" 
ON public.ups_configs 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own UPS configs" 
ON public.ups_configs 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create RLS policies for rate_quotes
CREATE POLICY "Users can view their own rate quotes" 
ON public.rate_quotes 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own rate quotes" 
ON public.rate_quotes 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own rate quotes" 
ON public.rate_quotes 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create RLS policies for shipping_analyses
CREATE POLICY "Users can view their own shipping analyses" 
ON public.shipping_analyses 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own shipping analyses" 
ON public.shipping_analyses 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own shipping analyses" 
ON public.shipping_analyses 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create policy for ups_services (read-only for all authenticated users)
CREATE POLICY "Authenticated users can view UPS services" 
ON public.ups_services 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_ups_configs_updated_at
  BEFORE UPDATE ON public.ups_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_shipping_analyses_updated_at
  BEFORE UPDATE ON public.shipping_analyses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_ups_configs_user_id ON public.ups_configs(user_id);
CREATE INDEX idx_rate_quotes_user_id ON public.rate_quotes(user_id);
CREATE INDEX idx_rate_quotes_quote_date ON public.rate_quotes(quote_date);
CREATE INDEX idx_shipping_analyses_user_id ON public.shipping_analyses(user_id);
CREATE INDEX idx_shipping_analyses_status ON public.shipping_analyses(status);
CREATE INDEX idx_ups_services_code ON public.ups_services(service_code);