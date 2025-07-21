
-- Create table to store every rate for every shipment from every carrier account
CREATE TABLE public.shipment_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_id UUID NOT NULL REFERENCES public.shipping_analyses(id) ON DELETE CASCADE,
  shipment_index INTEGER NOT NULL,
  carrier_config_id UUID NOT NULL REFERENCES public.carrier_configs(id),
  account_name TEXT NOT NULL,
  carrier_type TEXT NOT NULL,
  service_code TEXT NOT NULL,
  service_name TEXT,
  rate_amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  transit_days INTEGER,
  is_negotiated BOOLEAN DEFAULT false,
  published_rate NUMERIC(10,2),
  shipment_data JSONB NOT NULL,
  rate_response JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add indexes for better query performance
CREATE INDEX idx_shipment_rates_analysis_id ON public.shipment_rates(analysis_id);
CREATE INDEX idx_shipment_rates_shipment_index ON public.shipment_rates(shipment_index);
CREATE INDEX idx_shipment_rates_carrier_config ON public.shipment_rates(carrier_config_id);
CREATE INDEX idx_shipment_rates_account_name ON public.shipment_rates(account_name);

-- Enable Row Level Security
ALTER TABLE public.shipment_rates ENABLE ROW LEVEL SECURITY;

-- Create RLS policies to ensure users can only see rates from their own analyses
CREATE POLICY "Users can view rates from their own analyses" 
  ON public.shipment_rates 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.shipping_analyses 
      WHERE shipping_analyses.id = shipment_rates.analysis_id 
      AND shipping_analyses.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert rates for their own analyses" 
  ON public.shipment_rates 
  FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shipping_analyses 
      WHERE shipping_analyses.id = shipment_rates.analysis_id 
      AND shipping_analyses.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update rates for their own analyses" 
  ON public.shipment_rates 
  FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.shipping_analyses 
      WHERE shipping_analyses.id = shipment_rates.analysis_id 
      AND shipping_analyses.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete rates for their own analyses" 
  ON public.shipment_rates 
  FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM public.shipping_analyses 
      WHERE shipping_analyses.id = shipment_rates.analysis_id 
      AND shipping_analyses.user_id = auth.uid()
    )
  );

-- Add trigger to update updated_at timestamp
CREATE TRIGGER update_shipment_rates_updated_at
  BEFORE UPDATE ON public.shipment_rates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
