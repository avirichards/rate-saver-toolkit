-- Add centralized data storage columns to shipping_analyses table
ALTER TABLE public.shipping_analyses 
ADD COLUMN processed_shipments JSONB DEFAULT '[]'::jsonb,
ADD COLUMN orphaned_shipments JSONB DEFAULT '[]'::jsonb,
ADD COLUMN processing_metadata JSONB DEFAULT '{}'::jsonb;

-- Add indexes for better performance on JSONB columns
CREATE INDEX idx_shipping_analyses_processed_shipments ON public.shipping_analyses USING GIN (processed_shipments);
CREATE INDEX idx_shipping_analyses_orphaned_shipments ON public.shipping_analyses USING GIN (orphaned_shipments);

-- Update existing records to have empty arrays if they don't have these fields
UPDATE public.shipping_analyses 
SET 
  processed_shipments = COALESCE(processed_shipments, '[]'::jsonb),
  orphaned_shipments = COALESCE(orphaned_shipments, '[]'::jsonb),
  processing_metadata = COALESCE(processing_metadata, '{}'::jsonb)
WHERE 
  processed_shipments IS NULL 
  OR orphaned_shipments IS NULL 
  OR processing_metadata IS NULL;