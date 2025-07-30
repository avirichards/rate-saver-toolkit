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
    
    try {
      console.log(`📦 Progressive batching: Saving ${shipments.length} completed shipments`);
      
      // Transform completed shipments to shipment_rates format
      const shipmentRatesToInsert: any[] = [];
      
      shipments.forEach((completed, shipmentIndex) => {
        if (completed.allRates && Array.isArray(completed.allRates)) {
          completed.allRates.forEach((rate: any) => {
            shipmentRatesToInsert.push({
              analysis_id: analysisId,
              shipment_index: shipmentIndex, // Will need to be adjusted for global index
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

      // Save shipment rates if we have any
      if (shipmentRatesToInsert.length > 0) {
        const { error: ratesError } = await supabase
          .from('shipment_rates')
          .insert(shipmentRatesToInsert);

        if (ratesError) {
          throw new Error(`Failed to save shipment rates: ${ratesError.message}`);
        }
      }

      // Save completed shipments to analysis record
      // First get current processed shipments
      const { data: currentAnalysis } = await supabase
        .from('shipping_analyses')
        .select('processed_shipments, processing_metadata')
        .eq('id', analysisId)
        .single();

      const existingShipments = Array.isArray(currentAnalysis?.processed_shipments) 
        ? currentAnalysis.processed_shipments 
        : [];
      
      // Transform completed shipments to the format expected by the analysis
      const processedShipments = shipments.map(completed => ({
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
      }));

      const updatedShipments = [...existingShipments, ...processedShipments];
      
      // Update processing metadata - properly handle JSON type
      const currentMetadata = currentAnalysis?.processing_metadata && 
        typeof currentAnalysis.processing_metadata === 'object' && 
        currentAnalysis.processing_metadata !== null &&
        !Array.isArray(currentAnalysis.processing_metadata)
        ? currentAnalysis.processing_metadata as Record<string, any>
        : {};
      
      const updatedMetadata = {
        ...currentMetadata,
        lastProgressiveBatch: new Date().toISOString(),
        progressiveBatchesSaved: (currentMetadata.progressiveBatchesSaved || 0) + 1
      };

      // Update analysis record
      const { error: analysisError } = await supabase
        .from('shipping_analyses')
        .update({
          processed_shipments: updatedShipments,
          processing_metadata: updatedMetadata,
          updated_at: new Date().toISOString()
        })
        .eq('id', analysisId);

      if (analysisError) {
        console.warn('Failed to update analysis metadata:', analysisError);
      }

      console.log(`✅ Progressive batching: Saved ${shipments.length} shipments successfully`);
      onBatchSaved?.(shipments.length);
      
    } catch (error) {
      console.error('Progressive batching error:', error);
      onError?.(error as Error);
    } finally {
      isSaving.current = false;
    }
  }, [analysisId, onBatchSaved, onError]);

  const flushPendingBatch = useCallback(async () => {
    if (pendingShipments.current.length > 0) {
      const batch = [...pendingShipments.current];
      pendingShipments.current = [];
      
      if (batchTimeout.current) {
        clearTimeout(batchTimeout.current);
        batchTimeout.current = undefined;
      }
      
      await saveBatch(batch);
    }
  }, [saveBatch]);

  const addCompletedShipment = useCallback(async (completed: CompletedShipment) => {
    pendingShipments.current.push(completed);

    // Check if we should save immediately due to batch size
    if (pendingShipments.current.length >= batchSize) {
      await flushPendingBatch();
      return;
    }

    // Set/reset timeout for batch saving
    if (batchTimeout.current) {
      clearTimeout(batchTimeout.current);
    }
    
    batchTimeout.current = setTimeout(() => {
      flushPendingBatch();
    }, batchTimeoutMs);
  }, [batchSize, batchTimeoutMs, flushPendingBatch]);

  const finalizeBatching = useCallback(async () => {
    // Clear any pending timeout
    if (batchTimeout.current) {
      clearTimeout(batchTimeout.current);
      batchTimeout.current = undefined;
    }

    // Save any remaining shipments
    await flushPendingBatch();
  }, [flushPendingBatch]);

  return {
    addCompletedShipment,
    finalizeBatching,
    getPendingCount: () => pendingShipments.current.length
  };
}