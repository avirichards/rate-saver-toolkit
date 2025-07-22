import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, AlertTriangle, Shield } from 'lucide-react';
import type { ValidationState } from '@/hooks/useShipmentValidation';

interface ValidationSummaryProps {
  validationState: ValidationState;
  shipments: any[];
  className?: string;
}

export const ValidationSummary: React.FC<ValidationSummaryProps> = ({
  validationState,
  shipments,
  className
}) => {
  const { summary, results } = validationState;

  if (summary.total === 0) {
    return null;
  }

  // Get detailed validation breakdown
  const errorBreakdown: Record<string, number> = {};
  const warningBreakdown: Record<string, number> = {};

  Object.values(results).forEach(result => {
    // Count errors by field
    Object.keys(result.errors).forEach(field => {
      errorBreakdown[field] = (errorBreakdown[field] || 0) + 1;
    });
    
    // Count warnings by field
    Object.keys(result.warnings).forEach(field => {
      warningBreakdown[field] = (warningBreakdown[field] || 0) + 1;
    });
  });

  const savingsPercentage = summary.valid > 0 ? ((summary.valid / summary.total) * 100).toFixed(1) : '0';

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Validation Summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* High-level stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="flex items-center justify-center gap-2 mb-1">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="text-2xl font-bold text-green-900">{summary.valid}</span>
            </div>
            <p className="text-sm text-green-700">Valid Shipments</p>
            <p className="text-xs text-green-600">{savingsPercentage}% of total</p>
          </div>
          
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <div className="flex items-center justify-center gap-2 mb-1">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <span className="text-2xl font-bold text-red-900">{summary.invalid}</span>
            </div>
            <p className="text-sm text-red-700">Invalid Shipments</p>
            <p className="text-xs text-red-600">Will be skipped</p>
          </div>
          
          <div className="text-center p-3 bg-yellow-50 rounded-lg">
            <div className="flex items-center justify-center gap-2 mb-1">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <span className="text-2xl font-bold text-yellow-900">{summary.warnings}</span>
            </div>
            <p className="text-sm text-yellow-700">With Warnings</p>
            <p className="text-xs text-yellow-600">Still processable</p>
          </div>
        </div>

        {/* Error breakdown */}
        {Object.keys(errorBreakdown).length > 0 && (
          <div className="mb-4">
            <h4 className="font-medium text-sm mb-2 text-red-900">Common Validation Errors:</h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(errorBreakdown)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 5)
                .map(([field, count]) => (
                  <Badge key={field} variant="destructive" className="text-xs">
                    {field}: {count} shipments
                  </Badge>
                ))}
            </div>
          </div>
        )}

        {/* Warning breakdown */}
        {Object.keys(warningBreakdown).length > 0 && (
          <div className="mb-4">
            <h4 className="font-medium text-sm mb-2 text-yellow-900">Common Warnings:</h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(warningBreakdown)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 5)
                .map(([field, count]) => (
                  <Badge key={field} variant="secondary" className="text-xs bg-yellow-100 text-yellow-800">
                    {field}: {count} shipments
                  </Badge>
                ))}
            </div>
          </div>
        )}

        {/* Recommendations */}
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="font-medium text-sm mb-2 text-blue-900">Recommendations:</h4>
          <ul className="text-xs text-blue-700 space-y-1">
            {summary.invalid > 0 && (
              <li>• Review and fix validation errors to include more shipments in analysis</li>
            )}
            {summary.warnings > 0 && (
              <li>• Address warnings to improve rate accuracy</li>
            )}
            {summary.valid > 0 && (
              <li>• {summary.valid} shipments are ready for UPS rate comparison</li>
            )}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};