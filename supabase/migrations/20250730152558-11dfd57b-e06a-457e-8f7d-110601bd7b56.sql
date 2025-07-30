-- Add missing FedEx services to carrier_services table
INSERT INTO carrier_services (carrier_type, service_code, service_name, description, is_international, is_active) VALUES
('FEDEX', 'FEDEX_EXPRESS_SAVER', 'Express Saver', 'FedEx Express Saver', false, true),
('FEDEX', 'FEDEX_HOME_DELIVERY', 'Home Delivery', 'FedEx Home Delivery', false, true),
('FEDEX', 'INTERNATIONAL_FIRST', 'International First', 'FedEx International First', true, true),
('FEDEX', 'FEDEX_FREIGHT_ECONOMY', 'Freight Economy', 'FedEx Freight Economy', false, true),
('FEDEX', 'FEDEX_FREIGHT_PRIORITY', 'Freight Priority', 'FedEx Freight Priority', false, true)
ON CONFLICT (carrier_type, service_code) DO NOTHING;