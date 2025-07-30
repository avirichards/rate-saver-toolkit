interface CacheKey {
  originZip: string;
  destZip: string;
  weight: number;
  length: number;
  width: number;
  height: number;
  serviceTypes: string[];
  carrierConfigIds: string[];
  isResidential: boolean;
}

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

class AnalysisCache {
  private cache = new Map<string, CacheEntry>();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 500;

  private generateCacheKey(request: CacheKey): string {
    const key = JSON.stringify({
      originZip: request.originZip,
      destZip: request.destZip,
      weight: Math.round(request.weight * 100) / 100, // Round to 2 decimal places
      length: Math.round(request.length),
      width: Math.round(request.width),
      height: Math.round(request.height),
      serviceTypes: request.serviceTypes.sort(),
      carrierConfigIds: request.carrierConfigIds.sort(),
      isResidential: request.isResidential
    });
    return btoa(key); // Base64 encode for shorter keys
  }

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }

    // If still too large, remove oldest entries
    if (this.cache.size > this.MAX_CACHE_SIZE) {
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = entries.slice(0, this.cache.size - this.MAX_CACHE_SIZE);
      toRemove.forEach(([key]) => this.cache.delete(key));
    }
  }

  get(request: CacheKey): any | null {
    this.cleanup();
    const key = this.generateCacheKey(request);
    const entry = this.cache.get(key);
    
    if (entry && !this.isExpired(entry)) {
      return entry.data;
    }
    
    if (entry) {
      this.cache.delete(key);
    }
    
    return null;
  }

  set(request: CacheKey, data: any, ttl?: number): void {
    this.cleanup();
    const key = this.generateCacheKey(request);
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.DEFAULT_TTL
    });
  }

  clear(): void {
    this.cache.clear();
  }
}

// Singleton instance
export const analysisCache = new AnalysisCache(); 