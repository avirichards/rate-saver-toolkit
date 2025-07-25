-- Re-insert UPS services with universal service names
INSERT INTO carrier_services (carrier_type, service_code, service_name, description, is_international, is_active) VALUES
('UPS', '01', 'Overnight', 'UPS Next Day Air', false, true),
('UPS', '02', '2-Day', 'UPS 2nd Day Air', false, true),
('UPS', '03', 'Ground', 'UPS Ground', false, true),
('UPS', '12', '3-Day Select', 'UPS 3 Day Select', false, true),
('UPS', '13', 'Overnight Saver', 'UPS Next Day Air Saver', false, true),
('UPS', '14', 'Overnight Early', 'UPS Next Day Air Early', false, true),
('UPS', '59', '2-Day Morning', 'UPS 2nd Day Air A.M.', false, true),
('UPS', '07', 'International Express', 'UPS Worldwide Express', true, true),
('UPS', '08', 'International Expedited', 'UPS Worldwide Expedited', true, true),
('UPS', '11', 'International Standard', 'UPS Standard', true, true),
('UPS', '65', 'International Saver', 'UPS Worldwide Saver', true, true)
ON CONFLICT (carrier_type, service_code) DO UPDATE SET
service_name = EXCLUDED.service_name,
description = EXCLUDED.description;