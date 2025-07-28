-- Create table for user custom service mappings (different name to avoid conflict)
CREATE TABLE public.custom_service_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  service_name TEXT NOT NULL,
  normalized_service_name TEXT NOT NULL,
  universal_category TEXT NOT NULL,
  confidence DECIMAL(3,2) NOT NULL DEFAULT 0.9,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, normalized_service_name)
);

-- Enable Row Level Security
ALTER TABLE public.custom_service_mappings ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own custom service mappings" 
ON public.custom_service_mappings 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own custom service mappings" 
ON public.custom_service_mappings 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own custom service mappings" 
ON public.custom_service_mappings 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own custom service mappings" 
ON public.custom_service_mappings 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create table for custom carrier service codes
CREATE TABLE public.custom_carrier_service_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  carrier_type TEXT NOT NULL,
  service_code TEXT NOT NULL,
  service_name TEXT NOT NULL,
  universal_category TEXT NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, carrier_type, service_code)
);

-- Enable Row Level Security
ALTER TABLE public.custom_carrier_service_codes ENABLE ROW LEVEL SECURITY;

-- Create policies for carrier service codes
CREATE POLICY "Users can view their own custom carrier service codes" 
ON public.custom_carrier_service_codes 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own custom carrier service codes" 
ON public.custom_carrier_service_codes 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own custom carrier service codes" 
ON public.custom_carrier_service_codes 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own custom carrier service codes" 
ON public.custom_carrier_service_codes 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates on custom_service_mappings
CREATE TRIGGER update_custom_service_mappings_updated_at
BEFORE UPDATE ON public.custom_service_mappings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for automatic timestamp updates on custom_carrier_service_codes
CREATE TRIGGER update_custom_carrier_service_codes_updated_at
BEFORE UPDATE ON public.custom_carrier_service_codes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_custom_service_mappings_user_id ON public.custom_service_mappings(user_id);
CREATE INDEX idx_custom_service_mappings_normalized_name ON public.custom_service_mappings(normalized_service_name);
CREATE INDEX idx_custom_carrier_service_codes_user_id ON public.custom_carrier_service_codes(user_id);
CREATE INDEX idx_custom_carrier_service_codes_carrier_type ON public.custom_carrier_service_codes(carrier_type);