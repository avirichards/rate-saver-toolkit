import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './Card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Zap, BarChart3, Clock, CheckCircle, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';

interface PerformanceMetrics {
  averageResponseTime: number;
  successRate: number;
  errorRate: number;
  carrierPerformance: Record<string, { avgTime: number; successRate: number }>;
}

interface PerformanceMonitorProps {
  metrics: PerformanceMetrics;
  isAnalyzing: boolean;
  currentBatch?: number;
  totalBatches?: number;
  performanceMode: 'balanced' | 'speed' | 'reliability';
}

export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  metrics,
  isAnalyzing,
  currentBatch,
  totalBatches,
  performanceMode
}) => {
  const getPerformanceColor = (value: number, threshold: number) => {
    if (value >= threshold * 0.8) return 'text-green-600';
    if (value >= threshold * 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getPerformanceModeInfo = () => {
    switch (performanceMode) {
      case 'speed':
        return { icon: TrendingUp, color: 'text-blue-600', description: 'Optimized for speed' };
      case 'reliability':
        return { icon: CheckCircle, color: 'text-green-600', description: 'Optimized for reliability' };
      default:
        return { icon: Zap, color: 'text-yellow-600', description: 'Balanced performance' };
    }
  };

  const modeInfo = getPerformanceModeInfo();

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5" />
            <span>Performance Monitor</span>
          </CardTitle>
          <Badge variant="outline" className="flex items-center space-x-1">
            <modeInfo.icon className="h-3 w-3" />
            <span>{performanceMode}</span>
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Response Time */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Avg Response Time</span>
              <span className={`text-sm font-bold ${getPerformanceColor(metrics.averageResponseTime, 2000)}`}>
                {metrics.averageResponseTime.toFixed(0)}ms
              </span>
            </div>
            <Progress 
              value={Math.min((metrics.averageResponseTime / 3000) * 100, 100)} 
              className="h-2"
            />
            <p className="text-xs text-gray-500">
              {metrics.averageResponseTime < 1000 ? 'Excellent' : 
               metrics.averageResponseTime < 2000 ? 'Good' : 
               metrics.averageResponseTime < 3000 ? 'Fair' : 'Poor'}
            </p>
          </div>

          {/* Success Rate */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Success Rate</span>
              <span className={`text-sm font-bold ${getPerformanceColor(metrics.successRate * 100, 95)}`}>
                {(metrics.successRate * 100).toFixed(1)}%
              </span>
            </div>
            <Progress 
              value={metrics.successRate * 100} 
              className="h-2"
            />
            <p className="text-xs text-gray-500">
              {metrics.successRate > 0.95 ? 'Excellent' : 
               metrics.successRate > 0.85 ? 'Good' : 
               metrics.successRate > 0.75 ? 'Fair' : 'Poor'}
            </p>
          </div>

          {/* Error Rate */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Error Rate</span>
              <span className={`text-sm font-bold ${metrics.errorRate > 0.1 ? 'text-red-600' : 'text-green-600'}`}>
                {(metrics.errorRate * 100).toFixed(1)}%
              </span>
            </div>
            <Progress 
              value={metrics.errorRate * 100} 
              className="h-2"
            />
            <p className="text-xs text-gray-500">
              {metrics.errorRate < 0.05 ? 'Excellent' : 
               metrics.errorRate < 0.15 ? 'Good' : 
               metrics.errorRate < 0.25 ? 'Fair' : 'Poor'}
            </p>
          </div>
        </div>

        {/* Carrier Performance */}
        {Object.keys(metrics.carrierPerformance).length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <h4 className="text-sm font-medium mb-3">Carrier Performance</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(metrics.carrierPerformance).map(([carrier, perf]) => (
                <div key={carrier} className="text-center p-2 bg-gray-50 rounded">
                  <div className="text-xs font-medium text-gray-600">{carrier.toUpperCase()}</div>
                  <div className="text-sm font-bold">{perf.avgTime.toFixed(0)}ms</div>
                  <div className="text-xs text-gray-500">{(perf.successRate * 100).toFixed(0)}% success</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Batch Progress */}
        {isAnalyzing && currentBatch && totalBatches && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Batch Progress</span>
              <span className="text-sm text-gray-600">
                {currentBatch} / {totalBatches}
              </span>
            </div>
            <Progress 
              value={(currentBatch / totalBatches) * 100} 
              className="h-2"
            />
          </div>
        )}

        {/* Performance Mode Description */}
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <modeInfo.icon className={`h-4 w-4 ${modeInfo.color}`} />
            <span>{modeInfo.description}</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {performanceMode === 'speed' && 'Larger batches, higher concurrency for faster processing'}
            {performanceMode === 'reliability' && 'Smaller batches, lower concurrency for better error handling'}
            {performanceMode === 'balanced' && 'Adaptive configuration based on performance metrics'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}; 