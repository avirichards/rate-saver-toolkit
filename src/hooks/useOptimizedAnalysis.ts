import { useState, useCallback, useMemo } from 'react';
import { useBatchProcessor } from './useBatchProcessor';

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
  
  const batchProcessor = useBatchProcessor<ProcessedShipment, AnalysisResult>(
    async (shipments) => {
      // This will be the actual analysis function
      return await analyzeShipmentBatch(shipments);
    },
    {
      batchSize: 10, // Smaller batches for real-time updates
      maxConcurrent: 3,
      delayBetweenBatches: 100
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
    // Initialize results with pending status
    const initialResults = shipments.map(shipment => ({
      shipment,
      status: 'pending' as const
    }));
    setResults(initialResults);

    // Process in batches with real-time updates
    await batchProcessor.processBatches(
      shipments,
      (batchResults, batchIndex) => {
        // Update results as each batch completes
        setResults(prev => {
          const newResults = [...prev];
          batchResults.forEach((result, idx) => {
            const globalIndex = batchIndex * 10 + idx; // Assuming batch size of 10
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

// Mock analysis function - replace with actual implementation
async function analyzeShipmentBatch(shipments: ProcessedShipment[]): Promise<AnalysisResult[]> {
  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 100));
  
  return shipments.map(shipment => ({
    shipment,
    status: 'completed' as const,
    currentCost: Math.random() * 50,
    savings: (Math.random() - 0.5) * 20,
    bestRate: {
      serviceName: 'Mock Service',
      cost: Math.random() * 40
    }
  }));
}