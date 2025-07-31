/**
 * Data Stream Processor for Large Dataset Analysis
 * Handles streaming, chunking, and progressive processing of large datasets
 */

import { supabase } from '@/integrations/supabase/client';

export interface StreamingProcessorConfig {
  chunkSize: number;
  maxConcurrentChunks: number;
  retryAttempts: number;
  progressCallback?: (progress: StreamingProgress) => void;
}

export interface StreamingProgress {
  processedChunks: number;
  totalChunks: number;
  processedItems: number;
  totalItems: number;
  currentStatus: 'processing' | 'paused' | 'completed' | 'error';
  estimatedTimeRemaining?: number;
  error?: string;
}

export interface AnalysisChunk {
  chunkIndex: number;
  totalChunks: number;
  analysisId: string;
  data: any[];
}

export class DataStreamProcessor {
  private config: StreamingProcessorConfig;
  private abortController: AbortController;
  private startTime: number;

  constructor(config: Partial<StreamingProcessorConfig> = {}) {
    this.config = {
      chunkSize: 500, // Process 500 shipments at a time to reduce memory pressure
      maxConcurrentChunks: 3, // Max 3 concurrent requests
      retryAttempts: 3,
      ...config
    };
    this.abortController = new AbortController();
    this.startTime = Date.now();
  }

  /**
   * Stream analysis data in optimized chunks
   */
  async streamAnalysis(analysisData: any): Promise<string> {
    const { recommendations, orphanedShipments, ...baseData } = analysisData;
    const totalItems = recommendations.length;
    const totalChunks = Math.ceil(totalItems / this.config.chunkSize);

    console.log(`🚀 Starting streaming analysis for ${totalItems} items in ${totalChunks} chunks`);

    // Create initial analysis record with streaming metadata
    const analysisId = await this.createStreamingAnalysisRecord(baseData, totalItems, totalChunks);

    // Process chunks with concurrency control
    const chunks = this.createChunks(recommendations, analysisId, totalChunks);
    await this.processConcurrentChunks(chunks, orphanedShipments, analysisId);

    // Finalize the analysis
    await this.finalizeStreamingAnalysis(analysisId, orphanedShipments, baseData);

    return analysisId;
  }

  /**
   * Create optimized chunks for processing
   */
  private createChunks(recommendations: any[], analysisId: string, totalChunks: number): AnalysisChunk[] {
    const chunks: AnalysisChunk[] = [];
    
    for (let i = 0; i < totalChunks; i++) {
      const start = i * this.config.chunkSize;
      const end = Math.min(start + this.config.chunkSize, recommendations.length);
      
      chunks.push({
        chunkIndex: i,
        totalChunks,
        analysisId,
        data: recommendations.slice(start, end)
      });
    }
    
    return chunks;
  }

  /**
   * Process chunks with controlled concurrency
   */
  private async processConcurrentChunks(chunks: AnalysisChunk[], orphanedShipments: any[], analysisId: string): Promise<void> {
    const semaphore = new Semaphore(this.config.maxConcurrentChunks);
    const promises: Promise<void>[] = [];

    for (const chunk of chunks) {
      const promise = semaphore.acquire().then(async (release) => {
        try {
          await this.processChunk(chunk);
          this.updateProgress(chunk.chunkIndex + 1, chunks.length, chunk.data.length);
        } finally {
          release();
        }
      });
      promises.push(promise);
    }

    await Promise.all(promises);
  }

