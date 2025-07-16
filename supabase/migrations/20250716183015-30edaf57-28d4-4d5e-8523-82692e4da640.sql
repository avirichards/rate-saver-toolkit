-- Create new simplified reports table that consolidates all report data
CREATE TABLE public.reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  report_name TEXT NOT NULL,
  
  -- RAW Data - always preserved
  raw_csv_data TEXT NOT NULL,
  raw_csv_filename TEXT NOT NULL,
  total_rows INTEGER NOT NULL DEFAULT 0,
  
  -- Section progress tracking
  current_section TEXT NOT NULL DEFAULT 'header_mapping' CHECK (current_section IN ('header_mapping', 'service_mapping', 'analysis', 'results', 'complete')),
  sections_completed TEXT[] DEFAULT '{}',
  
  -- Section 1: Header Mappings
  header_mappings JSONB DEFAULT '{}',
  detected_headers TEXT[] DEFAULT '{}',
  
  -- Section 2: Service Mappings  
  service_mappings JSONB DEFAULT '{}',
  
  -- Section 3 & 4: Analysis Results
  analysis_results JSONB DEFAULT '{}',
  ups_rate_quotes JSONB DEFAULT '{}',
  total_savings NUMERIC,
  total_shipments INTEGER DEFAULT 0,
  
  -- Client assignment
  client_id UUID REFERENCES public.clients(id),
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own reports" 
ON public.reports 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own reports" 
ON public.reports 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reports" 
ON public.reports 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reports" 
ON public.reports 
FOR DELETE 
USING (auth.uid() = user_id);

-- Public access for shared reports
CREATE POLICY "Public can view shared reports" 
ON public.reports 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.report_shares 
    WHERE report_shares.analysis_id = reports.id 
    AND report_shares.is_active = true 
    AND (report_shares.expires_at IS NULL OR report_shares.expires_at > now())
  )
);

-- Update timestamp trigger
CREATE TRIGGER update_reports_updated_at
BEFORE UPDATE ON public.reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update report_shares table to reference new reports table
ALTER TABLE public.report_shares 
DROP CONSTRAINT IF EXISTS report_shares_analysis_id_fkey,
ADD CONSTRAINT report_shares_report_id_fkey 
FOREIGN KEY (analysis_id) REFERENCES public.reports(id) ON DELETE CASCADE;