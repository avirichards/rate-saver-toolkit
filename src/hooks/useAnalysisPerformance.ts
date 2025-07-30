import { useState, useCallback, useRef } from 'react';

interface PerformanceMetrics {
  averageResponseTime: number;
  successRate: number;
  errorRate: number;
  carrierPerformance: Record<string, { avgTime: number; successRate: number }>;
}

interface BatchConfig {
  size: number;
  concurrency: number;
  delayBetweenBatches: number;
  retryDelay: number;
}

export const useAnalysisPerformance = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    averageResponseTime: 0,
    successRate: 0,
    errorRate: 0,
    carrierPerformance: {}
  });

  const performanceHistory = useRef<{
    responseTimes: number[];
    errors: string[];
    carrierTimes: Record<string, number[]>;
  }>({
    responseTimes: [],
    errors: [],
    carrierTimes: {}
  });

  // Adaptive batch configuration based on performance metrics
  const getOptimalBatchConfig = useCallback((totalShipments: number): BatchConfig => {
    const avgResponseTime = metrics.averageResponseTime;
    const successRate = metrics.successRate;
    
    // Adaptive batch sizing based on performance
    let batchSize = 25; // Default
    let concurrency = 5; // Default
    
    if (avgResponseTime < 1000 && successRate > 0.95) {
      // Fast, reliable performance - increase batch size
      batchSize = Math.min(50, Math.floor(totalShipments / 10));
      concurrency = 8;
    } else if (avgResponseTime > 3000 || successRate < 0.8) {
      // Slow or unreliable - reduce batch size
      batchSize = Math.max(10, Math.floor(totalShipments / 20));
      concurrency = 3;
    } else {
      // Moderate performance
      batchSize = Math.min(35, Math.floor(totalShipments / 15));
      concurrency = 5;
    }

    return {
      size: batchSize,
      concurrency,
      delayBetweenBatches: Math.max(50, Math.min(200, avgResponseTime / 10)),
      retryDelay: Math.max(1000, avgResponseTime * 2)
    };
  }, [metrics]);

  // Track performance metrics
  const trackPerformance = useCallback((carrier: string, responseTime: number, success: boolean, error?: string) => {
    performanceHistory.current.responseTimes.push(responseTime);
    
    if (!performanceHistory.current.carrierTimes[carrier]) {
      performanceHistory.current.carrierTimes[carrier] = [];
    }
    performanceHistory.current.carrierTimes[carrier].push(responseTime);
    
    if (!success && error) {
      performanceHistory.current.errors.push(error);
    }

    // Update metrics (keep last 100 measurements for rolling average)
    const recentTimes = performanceHistory.current.responseTimes.slice(-100);
    const recentErrors = performanceHistory.current.errors.slice(-100);
    
    setMetrics(prev => ({
      averageResponseTime: recentTimes.reduce((a, b) => a + b, 0) / recentTimes.length,
      successRate: 1 - (recentErrors.length / recentTimes.length),
      errorRate: recentErrors.length / recentTimes.length,
      carrierPerformance: Object.fromEntries(
        Object.entries(performanceHistory.current.carrierTimes).map(([carrier, times]) => [
          carrier,
          {
            avgTime: times.slice(-20).reduce((a, b) => a + b, 0) / Math.min(times.length, 20),
            successRate: 0.95 // Placeholder - would need error tracking per carrier
          }
        ])
      )
    }));
  }, []);

  // Intelligent concurrency control
  const createConcurrencyController = useCallback((maxConcurrency: number) => {
    let running = 0;
    const queue: Array<() => Promise<any>> = [];
    
    const execute = async (task: () => Promise<any>) => {
      if (running >= maxConcurrency) {
        // Wait for a slot to open
        await new Promise<void>(resolve => {
          queue.push(async () => {
            try {
              await task();
            } finally {
              running--;
              if (queue.length > 0) {
                const nextTask = queue.shift()!;
                running++;
                nextTask();
              }
              resolve();
            }
          });
        });
      } else {
        running++;
        try {
          await task();
        } finally {
          running--;
          if (queue.length > 0) {
            const nextTask = queue.shift()!;
            running++;
            nextTask();
          }
        }
      }
    };

    return execute;
  }, []);

  // Smart retry logic with exponential backoff
  const createRetryHandler = useCallback((maxRetries: number, baseDelay: number) => {
    return async <T>(
      operation: () => Promise<T>,
      retryCount = 0
    ): Promise<T> => {
      try {
        return await operation();
      } catch (error: any) {
        if (retryCount >= maxRetries) {
          throw error;
        }

        const isRetryable = error.message?.includes('timeout') || 
                           error.message?.includes('network') ||
                           error.message?.includes('500') ||
                           error.message?.includes('503') ||
                           error.message?.includes('429');

        if (!isRetryable) {
          throw error;
        }

        const delay = baseDelay * Math.pow(2, retryCount);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return createRetryHandler(maxRetries, baseDelay)(operation, retryCount + 1);
      }
    };
  }, []);

  return {
    metrics,
    getOptimalBatchConfig,
    trackPerformance,
    createConcurrencyController,
    createRetryHandler
  };
}; 