-- First, let's see what check constraints exist on carrier_services
SELECT conname, pg_get_constraintdef(c.oid) 
FROM pg_constraint c 
JOIN pg_class t ON c.conrelid = t.oid 
WHERE t.relname = 'carrier_services' AND c.contype = 'c';

-- Drop the problematic check constraint that's preventing FEDEX/DHL insertion
ALTER TABLE carrier_services DROP CONSTRAINT IF EXISTS carrier_services_carrier_type_check;

-- Add a new constraint that allows UPS, FEDEX, and DHL
ALTER TABLE carrier_services ADD CONSTRAINT carrier_services_carrier_type_check 
CHECK (carrier_type IN ('UPS', 'ups', 'FEDEX', 'fedex', 'DHL', 'dhl', 'USPS', 'usps'));

-- Now insert the FedEx and DHL services
INSERT INTO carrier_services (carrier_type, service_code, service_name, description, is_international, is_active) VALUES
('FEDEX', 'PRIORITY_OVERNIGHT', 'Overnight', 'FedEx Priority Overnight', false, true),
('FEDEX', 'STANDARD_OVERNIGHT', 'Overnight Saver', 'FedEx Standard Overnight', false, true),
('FEDEX', 'FIRST_OVERNIGHT', 'Overnight Early', 'FedEx First Overnight', false, true),
('FEDEX', 'FEDEX_2_DAY', '2-Day', 'FedEx 2Day', false, true),
('FEDEX', 'FEDEX_2_DAY_AM', '2-Day Morning', 'FedEx 2Day A.M.', false, true),
('FEDEX', 'FEDEX_GROUND', 'Ground', 'FedEx Ground', false, true),
('FEDEX', 'INTERNATIONAL_PRIORITY', 'International Express', 'FedEx International Priority', true, true),
('FEDEX', 'INTERNATIONAL_ECONOMY', 'International Expedited', 'FedEx International Economy', true, true),
('DHL', 'EXPRESS_10_30', 'Overnight', 'DHL Express 10:30', true, true),
('DHL', 'EXPRESS_9_00', 'Overnight Early', 'DHL Express 9:00', true, true),
('DHL', 'EXPRESS_12_00', '2-Day', 'DHL Express 12:00', true, true),
('DHL', 'EXPRESS_WORLDWIDE', 'International Express', 'DHL Express Worldwide', true, true),
('DHL', 'EXPRESS_EASY', 'International Expedited', 'DHL Express Easy', true, true)
ON CONFLICT (carrier_type, service_code) DO UPDATE SET
service_name = EXCLUDED.service_name,
description = EXCLUDED.description;