  /**
   * Process a single chunk via edge function
   */
  private async processChunk(chunk: AnalysisChunk): Promise<void> {
    let attempt = 0;
    
    while (attempt < this.config.retryAttempts) {
      try {
        const { error } = await supabase.functions.invoke('process-analysis-chunk', {
          body: {
            chunkIndex: chunk.chunkIndex,
            totalChunks: chunk.totalChunks,
            analysisId: chunk.analysisId,
            recommendations: chunk.data,
            processingType: 'streaming_chunk'
          }
        });

        if (error) throw error;
        return; // Success, exit retry loop
        
      } catch (error) {
        attempt++;
        console.warn(`Chunk ${chunk.chunkIndex} failed attempt ${attempt}:`, error);
        
        if (attempt >= this.config.retryAttempts) {
          throw new Error(`Chunk ${chunk.chunkIndex} failed after ${this.config.retryAttempts} attempts: ${error}`);
        }
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  /**
   * Create streaming analysis record with optimized structure
   */
  private async createStreamingAnalysisRecord(baseData: any, totalItems: number, totalChunks: number): Promise<string> {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('shipping_analyses')
      .insert({
        user_id: user.id,
        file_name: baseData.fileName,
        original_data: [], // Will be populated during streaming
        total_shipments: baseData.totalShipments,
        total_savings: baseData.totalPotentialSavings,
        status: 'streaming',
        processing_metadata: {
          processingType: 'streaming',
          totalChunks,
          processedChunks: 0,
          startTime: new Date().toISOString(),
          chunkSize: this.config.chunkSize
        },
        savings_analysis: {
          totalCurrentCost: baseData.totalCurrentCost,
          totalPotentialSavings: baseData.totalPotentialSavings,
          savingsPercentage: baseData.totalCurrentCost > 0 ? (baseData.totalPotentialSavings / baseData.totalCurrentCost) * 100 : 0,
          totalShipments: baseData.totalShipments,
          completedShipments: baseData.completedShipments,
          errorShipments: baseData.errorShipments,
        },
        carrier_configs_used: baseData.carrierConfigsUsed,
        service_mappings: baseData.serviceMappings || []
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to create streaming analysis record: ${error.message}`);
    }

    return data.id;
  }

  /**
   * Finalize the streaming analysis
   */
  private async finalizeStreamingAnalysis(analysisId: string, orphanedShipments: any[], baseData: any): Promise<void> {
    // Update analysis status to completed
    const { error } = await supabase
      .from('shipping_analyses')
      .update({
        status: 'completed',
        orphaned_shipments: orphanedShipments,
        processing_metadata: {
          processingType: 'streaming',
          completedAt: new Date().toISOString(),
          totalProcessingTime: Date.now() - this.startTime
        }
      })
      .eq('id', analysisId);

    if (error) {
      throw new Error(`Failed to finalize streaming analysis: ${error.message}`);
    }
  }

  /**
   * Update progress and notify callback
   */
  private updateProgress(processedChunks: number, totalChunks: number, itemsInChunk: number): void {
    const progress: StreamingProgress = {
      processedChunks,
      totalChunks,
      processedItems: processedChunks * this.config.chunkSize,
      totalItems: totalChunks * this.config.chunkSize,
      currentStatus: 'processing',
      estimatedTimeRemaining: this.calculateETA(processedChunks, totalChunks)
    };

    this.config.progressCallback?.(progress);
  }

  /**
   * Calculate estimated time remaining
   */
  private calculateETA(processed: number, total: number): number {
    if (processed === 0) return 0;
    
    const elapsed = Date.now() - this.startTime;
    const avgTimePerChunk = elapsed / processed;
    const remaining = total - processed;
    
    return remaining * avgTimePerChunk;
  }

  /**
   * Abort the streaming process
   */
  abort(): void {
    this.abortController.abort();
  }
}

/**
 * Semaphore for controlling concurrency
 */
class Semaphore {
  private permits: number;
  private waiting: (() => void)[] = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<() => void> {
    return new Promise((resolve) => {
      if (this.permits > 0) {
        this.permits--;
        resolve(() => this.release());
      } else {
        this.waiting.push(() => {
          this.permits--;
          resolve(() => this.release());
        });
      }
    });
  }

  private release(): void {
    this.permits++;
    if (this.waiting.length > 0) {
      const next = this.waiting.shift()!;
      next();
    }
  }
}