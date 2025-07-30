import { useState, useCallback, useMemo } from 'react';
import { useBatchProcessor } from './useBatchProcessor';
import { supabase } from '@/integrations/supabase/client';

interface ProcessedShipment {
  id: number;
  trackingId?: string;
  service?: string;
  carrier?: string;
  weight?: string;
  weightUnit?: string;
  currentRate?: string;
  originZip?: string;
  destZip?: string;
  length?: string;
  width?: string;
  height?: string;
  shipperName?: string;
  shipperAddress?: string;
  shipperCity?: string;
  shipperState?: string;
  recipientName?: string;
  recipientAddress?: string;
  recipientCity?: string;
  recipientState?: string;
  zone?: string;
}

interface AnalysisResult {
  shipment: ProcessedShipment;
  status: 'pending' | 'processing' | 'completed' | 'error';
  currentCost?: number;
  originalService?: string;
  bestRate?: any;
  savings?: number;
  error?: string;
  errorType?: string;
  errorCategory?: string;
}

interface AnalysisSummary {
  totalShipments: number;
  completed: number;
  errors: number;
  pending: number;
  totalSavings: number;
  totalCurrentCost: number;
}

export function useOptimizedAnalysis() {
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [currentCarriers, setCurrentCarriers] = useState<string[]>([]);
  const [currentServiceMappings, setCurrentServiceMappings] = useState<any[]>([]);
  const [analysisId, setAnalysisId] = useState<string>('');
  
  // Create batch processor with proper dependencies
  const batchProcessor = useBatchProcessor<ProcessedShipment, AnalysisResult>(
    useCallback(async (shipments) => {
      return await analyzeShipmentBatch(shipments, currentCarriers, currentServiceMappings, analysisId);
    }, [currentCarriers, currentServiceMappings, analysisId]),
    {
      batchSize: 5, // Smaller batches for real-time updates and API rate limits
      maxConcurrent: 2, // Reduce concurrent calls to avoid overwhelming API
      delayBetweenBatches: 200 // Add delay to respect API rate limits
    }
  );

  const summary = useMemo((): AnalysisSummary => {
    const completed = results.filter(r => r.status === 'completed').length;
    const errors = results.filter(r => r.status === 'error').length;
    const pending = results.filter(r => r.status === 'pending').length;
    
    const totalSavings = results
      .filter(r => r.status === 'completed' && r.savings)
      .reduce((sum, r) => sum + (r.savings || 0), 0);
    
    const totalCurrentCost = results
      .filter(r => r.status === 'completed' && r.currentCost)
      .reduce((sum, r) => sum + (r.currentCost || 0), 0);

    return {
      totalShipments: results.length,
      completed,
      errors,
      pending,
      totalSavings,
      totalCurrentCost
    };
  }, [results]);

  const startAnalysis = useCallback(async (
    shipments: ProcessedShipment[],
    selectedCarriers: string[],
    serviceMappings: any[]
  ) => {
    // Generate a unique analysis ID for this batch
    const newAnalysisId = `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Store current analysis parameters
    setCurrentCarriers(selectedCarriers);
    setCurrentServiceMappings(serviceMappings);
    setAnalysisId(newAnalysisId);
    
    // Initialize results with pending status
    const initialResults = shipments.map(shipment => ({
      shipment,
      status: 'pending' as const
    }));
    setResults(initialResults);

    // Wait a brief moment for state to update before starting processing
    await new Promise(resolve => setTimeout(resolve, 50));

    // Process in batches with real-time updates
    await batchProcessor.processBatches(
      shipments,
      (batchResults, batchIndex) => {
        // Update results as each batch completes
        setResults(prev => {
          const newResults = [...prev];
          batchResults.forEach((result, idx) => {
            const globalIndex = batchIndex * 5 + idx; // Use correct batch size of 5
            if (globalIndex < newResults.length) {
              newResults[globalIndex] = result;
            }
          });
          return newResults;
        });
      }
    );
  }, [batchProcessor]);

  const pauseAnalysis = useCallback(() => {
    setIsPaused(true);
    batchProcessor.abort();
  }, [batchProcessor]);

  const resumeAnalysis = useCallback(() => {
    setIsPaused(false);
    // Resume logic would go here
  }, []);

  const clearResults = useCallback(() => {
    setResults([]);
    batchProcessor.reset();
    setIsPaused(false);
  }, [batchProcessor]);

  return {
    results,
    summary,
    isProcessing: batchProcessor.state.isProcessing,
    progress: batchProcessor.state.progress,
    isPaused,
    startAnalysis,
    pauseAnalysis,
    resumeAnalysis,
    clearResults
  };
}

// Real analysis function using Supabase multi-carrier-quote API
async function analyzeShipmentBatch(
  shipments: ProcessedShipment[], 
  selectedCarriers: string[], 
  serviceMappings: any[],
  analysisId: string
): Promise<AnalysisResult[]> {

  const results: AnalysisResult[] = [];

  for (const shipment of shipments) {
    try {
      // Convert shipment to API format
      const shipmentRequest = {
        shipFrom: {
          zipCode: shipment.originZip || '',
          city: shipment.shipperCity || '',
          state: shipment.shipperState || '',
          address: shipment.shipperAddress || ''
        },
        shipTo: {
          zipCode: shipment.destZip || '',
          city: shipment.recipientCity || '',
          state: shipment.recipientState || '',
          address: shipment.recipientAddress || ''
        },
        weight: parseFloat(shipment.weight || '0'),
        weightUnit: shipment.weightUnit || 'LBS',
        dimensions: {
          length: parseFloat(shipment.length || '0'),
          width: parseFloat(shipment.width || '0'),
          height: parseFloat(shipment.height || '0')
        },
        service: shipment.service,
        carrier: shipment.carrier,
        currentRate: parseFloat(shipment.currentRate || '0')
      };

      const { data, error } = await supabase.functions.invoke('multi-carrier-quote', {
        body: { 
          shipment: {
            ...shipmentRequest,
            carrierConfigIds: selectedCarriers,
            analysisId: analysisId,
            shipmentIndex: shipment.id
          }
        }
      });

      if (error) {
        results.push({
          shipment,
          status: 'error',
          error: error.message,
          errorType: 'api_error'
        });
      } else if (data?.bestRates?.length > 0) {
        const bestRate = data.bestRates[0];
        const currentCost = shipmentRequest.currentRate;
        const savings = currentCost - bestRate.cost;

        results.push({
          shipment,
          status: 'completed',
          currentCost,
          savings,
          bestRate: {
            serviceName: bestRate.serviceName,
            cost: bestRate.cost,
            carrier: bestRate.carrier
          }
        });
      } else {
        results.push({
          shipment,
          status: 'error',
          error: 'No rates returned',
          errorType: 'no_rates'
        });
      }
    } catch (error) {
      results.push({
        shipment,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        errorType: 'processing_error'
      });
    }
  }

  return results;
}