-- Add report_name column to shipping_analyses table
ALTER TABLE public.shipping_analyses 
ADD COLUMN report_name text;