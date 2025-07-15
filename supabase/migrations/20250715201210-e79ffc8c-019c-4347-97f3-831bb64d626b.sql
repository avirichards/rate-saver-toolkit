-- Add CSV content storage to csv_uploads table
ALTER TABLE public.csv_uploads 
ADD COLUMN csv_content TEXT;

-- Add foreign key to link shipping_analyses to csv_uploads
ALTER TABLE public.shipping_analyses 
ADD COLUMN csv_upload_id UUID REFERENCES public.csv_uploads(id);