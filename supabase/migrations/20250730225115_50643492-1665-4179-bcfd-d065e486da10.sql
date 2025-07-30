-- Add missing service mappings for FedEx services
INSERT INTO service_mappings (original_service, standardized_service, carrier, carrier_type, confidence_score, is_verified) VALUES
('FedEx 2 Day', 'TWO_DAY', 'FedEx', 'fedex', 1.00, true),
('FedEx 2Day', 'TWO_DAY', 'FedEx', 'fedex', 1.00, true),
('FedEx Home Delivery', 'GROUND', 'FedEx', 'fedex', 1.00, true);

-- Also update the existing UPS 2nd Day Air to use universal category
UPDATE service_mappings 
SET standardized_service = 'TWO_DAY' 
WHERE original_service IN ('UPS 2nd Day Air', '2nd Day Air') 
AND carrier = 'UPS';