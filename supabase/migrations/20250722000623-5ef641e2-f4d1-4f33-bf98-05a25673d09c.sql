-- Add missing columns to shipping_analyses table
ALTER TABLE public.shipping_analyses 
ADD COLUMN IF NOT EXISTS column_mappings jsonb,
ADD COLUMN IF NOT EXISTS service_mappings jsonb;