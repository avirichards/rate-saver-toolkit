import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { Button } from '@/components/ui-lov/Button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Bug, AlertCircle } from 'lucide-react';
import type { ValidationState } from '@/hooks/useShipmentValidation';

interface ValidationDebuggerProps {
  validationState: ValidationState;
  shipments: any[];
  className?: string;
}

export const ValidationDebugger: React.FC<ValidationDebuggerProps> = ({
  validationState,
  shipments,
  className
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedErrors, setSelectedErrors] = useState<string[]>([]);
  
  const { results } = validationState;

  // Get failed shipments with their errors
  const failedShipments = Object.entries(results)
    .filter(([_, result]) => !result.isValid)
    .slice(0, 10) // Show first 10 failed shipments
    .map(([index, result]) => ({
      index: parseInt(index),
      shipment: shipments[parseInt(index)],
      result
    }));

  // Get error field frequency
  const errorFrequency: Record<string, { count: number; samples: string[] }> = {};
  Object.values(results).forEach((result, shipmentIndex) => {
    Object.entries(result.errors).forEach(([field, errors]) => {
      if (!errorFrequency[field]) {
        errorFrequency[field] = { count: 0, samples: [] };
      }
      errorFrequency[field].count++;
      if (errorFrequency[field].samples.length < 3) {
        errorFrequency[field].samples.push(`Shipment ${shipmentIndex + 1}: ${errors[0]}`);
      }
    });
  });

  if (failedShipments.length === 0) {
    return null;
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bug className="h-5 w-5 text-orange-500" />
          Validation Debugger
          <Badge variant="secondary" className="ml-auto">
            {failedShipments.length} samples shown
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              {isExpanded ? 'Hide' : 'Show'} Failed Shipment Details
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          
          <CollapsibleContent className="mt-4 space-y-4">
            {/* Error Frequency Analysis */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-gray-900">Error Analysis by Field:</h4>
              {Object.entries(errorFrequency)
                .sort(([,a], [,b]) => b.count - a.count)
                .map(([field, data]) => (
                  <div key={field} className="p-3 bg-red-50 border border-red-200 rounded">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-red-900">{field}</span>
                      <Badge variant="destructive" className="text-xs">
                        {data.count} failures
                      </Badge>
                    </div>
                    <div className="text-xs text-red-700 space-y-1">
                      {data.samples.map((sample, idx) => (
                        <div key={idx}>• {sample}</div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>

            {/* Sample Failed Shipments */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-gray-900">Sample Failed Shipments:</h4>
              {failedShipments.map(({ index, shipment, result }) => (
                <div key={index} className="p-3 bg-gray-50 border rounded">
                  <div className="flex items-start justify-between mb-2">
                    <span className="font-medium text-gray-900">Shipment #{index + 1}</span>
                    <Badge variant="outline" className="text-xs">
                      {Object.keys(result.errors).length} errors
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div>
                      <strong>Data:</strong>
                      <div className="mt-1 space-y-1 text-gray-600">
                        <div>Origin ZIP: {shipment?.originZip || 'missing'}</div>
                        <div>Dest ZIP: {shipment?.destZip || 'missing'}</div>
                        <div>Weight: {shipment?.weight || 'missing'}</div>
                        <div>Current Rate: {shipment?.currentRate || 'missing'}</div>
                      </div>
                    </div>
                    
                    <div>
                      <strong>Errors:</strong>
                      <div className="mt-1 space-y-1">
                        {Object.entries(result.errors).map(([field, errors]) => (
                          <div key={field} className="text-red-600">
                            <AlertCircle className="h-3 w-3 inline mr-1" />
                            {field}: {errors[0]}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
};