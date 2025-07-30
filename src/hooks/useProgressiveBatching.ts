import { useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CompletedShipment {
  shipment: any;
  currentCost: number;
  allRates: any[];
  carrierResults: any[];
  bestRate: any;
  bestOverallRate: any;
  savings: number;
  maxSavings: number;
  expectedServiceCode: string;
  mappingValidation: any;
}

interface ProgressiveBatchingOptions {
  batchSize?: number;
  batchTimeoutMs?: number;
  onBatchSaved?: (batchSize: number) => void;
  onError?: (error: Error) => void;
}

export function useProgressiveBatching(
  analysisId: string | null,
  options: ProgressiveBatchingOptions = {}
) {
  const {
    batchSize = 50,
    batchTimeoutMs = 30000, // 30 seconds
    onBatchSaved,
    onError
  } = options;

  const pendingShipments = useRef<CompletedShipment[]>([]);
  const batchTimeout = useRef<NodeJS.Timeout>();
  const isSaving = useRef(false);

  const saveBatch = useCallback(async (shipments: CompletedShipment[]) => {
    if (!analysisId || shipments.length === 0 || isSaving.current) return;

    isSaving.current = true;
    
    // Make this completely async - don't await or block anything
    (async () => {
      try {
        console.log(`📦 Progressive batching: Starting async save of ${shipments.length} complete shipments`);
        
        // Save both rates AND processed shipments for complete progressive saving
        const shipmentRatesToInsert: any[] = [];
        const processedShipments = shipments.map((completed, localIndex) => {
          // Process rates for this shipment
          if (completed.allRates && Array.isArray(completed.allRates)) {
            completed.allRates.forEach((rate: any) => {
              shipmentRatesToInsert.push({
                analysis_id: analysisId,
                shipment_index: localIndex,
                carrier_config_id: rate.carrierId || '',
                account_name: rate.carrierName || rate.accountName || 'Unknown',
                carrier_type: rate.carrierType || 'ups',
                service_code: rate.serviceCode || '',
                service_name: rate.serviceName || rate.description || '',
                rate_amount: rate.totalCharges || rate.negotiatedRate || rate.rate_amount || 0,
                currency: rate.currency || 'USD',
                transit_days: rate.transitTime || null,
                is_negotiated: rate.rateType === 'negotiated' || rate.hasNegotiatedRates || false,
                published_rate: rate.publishedRate || null,
                shipment_data: completed.shipment || {}
              });
            });
          }

          // Return processed shipment for analysis
          return {
            id: completed.shipment.id,
            trackingId: completed.shipment.trackingId,
            service: completed.shipment.service,
            carrier: completed.shipment.carrier || 'UPS',
            originZip: completed.shipment.originZip,
            destZip: completed.shipment.destZip,
            weight: parseFloat(completed.shipment.weight || '0'),
            length: parseFloat(completed.shipment.length || '0'),
            width: parseFloat(completed.shipment.width || '0'),
            height: parseFloat(completed.shipment.height || '0'),
            dimensions: completed.shipment.dimensions,
            customer_service: completed.shipment.service || 'Unknown',
            ShipPros_service: completed.bestRate?.serviceName || 'Ground',
            currentRate: completed.currentCost,
            ShipPros_cost: completed.bestRate?.totalCharges || 0,
            savings: completed.savings,
            savingsPercent: completed.currentCost > 0 ? (completed.savings / completed.currentCost) * 100 : 0,
            analyzedWithAccount: completed.bestRate?.accountName || 'Unknown',
            accountName: completed.bestRate?.accountName || 'Unknown'
          };
        });

        // Fire-and-forget database writes (parallel for speed)
        const promises = [];
        
        // Save rates
        if (shipmentRatesToInsert.length > 0) {
          promises.push(
            supabase.from('shipment_rates').insert(shipmentRatesToInsert).then(({ error }) => {
              if (error) {
                console.warn('Progressive batch rates save failed (non-blocking):', error);
              } else {
                console.log(`✅ Saved ${shipmentRatesToInsert.length} rates in background`);
              }
            })
          );
        }

        // For now, just append to processed_shipments with a simpler approach
        promises.push(
          supabase
            .from('shipping_analyses')
            .select('processed_shipments')
            .eq('id', analysisId)
            .single()
            .then(({ data, error }) => {
              if (error) {
                console.warn('Failed to read current shipments:', error);
                return;
              }
              
              const existingShipments = Array.isArray(data?.processed_shipments) ? data.processed_shipments : [];
              const updatedShipments = [...existingShipments, ...processedShipments];
              
              return supabase
                .from('shipping_analyses')
                .update({
                  processed_shipments: updatedShipments,
                  updated_at: new Date().toISOString()
                })
                .eq('id', analysisId);
            })
            .then((result) => {
              if (result?.error) {
                console.warn('Progressive batch shipments save failed (non-blocking):', result.error);
              } else {
                console.log(`✅ Saved ${processedShipments.length} processed shipments in background`);
                onBatchSaved?.(shipments.length);
              }
            })
        );

        // Wait for all saves to complete in background
        Promise.all(promises);
          
      } catch (error) {
        console.error('Progressive batching error (non-blocking):', error);
        onError?.(error as Error);
      } finally {
        isSaving.current = false;
      }
    })();
  }, [analysisId, onBatchSaved, onError]);

  const flushPendingBatch = useCallback(async () => {
    if (pendingShipments.current.length > 0) {
      const batch = [...pendingShipments.current];
      pendingShipments.current = [];
      
      if (batchTimeout.current) {
        clearTimeout(batchTimeout.current);
        batchTimeout.current = undefined;
      }
      
      // Don't await this - let it run in background
      saveBatch(batch);
    }
  }, [saveBatch]);

  const addCompletedShipment = useCallback((completed: CompletedShipment) => {
    pendingShipments.current.push(completed);

    // Check if we should save immediately due to batch size  
    if (pendingShipments.current.length >= batchSize) {
      flushPendingBatch(); // Fire-and-forget
      return;
    }

    // Set/reset timeout for batch saving
    if (batchTimeout.current) {
      clearTimeout(batchTimeout.current);
    }
    
    batchTimeout.current = setTimeout(() => {
      flushPendingBatch(); // Fire-and-forget
    }, batchTimeoutMs);
  }, [batchSize, batchTimeoutMs, flushPendingBatch]);

  const finalizeBatching = useCallback(async () => {
    // Clear any pending timeout
    if (batchTimeout.current) {
      clearTimeout(batchTimeout.current);
      batchTimeout.current = undefined;
    }

    // Save any remaining shipments (still non-blocking for speed)
    if (pendingShipments.current.length > 0) {
      console.log(`📦 Finalizing ${pendingShipments.current.length} remaining shipments`);
      flushPendingBatch(); // Fire-and-forget, don't wait
    }
  }, [flushPendingBatch]);

  return {
    addCompletedShipment,
    finalizeBatching,
    getPendingCount: () => pendingShipments.current.length
  };
}