-- Create clients table for client management
CREATE TABLE public.clients (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  company_name text NOT NULL,
  contact_name text,
  contact_email text,
  contact_phone text,
  industry text,
  notes text,
  branding_config jsonb DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create markup profiles for reusable markup configurations
CREATE TABLE public.markup_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  markup_type text NOT NULL DEFAULT 'global', -- 'global', 'per_service', 'tiered'
  markup_config jsonb NOT NULL DEFAULT '{}',
  is_default boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create report shares for shareable client links
CREATE TABLE public.report_shares (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_id uuid NOT NULL,
  share_token text NOT NULL UNIQUE,
  client_id uuid,
  expires_at timestamp with time zone,
  password_hash text,
  is_active boolean DEFAULT true,
  view_count integer DEFAULT 0,
  last_viewed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add new columns to shipping_analyses table
ALTER TABLE public.shipping_analyses 
ADD COLUMN client_id uuid,
ADD COLUMN markup_profile_id uuid,
ADD COLUMN sales_rep_id uuid,
ADD COLUMN report_status text DEFAULT 'draft',
ADD COLUMN base_data jsonb,
ADD COLUMN markup_data jsonb,
ADD COLUMN client_facing_data jsonb,
ADD COLUMN is_deleted boolean DEFAULT false,
ADD COLUMN deleted_at timestamp with time zone;

-- Enable RLS on new tables
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.markup_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_shares ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for clients table
CREATE POLICY "Users can view their own clients" 
ON public.clients 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own clients" 
ON public.clients 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own clients" 
ON public.clients 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own clients" 
ON public.clients 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create RLS policies for markup_profiles table
CREATE POLICY "Users can view their own markup profiles" 
ON public.markup_profiles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own markup profiles" 
ON public.markup_profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own markup profiles" 
ON public.markup_profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own markup profiles" 
ON public.markup_profiles 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create RLS policies for report_shares table
CREATE POLICY "Users can view shares for their analyses" 
ON public.report_shares 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.shipping_analyses 
  WHERE shipping_analyses.id = report_shares.analysis_id 
  AND shipping_analyses.user_id = auth.uid()
));

CREATE POLICY "Users can create shares for their analyses" 
ON public.report_shares 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.shipping_analyses 
  WHERE shipping_analyses.id = report_shares.analysis_id 
  AND shipping_analyses.user_id = auth.uid()
));

CREATE POLICY "Users can update shares for their analyses" 
ON public.report_shares 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.shipping_analyses 
  WHERE shipping_analyses.id = report_shares.analysis_id 
  AND shipping_analyses.user_id = auth.uid()
));

CREATE POLICY "Users can delete shares for their analyses" 
ON public.report_shares 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM public.shipping_analyses 
  WHERE shipping_analyses.id = report_shares.analysis_id 
  AND shipping_analyses.user_id = auth.uid()
));

-- Create public policy for viewing shared reports (without authentication)
CREATE POLICY "Anyone can view active shared reports" 
ON public.report_shares 
FOR SELECT 
USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

-- Add triggers for updated_at columns
CREATE TRIGGER update_clients_updated_at
BEFORE UPDATE ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_markup_profiles_updated_at
BEFORE UPDATE ON public.markup_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance (avoiding existing ones)
CREATE INDEX idx_clients_user_id ON public.clients(user_id);
CREATE INDEX idx_markup_profiles_user_id ON public.markup_profiles(user_id);
CREATE INDEX idx_report_shares_analysis_id ON public.report_shares(analysis_id);
CREATE INDEX idx_report_shares_share_token ON public.report_shares(share_token);
CREATE INDEX idx_shipping_analyses_client_id ON public.shipping_analyses(client_id);
CREATE INDEX idx_shipping_analyses_sales_rep_id ON public.shipping_analyses(sales_rep_id);
CREATE INDEX idx_shipping_analyses_report_status ON public.shipping_analyses(report_status);
CREATE INDEX idx_shipping_analyses_deleted ON public.shipping_analyses(is_deleted) WHERE is_deleted = false;