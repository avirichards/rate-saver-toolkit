-- Create table for uploaded CSV files
CREATE TABLE public.csv_uploads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  detected_headers TEXT[] NOT NULL,
  row_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'uploaded',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.csv_uploads ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own CSV uploads" 
ON public.csv_uploads 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own CSV uploads" 
ON public.csv_uploads 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own CSV uploads" 
ON public.csv_uploads 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create table for column mappings
CREATE TABLE public.column_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  csv_upload_id UUID NOT NULL REFERENCES public.csv_uploads(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  csv_header TEXT NOT NULL,
  is_required BOOLEAN NOT NULL DEFAULT false,
  confidence_score NUMERIC(3,2) DEFAULT 0,
  is_auto_detected BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.column_mappings ENABLE ROW LEVEL SECURITY;

-- Create policies for column mappings
CREATE POLICY "Users can view mappings for their uploads" 
ON public.column_mappings 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.csv_uploads 
    WHERE id = column_mappings.csv_upload_id 
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert mappings for their uploads" 
ON public.column_mappings 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.csv_uploads 
    WHERE id = column_mappings.csv_upload_id 
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can update mappings for their uploads" 
ON public.column_mappings 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.csv_uploads 
    WHERE id = column_mappings.csv_upload_id 
    AND user_id = auth.uid()
  )
);

-- Create table for service type mappings
CREATE TABLE public.service_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  original_service TEXT NOT NULL,
  standardized_service TEXT NOT NULL,
  carrier TEXT NOT NULL,
  confidence_score NUMERIC(3,2) DEFAULT 0,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(original_service, carrier)
);

-- Insert common service mappings
INSERT INTO public.service_mappings (original_service, standardized_service, carrier, confidence_score, is_verified) VALUES
('UPS Ground', 'UPS_GROUND', 'UPS', 1.0, true),
('Ground', 'UPS_GROUND', 'UPS', 0.8, true),
('GND', 'UPS_GROUND', 'UPS', 0.7, true),
('UPS Next Day Air', 'UPS_NEXT_DAY_AIR', 'UPS', 1.0, true),
('Next Day Air', 'UPS_NEXT_DAY_AIR', 'UPS', 0.9, true),
('NDA', 'UPS_NEXT_DAY_AIR', 'UPS', 0.7, true),
('UPS 2nd Day Air', 'UPS_2ND_DAY_AIR', 'UPS', 1.0, true),
('2nd Day Air', 'UPS_2ND_DAY_AIR', 'UPS', 0.9, true),
('2DA', 'UPS_2ND_DAY_AIR', 'UPS', 0.7, true),
('FedEx Ground', 'FEDEX_GROUND', 'FedEx', 1.0, true),
('FedEx Express', 'FEDEX_EXPRESS_SAVER', 'FedEx', 0.8, true),
('FedEx Overnight', 'FEDEX_STANDARD_OVERNIGHT', 'FedEx', 0.9, true),
('USPS Ground Advantage', 'USPS_GROUND_ADVANTAGE', 'USPS', 1.0, true),
('USPS Priority', 'USPS_PRIORITY_MAIL', 'USPS', 0.9, true);

-- Enable RLS for service mappings (public read, admin write)
ALTER TABLE public.service_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view service mappings" 
ON public.service_mappings 
FOR SELECT 
USING (true);

-- Add trigger for updated_at on csv_uploads
CREATE TRIGGER update_csv_uploads_updated_at
BEFORE UPDATE ON public.csv_uploads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();