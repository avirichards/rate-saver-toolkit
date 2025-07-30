import { useState, useCallback, useRef } from 'react';

interface BatchProcessorOptions {
  batchSize: number;
  maxConcurrent: number;
  delayBetweenBatches: number;
}

interface BatchProcessorState {
  isProcessing: boolean;
  currentBatch: number;
  totalBatches: number;
  processedItems: number;
  totalItems: number;
  progress: number;
}

export function useBatchProcessor<T, R>(
  processFn: (items: T[]) => Promise<R[]>,
  options: BatchProcessorOptions = {
    batchSize: 50,
    maxConcurrent: 3,
    delayBetweenBatches: 10
  }
) {
  const [state, setState] = useState<BatchProcessorState>({
    isProcessing: false,
    currentBatch: 0,
    totalBatches: 0,
    processedItems: 0,
    totalItems: 0,
    progress: 0
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const processBatches = useCallback(async (
    items: T[],
    onBatchComplete?: (results: R[], batchIndex: number) => void,
    onProgress?: (progress: number) => void
  ): Promise<R[]> => {
    if (state.isProcessing) {
      throw new Error('Batch processing already in progress');
    }

    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;

    const totalBatches = Math.ceil(items.length / options.batchSize);
    
    setState({
      isProcessing: true,
      currentBatch: 0,
      totalBatches,
      processedItems: 0,
      totalItems: items.length,
      progress: 0
    });

    const allResults: R[] = [];
    const batches: T[][] = [];

    // Create batches
    for (let i = 0; i < items.length; i += options.batchSize) {
      batches.push(items.slice(i, i + options.batchSize));
    }

    try {
      // Process batches with concurrency control
      for (let i = 0; i < batches.length; i += options.maxConcurrent) {
        if (signal.aborted) break;

        const currentBatches = batches.slice(i, i + options.maxConcurrent);
        const batchPromises = currentBatches.map(async (batch, batchIndex) => {
          const actualBatchIndex = i + batchIndex;
          
          if (signal.aborted) return [];
          
          const results = await processFn(batch);
          
          setState(prev => {
            const newProcessedItems = prev.processedItems + batch.length;
            const newProgress = (newProcessedItems / prev.totalItems) * 100;
            
            return {
              ...prev,
              currentBatch: actualBatchIndex + 1,
              processedItems: newProcessedItems,
              progress: newProgress
            };
          });

          onBatchComplete?.(results, actualBatchIndex);
          const currentProgress = ((state.processedItems + batch.length) / items.length) * 100;
          onProgress?.(currentProgress);
          
          return results;
        });

        const batchResults = await Promise.all(batchPromises);
        allResults.push(...batchResults.flat());

        // Add delay between batch groups
        if (i + options.maxConcurrent < batches.length && !signal.aborted) {
          await new Promise(resolve => setTimeout(resolve, options.delayBetweenBatches));
        }
      }

      setState(prev => ({
        ...prev,
        isProcessing: false,
        progress: 100
      }));

      return allResults;
    } catch (error) {
      setState(prev => ({
        ...prev,
        isProcessing: false
      }));
      throw error;
    }
  }, [state.isProcessing, options, processFn]);

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setState(prev => ({
        ...prev,
        isProcessing: false
      }));
    }
  }, []);

  const reset = useCallback(() => {
    setState({
      isProcessing: false,
      currentBatch: 0,
      totalBatches: 0,
      processedItems: 0,
      totalItems: 0,
      progress: 0
    });
  }, []);

  return {
    state,
    processBatches,
    abort,
    reset
  };
}