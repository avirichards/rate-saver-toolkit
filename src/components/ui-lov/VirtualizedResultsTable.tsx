import React, { useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';
import { Card, CardContent } from '@/components/ui-lov/Card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, RotateCw, DollarSign } from 'lucide-react';
import { formatCurrency, getSavingsColor } from '@/lib/utils';

interface AnalysisResult {
  shipment: any;
  status: 'pending' | 'processing' | 'completed' | 'error';
  currentCost?: number;
  originalService?: string;
  bestRate?: any;
  savings?: number;
  error?: string;
}

interface VirtualizedResultsTableProps {
  results: AnalysisResult[];
  height: number;
}

const ResultRow = React.memo(({ index, style, data }: { index: number; style: React.CSSProperties; data: AnalysisResult[] }) => {
  const result = data[index];
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'processing':
        return <RotateCw className="h-4 w-4 text-blue-600 animate-spin" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <div className="h-4 w-4 rounded-full bg-muted" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      completed: 'default',
      processing: 'secondary',
      error: 'destructive',
      pending: 'outline'
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'outline'}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  return (
    <div style={style} className="px-2">
      <Card className="mb-2">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {getStatusIcon(result.status)}
              <div>
                <div className="font-medium">
                  {result.shipment.trackingId || `Shipment ${result.shipment.id}`}
                </div>
                <div className="text-sm text-muted-foreground">
                  {result.originalService || result.shipment.service}
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {result.status === 'completed' && result.savings !== undefined && (
                <div className="text-right">
                  <div className="flex items-center space-x-1">
                    <DollarSign className="h-4 w-4" />
                    <span className={getSavingsColor(result.savings)}>
                      {formatCurrency(result.savings)}
                    </span>
                  </div>
                  {result.bestRate && (
                    <div className="text-sm text-muted-foreground">
                      {result.bestRate.serviceName}
                    </div>
                  )}
                </div>
              )}
              
              {result.status === 'error' && (
                <div className="text-sm text-red-600 max-w-xs truncate">
                  {result.error}
                </div>
              )}
              
              {getStatusBadge(result.status)}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

ResultRow.displayName = 'ResultRow';

export const VirtualizedResultsTable: React.FC<VirtualizedResultsTableProps> = ({ 
  results, 
  height 
}) => {
  const memoizedResults = useMemo(() => results, [results]);

  return (
    <div className="border rounded-lg">
      <List
        height={height}
        width="100%"
        itemCount={memoizedResults.length}
        itemSize={120}
        itemData={memoizedResults}
        overscanCount={5}
      >
        {ResultRow}
      </List>
    </div>
  );
};