
-- Add new fields to shipping_analyses table for account assignment tracking
ALTER TABLE public.shipping_analyses 
ADD COLUMN IF NOT EXISTS account_assignments jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS service_assignments jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS global_assignment jsonb DEFAULT NULL;

-- Add comments to document the new fields
COMMENT ON COLUMN public.shipping_analyses.account_assignments IS 'Individual shipment account assignments with tracking';
COMMENT ON COLUMN public.shipping_analyses.service_assignments IS 'Service-level account preferences and recommendations';
COMMENT ON COLUMN public.shipping_analyses.global_assignment IS 'Global account preference for entire analysis';
