import React, { memo } from 'react';
import { FixedSizeList as List } from 'react-window';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, RotateCw, AlertCircle, DollarSign } from 'lucide-react';

interface AnalysisResult {
  shipment: any;
  status: 'pending' | 'processing' | 'completed' | 'error';
  currentCost?: number;
  savings?: number;
  error?: string;
}

interface VirtualizedAnalysisResultsProps {
  results: AnalysisResult[];
  height: number;
}

const ResultRow = memo(({ index, style, data }: { index: number; style: any; data: AnalysisResult[] }) => {
  const result = data[index];
  
  const getStatusIcon = () => {
    switch (result.status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'processing':
        return <RotateCw className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <div className="h-4 w-4 rounded-full bg-gray-300" />;
    }
  };

  return (
    <div style={style} className="flex items-center gap-4 px-4 py-2 border-b">
      <div className="flex items-center gap-2 min-w-[200px]">
        {getStatusIcon()}
        <span className="text-sm font-medium">
          {result.shipment.trackingId || `Shipment ${result.shipment.id}`}
        </span>
      </div>
      
      <div className="flex-1 text-sm text-muted-foreground">
        {result.shipment.service} | {result.shipment.originZip} → {result.shipment.destZip}
      </div>
      
      {result.status === 'completed' && (
        <div className="flex items-center gap-4">
          <div className="text-sm">
            Current: ${result.currentCost?.toFixed(2) || '0.00'}
          </div>
          {result.savings && result.savings > 0 && (
            <div className="flex items-center gap-1 text-green-600">
              <DollarSign className="h-3 w-3" />
              <span className="text-sm font-medium">
                ${result.savings.toFixed(2)} saved
              </span>
            </div>
          )}
        </div>
      )}
      
      {result.status === 'error' && (
        <Badge variant="destructive" className="text-xs">
          {result.error?.split(':')[0] || 'Error'}
        </Badge>
      )}
    </div>
  );
});

ResultRow.displayName = 'ResultRow';

export const VirtualizedAnalysisResults: React.FC<VirtualizedAnalysisResultsProps> = memo(({ 
  results, 
  height 
}) => {
  if (results.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground">
        No results to display
      </div>
    );
  }

  return (
    <List
      height={height}
      width="100%"
      itemCount={results.length}
      itemSize={60}
      itemData={results}
      className="border rounded-md"
    >
      {ResultRow}
    </List>
  );
});

VirtualizedAnalysisResults.displayName = 'VirtualizedAnalysisResults';