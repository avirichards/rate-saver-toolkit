-- Create processed_shipments table for streaming analysis results
CREATE TABLE IF NOT EXISTS processed_shipments (
  id BIGSERIAL PRIMARY KEY,
  analysis_id UUID NOT NULL REFERENCES shipping_analyses(id) ON DELETE CASCADE,
  tracking_id TEXT,
  origin_zip TEXT,
  destination_zip TEXT,
  weight DECIMAL(10,2),
  length DECIMAL(8,2),
  width DECIMAL(8,2),
  height DECIMAL(8,2),
  dimensions TEXT,
  carrier TEXT,
  customer_service TEXT,
  shippros_service TEXT,
  current_rate DECIMAL(10,2),
  shippros_cost DECIMAL(10,2),
  savings DECIMAL(10,2),
  savings_percent DECIMAL(5,2),
  analyzed_with_account TEXT,
  account_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_processed_shipments_analysis_id ON processed_shipments(analysis_id);
CREATE INDEX IF NOT EXISTS idx_processed_shipments_account ON processed_shipments(account_name);
CREATE INDEX IF NOT EXISTS idx_processed_shipments_savings ON processed_shipments(savings);

-- Enable RLS
ALTER TABLE processed_shipments ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own processed shipments" 
ON processed_shipments 
FOR SELECT 
USING (
  analysis_id IN (
    SELECT id FROM shipping_analyses WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert their own processed shipments" 
ON processed_shipments 
FOR INSERT 
WITH CHECK (
  analysis_id IN (
    SELECT id FROM shipping_analyses WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own processed shipments" 
ON processed_shipments 
FOR UPDATE 
USING (
  analysis_id IN (
    SELECT id FROM shipping_analyses WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own processed shipments" 
ON processed_shipments 
FOR DELETE 
USING (
  analysis_id IN (
    SELECT id FROM shipping_analyses WHERE user_id = auth.uid()
  )
);