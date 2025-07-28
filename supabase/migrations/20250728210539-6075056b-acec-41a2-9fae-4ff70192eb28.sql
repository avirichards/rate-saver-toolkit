-- Create custom service mappings table
CREATE TABLE public.custom_service_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  service_name TEXT NOT NULL,
  normalized_service_name TEXT NOT NULL,
  universal_category TEXT NOT NULL,
  confidence NUMERIC NOT NULL DEFAULT 0.9,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create custom carrier service codes table
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
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.custom_service_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_carrier_service_codes ENABLE ROW LEVEL SECURITY;

-- Create policies for custom_service_mappings
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

-- Create policies for custom_carrier_service_codes
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

-- Add triggers for automatic timestamp updates
CREATE TRIGGER update_custom_service_mappings_updated_at
  BEFORE UPDATE ON public.custom_service_mappings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_custom_carrier_service_codes_updated_at
  BEFORE UPDATE ON public.custom_carrier_service_codes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();