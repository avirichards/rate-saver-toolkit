import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui-lov/Card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui-lov/Button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Percent, DollarSign, TrendingUp, Globe, Settings } from 'lucide-react';
import { formatCurrency, formatPercentage } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface MarkupData {
  markupType: 'global' | 'per-service';
  globalMarkup: number;
  perServiceMarkup: Record<string, number>;
  totalMargin: number;
  marginPercentage: number;
  savingsAmount?: number;
  savingsPercentage?: number;
}

interface MarkupConfigurationProps {
  shipmentData: any[];
  analysisId?: string;
  onMarkupChange: (markupData: MarkupData) => void;
  initialMarkupData?: MarkupData;
}

export const MarkupConfiguration: React.FC<MarkupConfigurationProps> = ({
  shipmentData,
  analysisId,
  onMarkupChange,
  initialMarkupData
}) => {
  const [markupType, setMarkupType] = useState<'global' | 'per-service'>('global');
  const [globalMarkup, setGlobalMarkup] = useState(0.0);
  const [perServiceMarkup, setPerServiceMarkup] = useState<Record<string, number>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Get unique services from shipment data
  const availableServices = [...new Set(shipmentData.map(item => item.service).filter(Boolean))];

  // Initialize per-service markup with default values
  useEffect(() => {
    if (availableServices.length > 0 && Object.keys(perServiceMarkup).length === 0) {
      const defaultPerServiceMarkup = availableServices.reduce((acc, service) => {
        acc[service] = 0.0;
        return acc;
      }, {} as Record<string, number>);
      setPerServiceMarkup(defaultPerServiceMarkup);
    }
  }, [availableServices.length]);

  // Load initial markup data if provided (only once)
  useEffect(() => {
    if (initialMarkupData) {
      setMarkupType(initialMarkupData.markupType);
      setGlobalMarkup(initialMarkupData.globalMarkup);
      setPerServiceMarkup(initialMarkupData.perServiceMarkup);
    }
  }, []);

  // Calculate markup metrics
  const calculateMarkupMetrics = useCallback((): MarkupData => {
    let totalMargin = 0;
    let totalShipProsCost = 0;
    let totalMarkedUpRevenue = 0;
    let totalSavings = 0;
    let totalCurrentCost = 0;

    shipmentData.forEach(shipment => {
      const shipProsCost = shipment.newRate || 0;
      const currentCost = shipment.currentRate || 0;
      const savings = shipment.savings || 0;
      
      totalShipProsCost += shipProsCost;
      totalCurrentCost += currentCost;
      totalSavings += savings;

      let markupPercent = 0;
      if (markupType === 'global') {
        markupPercent = globalMarkup;
      } else {
        markupPercent = perServiceMarkup[shipment.service] || 0;
      }

      const markedUpPrice = shipProsCost * (1 + markupPercent / 100);
      const margin = markedUpPrice - shipProsCost;
      
      totalMargin += margin;
      totalMarkedUpRevenue += markedUpPrice;
    });

    const marginPercentage = totalShipProsCost > 0 ? (totalMargin / totalShipProsCost) * 100 : 0;
    const finalSavingsAmount = totalSavings + totalMargin;
    const savingsPercentage = totalCurrentCost > 0 ? (finalSavingsAmount / totalCurrentCost) * 100 : 0;

    return {
      markupType,
      globalMarkup,
      perServiceMarkup,
      totalMargin,
      marginPercentage,
      savingsAmount: finalSavingsAmount,
      savingsPercentage
    };
  }, [shipmentData, markupType, globalMarkup, perServiceMarkup]);

  // Debounced save to database
  const saveMarkupData = useCallback(async (markupData: MarkupData) => {
    if (!analysisId) return;

    setIsSaving(true);
    try {
      // First, get the current analysis to recalculate total savings with new markup
      const { data: currentAnalysis, error: fetchError } = await supabase
        .from('shipping_analyses')
        .select('original_data, total_shipments, total_savings, savings_analysis')
        .eq('id', analysisId)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      // Recalculate total savings including markup
      let newTotalSavings = 0;
      let updatedSavingsAnalysis: any = {};
      
      // Safely handle savings_analysis which could be null or different types
      if (currentAnalysis?.savings_analysis && typeof currentAnalysis.savings_analysis === 'object') {
        updatedSavingsAnalysis = { ...currentAnalysis.savings_analysis };
      }
      
      if (currentAnalysis?.original_data) {
        let shipmentData: any[] = [];
        
        // Handle different data structures
        if (Array.isArray(currentAnalysis.original_data)) {
          shipmentData = currentAnalysis.original_data;
        } else if (typeof currentAnalysis.original_data === 'object' && currentAnalysis.original_data !== null) {
          // Try to extract shipments array from the object
          const dataObj = currentAnalysis.original_data as any;
          shipmentData = dataObj.shipments || dataObj.data || [];
        }
        
        let totalCurrentCost = 0;
        let totalNewCost = 0;
        
        shipmentData.forEach((shipment: any) => {
          const currentRate = shipment.currentRate || 0;
          const newRate = shipment.newRate || 0;
          const baseSavings = shipment.savings || 0;
          
          totalCurrentCost += currentRate;
          totalNewCost += newRate;
          
          // Add markup to the savings calculation
          let markupAmount = 0;
          if (newRate) {
            const markupPercent = markupData.markupType === 'global' 
              ? markupData.globalMarkup 
              : markupData.perServiceMarkup[shipment.service] || 0;
            markupAmount = (newRate * markupPercent) / 100;
          }
          
          newTotalSavings += baseSavings + markupAmount;
        });

        // Calculate savings percentage
        const savingsPercentage = totalCurrentCost > 0 ? (newTotalSavings / totalCurrentCost) * 100 : 0;

        // Update savings_analysis with the new calculations
        updatedSavingsAnalysis = {
          ...updatedSavingsAnalysis,
          totalSavings: newTotalSavings,
          savingsPercentage,
          totalCurrentCost,
          totalNewCost: totalNewCost + markupData.totalMargin,
          updatedAt: new Date().toISOString()
        };
      }

      console.log('🔄 MARKUP CHANGED: Updating database with recalculated savings:', {
        oldTotal: currentAnalysis?.total_savings,
        newTotal: newTotalSavings,
        savingsPercentage: updatedSavingsAnalysis.savingsPercentage,
        markupData
      });

      const { error } = await supabase
        .from('shipping_analyses')
        .update({
          markup_data: markupData as any,
          total_savings: newTotalSavings,
          savings_analysis: updatedSavingsAnalysis as any,
          updated_at: new Date().toISOString()
        })
        .eq('id', analysisId);

      if (error) {
        console.error('Error saving markup data:', error);
        toast.error('Failed to save markup configuration');
      } else {
        console.log('✅ MARKUP SAVED: Database updated successfully');
        toast.success('Markup configuration saved');
      }
    } catch (error) {
      console.error('Error saving markup data:', error);
      toast.error('Failed to save markup configuration');
    } finally {
      setIsSaving(false);
    }
  }, [analysisId]);

  // Handle markup changes and notify parent
  useEffect(() => {
    const markupData = calculateMarkupMetrics();
    onMarkupChange(markupData);

    // Auto-save with debouncing
    const saveTimeout = setTimeout(() => {
      if (analysisId) {
        saveMarkupData(markupData);
      }
    }, 1000);

    return () => clearTimeout(saveTimeout);
  }, [markupType, globalMarkup, perServiceMarkup, analysisId]);

  const handlePerServiceMarkupChange = (service: string, value: number) => {
    setPerServiceMarkup(prev => ({
      ...prev,
      [service]: value
    }));
  };

  const markupData = calculateMarkupMetrics();
  const totalShipProsCost = shipmentData.reduce((sum, item) => sum + (item.newRate || 0), 0);
  const totalMarkedUpRevenue = totalShipProsCost + markupData.totalMargin;

  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <CardTitle className="text-2xl flex items-center gap-2">
          <Percent className="h-6 w-6 text-primary" />
          Markup Configuration
        </CardTitle>
        <CardDescription>
          Configure markup percentages to calculate margins and final pricing
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Configuration */}
          <div className="lg:col-span-2 space-y-6">
            {/* Markup Type Selection */}
            <div className="space-y-4">
              <Label className="text-base font-medium">Markup Type</Label>
              <div className="flex gap-4">
                <Button
                  variant={markupType === 'global' ? 'default' : 'outline'}
                  onClick={() => setMarkupType('global')}
                  className="flex items-center gap-2"
                >
                  <Globe className="h-4 w-4" />
                  Global Markup %
                </Button>
                <Button
                  variant={markupType === 'per-service' ? 'default' : 'outline'}
                  onClick={() => setMarkupType('per-service')}
                  className="flex items-center gap-2"
                >
                  <Settings className="h-4 w-4" />
                  Per-Service Markup %
                </Button>
              </div>
            </div>

            {/* Configuration Area */}
            {markupType === 'global' ? (
              <div className="space-y-2">
                <Label htmlFor="global-markup">Global Markup Percentage</Label>
                <div className="relative">
                  <Input
                    id="global-markup"
                    type="number"
                    value={globalMarkup}
                    onChange={(e) => setGlobalMarkup(parseFloat(e.target.value) || 0)}
                    className="pr-8"
                    step="1"
                    min="0"
                    max="100"
                  />
                  <Percent className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Apply a {globalMarkup}% markup to all shipments
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <Label className="text-base font-medium">Service-Specific Markup Percentages</Label>
                <div className="space-y-3">
                  {availableServices.map(service => (
                    <div key={service} className="flex items-center gap-4">
                      <Badge variant="outline" className="min-w-[120px] justify-center">
                        {service}
                      </Badge>
                      <div className="relative flex-1 max-w-[150px]">
                        <Input
                          type="number"
                          value={perServiceMarkup[service] || 0}
                          onChange={(e) => handlePerServiceMarkupChange(service, parseFloat(e.target.value) || 0)}
                          className="pr-8"
                          step="1"
                          min="0"
                          max="100"
                        />
                        <Percent className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Panel - Margin Summary */}
          <div className="space-y-4">
            <div className="space-y-4">
              <Label className="text-base font-medium">Margin Summary</Label>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-blue-500" />
                    <span className="text-sm">Ship Pros Cost</span>
                  </div>
                  <span className="font-medium">{formatCurrency(totalShipProsCost)}</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <span className="text-sm">With Markup</span>
                  </div>
                  <span className="font-medium text-primary">{formatCurrency(totalMarkedUpRevenue)}</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-green-500/10 rounded-lg">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Total Margin</span>
                  </div>
                  <span className="font-medium text-green-500">{formatCurrency(markupData.totalMargin)}</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-orange-500/10 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Percent className="h-4 w-4 text-orange-500" />
                    <span className="text-sm">Margin %</span>
                  </div>
                  <span className="font-medium text-orange-500">{formatPercentage(markupData.marginPercentage)}</span>
                </div>
              </div>

              {isSaving && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="animate-pulse w-2 h-2 bg-primary rounded-full"></div>
                  Auto-saving...
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};