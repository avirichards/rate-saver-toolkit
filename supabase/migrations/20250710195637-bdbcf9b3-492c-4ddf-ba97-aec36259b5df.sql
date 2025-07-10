-- Add comprehensive UPS service data for better rate calculation
INSERT INTO ups_services (service_code, service_name, description, is_active, is_international) VALUES
  ('01', 'UPS Next Day Air', 'Next business day delivery by 10:30 AM or 12:00 PM', true, false),
  ('02', 'UPS 2nd Day Air', 'Second business day delivery', true, false),
  ('03', 'UPS Ground', 'Standard ground delivery', true, false),
  ('12', 'UPS 3 Day Select', 'Third business day delivery', true, false),
  ('13', 'UPS Next Day Air Saver', 'Next business day delivery by end of day', true, false),
  ('14', 'UPS Next Day Air Early', 'Next business day delivery by 8:00 AM', true, false),
  ('59', 'UPS 2nd Day Air A.M.', 'Second business day delivery by 12:00 PM', true, false),
  ('11', 'UPS Standard', 'International standard delivery', true, true),
  ('07', 'UPS Worldwide Express', 'International express delivery', true, true),
  ('08', 'UPS Worldwide Expedited', 'International expedited delivery', true, true),
  ('65', 'UPS Worldwide Saver', 'International economy delivery', true, true)
ON CONFLICT (service_code) DO UPDATE SET
  service_name = EXCLUDED.service_name,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  is_international = EXCLUDED.is_international;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_shipping_analyses_user_analysis_date ON shipping_analyses(user_id, analysis_date DESC);
CREATE INDEX IF NOT EXISTS idx_shipping_analyses_status ON shipping_analyses(status);
CREATE INDEX IF NOT EXISTS idx_rate_quotes_user_created ON rate_quotes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_csv_uploads_user_created ON csv_uploads(user_id, created_at DESC);

-- Add constraint to ensure positive values for important fields (only if they don't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'check_total_shipments_positive' 
    AND table_name = 'shipping_analyses'
  ) THEN
    ALTER TABLE shipping_analyses 
    ADD CONSTRAINT check_total_shipments_positive 
    CHECK (total_shipments >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'check_total_savings_non_negative' 
    AND table_name = 'shipping_analyses'
  ) THEN
    ALTER TABLE shipping_analyses 
    ADD CONSTRAINT check_total_savings_non_negative 
    CHECK (total_savings IS NULL OR total_savings >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'check_total_cost_non_negative' 
    AND table_name = 'rate_quotes'
  ) THEN
    ALTER TABLE rate_quotes 
    ADD CONSTRAINT check_total_cost_non_negative 
    CHECK (total_cost IS NULL OR total_cost >= 0);
  END IF;
END $$;