-- Insert FedEx services into carrier_services table
INSERT INTO carrier_services (carrier_type, service_code, service_name, description, is_international, is_active) VALUES
('fedex', 'FEDEX_GROUND', 'FedEx Ground', 'Ground delivery service', false, true),
('fedex', 'FEDEX_EXPRESS_SAVER', 'FedEx Express Saver', '3 business day express delivery', false, true),
('fedex', 'FEDEX_2_DAY', 'FedEx 2Day', '2 business day delivery', false, true),
('fedex', 'FEDEX_2_DAY_AM', 'FedEx 2Day A.M.', '2 business day morning delivery', false, true),
('fedex', 'STANDARD_OVERNIGHT', 'FedEx Standard Overnight', 'Next business day delivery', false, true),
('fedex', 'PRIORITY_OVERNIGHT', 'FedEx Priority Overnight', 'Next business day morning delivery', false, true),
('fedex', 'FIRST_OVERNIGHT', 'FedEx First Overnight', 'Next business day early morning delivery', false, true),
('fedex', 'FEDEX_FREIGHT_PRIORITY', 'FedEx Freight Priority', 'Freight priority service', false, true),
('fedex', 'FEDEX_FREIGHT_ECONOMY', 'FedEx Freight Economy', 'Freight economy service', false, true),
('fedex', 'INTERNATIONAL_ECONOMY', 'FedEx International Economy', 'International economy delivery', true, true),
('fedex', 'INTERNATIONAL_PRIORITY', 'FedEx International Priority', 'International priority delivery', true, true),
('fedex', 'INTERNATIONAL_FIRST', 'FedEx International First', 'International first delivery', true, true)
ON CONFLICT (carrier_type, service_code) DO NOTHING;