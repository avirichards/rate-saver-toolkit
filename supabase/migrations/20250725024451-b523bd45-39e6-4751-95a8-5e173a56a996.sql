-- Update existing shipping_analyses data to use standardized field names
-- This will fix the data structure mismatch causing processing failures

-- Update processed_shipments to use new field names
UPDATE shipping_analyses 
SET processed_shipments = (
  SELECT jsonb_agg(
    CASE 
      WHEN jsonb_typeof(shipment) = 'object' THEN
        shipment 
        - 'service' 
        - 'originalService' 
        - 'recommendedService' 
        - 'newRate'
        || jsonb_build_object(
          'customer_service', COALESCE(shipment->>'service', shipment->>'originalService', 'Unknown'),
          'ShipPros_service', COALESCE(shipment->>'recommendedService', 'UPS Ground'),
          'ShipPros_cost', COALESCE((shipment->>'newRate')::numeric, (shipment->>'ShipPros_cost')::numeric, 0)
        )
      ELSE shipment
    END
  )
  FROM jsonb_array_elements(processed_shipments) AS shipment
)
WHERE processed_shipments IS NOT NULL 
AND jsonb_typeof(processed_shipments) = 'array'
AND jsonb_array_length(processed_shipments) > 0;

-- Update orphaned_shipments to use new field names  
UPDATE shipping_analyses 
SET orphaned_shipments = (
  SELECT jsonb_agg(
    CASE 
      WHEN jsonb_typeof(shipment) = 'object' THEN
        shipment 
        - 'service' 
        - 'originalService'
        || jsonb_build_object(
          'customer_service', COALESCE(shipment->>'service', shipment->>'originalService', 'Unknown')
        )
      ELSE shipment
    END
  )
  FROM jsonb_array_elements(orphaned_shipments) AS shipment
)
WHERE orphaned_shipments IS NOT NULL 
AND jsonb_typeof(orphaned_shipments) = 'array'
AND jsonb_array_length(orphaned_shipments) > 0;

-- Update recommendations to use new field names
UPDATE shipping_analyses 
SET recommendations = (
  SELECT jsonb_agg(
    CASE 
      WHEN jsonb_typeof(rec) = 'object' THEN
        rec 
        - 'originalService'
        - 'recommendedService' 
        - 'newRate'
        || jsonb_build_object(
          'customer_service', COALESCE(rec->>'originalService', 'Unknown'),
          'ShipPros_service', COALESCE(rec->>'recommendedService', 'UPS Ground'), 
          'ShipPros_cost', COALESCE((rec->>'newRate')::numeric, (rec->>'ShipPros_cost')::numeric, 0)
        )
      ELSE rec
    END
  )
  FROM jsonb_array_elements(recommendations) AS rec
)
WHERE recommendations IS NOT NULL 
AND jsonb_typeof(recommendations) = 'array'
AND jsonb_array_length(recommendations) > 0;