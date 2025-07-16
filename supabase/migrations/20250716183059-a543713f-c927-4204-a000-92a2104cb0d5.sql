-- First, create new simplified reports table
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

-- Migrate existing data from shipping_analyses to reports
INSERT INTO public.reports (
  id,
  user_id,
  report_name,
  raw_csv_data,
  raw_csv_filename,
  total_rows,
  current_section,
  sections_completed,
  header_mappings,
  service_mappings,
  analysis_results,
  ups_rate_quotes,
  total_savings,
  total_shipments,
  client_id,
  created_at,
  updated_at
)
SELECT 
  sa.id,
  sa.user_id,
  COALESCE(sa.report_name, sa.file_name) as report_name,
  COALESCE(cu.csv_content, '{}') as raw_csv_data,
  sa.file_name as raw_csv_filename,
  COALESCE(cu.row_count, sa.total_shipments) as total_rows,
  CASE 
    WHEN sa.status = 'completed' THEN 'complete'
    ELSE 'results'
  END as current_section,
  CASE 
    WHEN sa.status = 'completed' THEN ARRAY['header_mapping', 'service_mapping', 'analysis', 'results']
    ELSE ARRAY['header_mapping', 'service_mapping', 'analysis']
  END as sections_completed,
  '{}' as header_mappings, -- Will be populated later from column_mappings
  '{}' as service_mappings, -- Will be populated later
  COALESCE(sa.savings_analysis, '{}') as analysis_results,
  COALESCE(sa.ups_quotes, '{}') as ups_rate_quotes,
  sa.total_savings,
  sa.total_shipments,
  sa.client_id,
  sa.created_at,
  sa.updated_at
FROM public.shipping_analyses sa
LEFT JOIN public.csv_uploads cu ON cu.id = sa.csv_upload_id
WHERE sa.is_deleted IS NOT TRUE;