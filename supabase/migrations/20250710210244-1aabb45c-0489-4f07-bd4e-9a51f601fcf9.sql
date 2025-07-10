-- Add negotiated rate tracking to rate_quotes table
ALTER TABLE public.rate_quotes 
ADD COLUMN rate_type text DEFAULT 'published',
ADD COLUMN has_negotiated_rates boolean DEFAULT false,
ADD COLUMN published_rate numeric,
ADD COLUMN negotiated_rate numeric,
ADD COLUMN savings_amount numeric,
ADD COLUMN savings_percentage numeric;

-- Add comment for clarity
COMMENT ON COLUMN public.rate_quotes.rate_type IS 'Type of rate: published, negotiated, or mixed';
COMMENT ON COLUMN public.rate_quotes.has_negotiated_rates IS 'Whether negotiated rates were available for this quote';
COMMENT ON COLUMN public.rate_quotes.published_rate IS 'Published rate for comparison';
COMMENT ON COLUMN public.rate_quotes.negotiated_rate IS 'Negotiated rate when available';
COMMENT ON COLUMN public.rate_quotes.savings_amount IS 'Dollar amount saved with negotiated rates';
COMMENT ON COLUMN public.rate_quotes.savings_percentage IS 'Percentage saved with negotiated rates';