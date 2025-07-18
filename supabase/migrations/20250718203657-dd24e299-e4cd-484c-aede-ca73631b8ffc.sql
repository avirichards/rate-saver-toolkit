
-- Add new fields to shipping_analyses table for account assignments
ALTER TABLE public.shipping_analyses 
ADD COLUMN IF NOT EXISTS account_assignments JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS service_assignments JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS global_assignment JSONB DEFAULT NULL;

-- Update the table to ensure these fields have proper defaults for existing records
UPDATE public.shipping_analyses 
SET 
  account_assignments = COALESCE(account_assignments, '[]'::jsonb),
  service_assignments = COALESCE(service_assignments, '{}'::jsonb),
  global_assignment = COALESCE(global_assignment, NULL)
WHERE account_assignments IS NULL OR service_assignments IS NULL;
