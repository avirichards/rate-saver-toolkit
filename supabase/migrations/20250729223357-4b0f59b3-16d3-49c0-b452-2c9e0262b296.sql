-- Add missing FedEx Home Delivery service
INSERT INTO carrier_services (carrier_type, service_code, service_name, description, is_active)
VALUES ('fedex', 'FEDEX_HOME_DELIVERY', 'FedEx Home Delivery', 'Residential ground delivery service', true)
ON CONFLICT (carrier_type, service_code) DO NOTHING;