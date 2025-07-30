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
        console.log(`📦 Progressive batching: Starting async save of ${shipments.length} shipments`);
        
        // Just save the rates - skip the full processed shipments for speed
        const shipmentRatesToInsert: any[] = [];
        
        shipments.forEach((completed, shipmentIndex) => {
          if (completed.allRates && Array.isArray(completed.allRates)) {
            completed.allRates.forEach((rate: any) => {
              shipmentRatesToInsert.push({
                analysis_id: analysisId,
                shipment_index: shipmentIndex, 
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
        });

        // Fire-and-forget database writes
        if (shipmentRatesToInsert.length > 0) {
          supabase.from('shipment_rates').insert(shipmentRatesToInsert).then(({ error }) => {
            if (error) {
              console.warn('Progressive batch save failed (non-blocking):', error);
            } else {
              console.log(`✅ Progressive batch: Saved ${shipments.length} shipments in background`);
              onBatchSaved?.(shipments.length);
            }
          });
        }

        // Simple metadata update (also fire-and-forget)
        supabase
          .from('shipping_analyses')
          .update({
            updated_at: new Date().toISOString(),
            processing_metadata: {
              lastProgressiveBatch: new Date().toISOString(),
              progressiveBatchesSaved: true
            }
          })
          .eq('id', analysisId)
          .then(({ error }) => {
            if (error) {
              console.warn('Failed to update analysis metadata (non-blocking):', error);
            }
          });
          
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