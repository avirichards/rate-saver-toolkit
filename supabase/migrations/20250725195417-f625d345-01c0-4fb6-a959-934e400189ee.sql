-- Update service_mappings table to use universal categories
ALTER TABLE service_mappings DROP COLUMN IF EXISTS carrier_type;

-- Add universal service category data to existing UPS services
UPDATE carrier_services 
SET service_name = CASE 
  WHEN service_code = '01' THEN 'Overnight'
  WHEN service_code = '02' THEN '2-Day' 
  WHEN service_code = '03' THEN 'Ground'
  WHEN service_code = '12' THEN '3-Day Select'
  WHEN service_code = '13' THEN 'Overnight Saver'
  WHEN service_code = '14' THEN 'Overnight Early'
  WHEN service_code = '59' THEN '2-Day Morning'
  WHEN service_code = '07' THEN 'International Express'
  WHEN service_code = '08' THEN 'International Expedited'
  WHEN service_code = '11' THEN 'International Standard'
  WHEN service_code = '65' THEN 'International Saver'
  ELSE service_name
END
WHERE carrier_type = 'UPS';

-- Insert FedEx services with universal categories
INSERT INTO carrier_services (carrier_type, service_code, service_name, description, is_international, is_active) VALUES
('FEDEX', 'PRIORITY_OVERNIGHT', 'Overnight', 'FedEx Priority Overnight', false, true),
('FEDEX', 'STANDARD_OVERNIGHT', 'Overnight Saver', 'FedEx Standard Overnight', false, true),
('FEDEX', 'FIRST_OVERNIGHT', 'Overnight Early', 'FedEx First Overnight', false, true),
('FEDEX', 'FEDEX_2_DAY', '2-Day', 'FedEx 2Day', false, true),
('FEDEX', 'FEDEX_2_DAY_AM', '2-Day Morning', 'FedEx 2Day A.M.', false, true),
('FEDEX', 'FEDEX_GROUND', 'Ground', 'FedEx Ground', false, true),
('FEDEX', 'INTERNATIONAL_PRIORITY', 'International Express', 'FedEx International Priority', true, true),
('FEDEX', 'INTERNATIONAL_ECONOMY', 'International Expedited', 'FedEx International Economy', true, true)
ON CONFLICT (carrier_type, service_code) DO UPDATE SET
service_name = EXCLUDED.service_name,
description = EXCLUDED.description;

-- Insert DHL services with universal categories  
INSERT INTO carrier_services (carrier_type, service_code, service_name, description, is_international, is_active) VALUES
('DHL', 'EXPRESS_10_30', 'Overnight', 'DHL Express 10:30', true, true),
('DHL', 'EXPRESS_9_00', 'Overnight Early', 'DHL Express 9:00', true, true),
('DHL', 'EXPRESS_12_00', '2-Day', 'DHL Express 12:00', true, true),
('DHL', 'EXPRESS_WORLDWIDE', 'International Express', 'DHL Express Worldwide', true, true),
('DHL', 'EXPRESS_EASY', 'International Expedited', 'DHL Express Easy', true, true)
ON CONFLICT (carrier_type, service_code) DO UPDATE SET
service_name = EXCLUDED.service_name,
description = EXCLUDED.description;