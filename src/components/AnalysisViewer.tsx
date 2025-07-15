import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { Button } from '@/components/ui-lov/Button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Eye, Users, DollarSign, TrendingDown, Package } from 'lucide-react';
import { useMarkupCalculation } from '@/hooks/useMarkupCalculation';
import { MarkupEditor } from '@/components/MarkupEditor';
import type { MarkupConfig } from '@/hooks/useShippingAnalyses';

interface AnalysisViewerProps {
  results: any[];
  markupConfig: MarkupConfig;
  reportName: string;
  clientName?: string;
  onUpdateMarkup?: (config: MarkupConfig) => void;
  showEditOptions?: boolean;
  activeView: 'internal' | 'client';
  availableServices: string[];
}

export function AnalysisViewer({ 
  results, 
  markupConfig, 
  reportName, 
  clientName,
  onUpdateMarkup,
  showEditOptions = true,
  activeView,
  availableServices
}: AnalysisViewerProps) {
  const { calculatedResults, totals } = useMarkupCalculation(results, markupConfig);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatPercentage = (percentage: number) => {
    return `${percentage.toFixed(1)}%`;
  };

  return (
    <div className="space-y-6">

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Total Shipments</span>
            </div>
            <div className="text-2xl font-bold mt-2">{calculatedResults.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Current Cost</span>
            </div>
            <div className="text-2xl font-bold mt-2">{formatCurrency(totals.totalCurrentCost)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {activeView === 'internal' ? 'Base UPS Rate' : 'Ship Pros Rate'}
              </span>
            </div>
            <div className="text-2xl font-bold mt-2">
              {formatCurrency(activeView === 'internal' ? totals.totalBaseUpsRate : totals.totalFinalRate)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium">Total Savings</span>
            </div>
            <div className="text-2xl font-bold mt-2 text-green-600">{formatCurrency(totals.totalSavings)}</div>
            <div className="text-sm text-muted-foreground">{formatPercentage(totals.savingsPercentage)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Internal View Only - Markup Configuration */}
      {activeView === 'internal' && onUpdateMarkup && (
        <Card>
          <CardHeader>
            <CardTitle>Markup Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <MarkupEditor 
              markupConfig={markupConfig}
              onUpdateMarkup={onUpdateMarkup}
              services={availableServices}
            />
          </CardContent>
        </Card>
      )}

      {/* Internal View Only - Margin Summary */}
      {activeView === 'internal' && (
        <Card>
          <CardHeader>
            <CardTitle>Margin Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="text-sm font-medium text-muted-foreground">Total Margin</div>
                <div className="text-xl font-bold">{formatCurrency(totals.totalMargin)}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Margin Percentage</div>
                <div className="text-xl font-bold">{formatPercentage(totals.marginPercentage)}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Markup Type</div>
                <div className="text-xl font-bold capitalize">{markupConfig.type.replace('-', ' ')}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Table */}
      <Card>
        <CardHeader>
          <CardTitle>Shipment Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2">Service</th>
                  <th className="text-right py-3 px-2">Current Cost</th>
                  {activeView === 'internal' && (
                    <>
                      <th className="text-right py-3 px-2">Base UPS Rate</th>
                      <th className="text-right py-3 px-2">Markup</th>
                    </>
                  )}
                  <th className="text-right py-3 px-2">
                    {activeView === 'internal' ? 'Final Rate' : 'Ship Pros Rate'}
                  </th>
                  <th className="text-right py-3 px-2">Savings</th>
                </tr>
              </thead>
              <tbody>
                {calculatedResults.map((result, index) => (
                  <tr key={index} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-2">
                      <Badge variant="secondary">{result.bestRate?.service || 'Unknown'}</Badge>
                    </td>
                    <td className="py-3 px-2 text-right">{formatCurrency(result.currentCost)}</td>
                    {activeView === 'internal' && (
                      <>
                        <td className="py-3 px-2 text-right">{formatCurrency(result.baseUpsRate)}</td>
                        <td className="py-3 px-2 text-right">
                          {formatCurrency(result.markupAmount)} ({formatPercentage(result.markupPercentage)})
                        </td>
                      </>
                    )}
                    <td className="py-3 px-2 text-right font-medium">{formatCurrency(result.finalRate)}</td>
                    <td className="py-3 px-2 text-right font-medium text-green-600">
                      {formatCurrency(result.savings)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}