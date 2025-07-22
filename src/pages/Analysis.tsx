
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui-lov/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Package, Shield, DollarSign, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useShipmentValidation } from '@/hooks/useShipmentValidation';
import { ValidationSummary } from '@/components/ui-lov/ValidationSummary';
import { CarrierSelector } from '@/components/ui-lov/CarrierSelector';
import type { ServiceMapping } from '@/utils/csvParser';

interface ProcessedShipment {
  id: number;
  trackingId?: string;
  service?: string;
  carrier?: string;
  weight?: string;
  weightUnit?: string;
  cost?: string;
  originZip?: string;
  destZip?: string;
  length?: string;
  width?: string;
  height?: string;
  shipperName?: string;
  shipperAddress?: string;
  shipperCity?: string;
  shipperState?: string;
  recipientName?: string;
  recipientAddress?: string;
  recipientCity?: string;
}

const Analysis = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [shipments, setShipments] = useState<ProcessedShipment[]>([]);
  const [serviceMappings, setServiceMappings] = useState<ServiceMapping[]>([]);
  const [selectedCarriers, setSelectedCarriers] = useState<string[]>([]);
  const [carrierSelectionComplete, setCarrierSelectionComplete] = useState(false);
  const [readyToAnalyze, setReadyToAnalyze] = useState(false);
  const [isAnalysisStarted, setIsAnalysisStarted] = useState(false);
  const { validateShipments, getValidShipments, validationState } = useShipmentValidation();
  
  useEffect(() => {
    const state = location.state as { 
      readyForAnalysis?: boolean, 
      csvData?: any[],
      mappings?: Record<string, string>,
      serviceMappings?: ServiceMapping[],
      fileName?: string,
      csvUploadId?: string,
      originZipOverride?: string,
      uploadTimestamp?: number
    } | null;
    
    if (!state || !state.readyForAnalysis || !state.csvData || !state.mappings) {
      toast.error('Please complete the service mapping review first');
      navigate('/service-mapping');
      return;
    }
    
    // Process CSV data into shipments using the confirmed mappings
    const processedShipments = state.csvData.map((row, index) => {
      const shipment: ProcessedShipment = { id: index + 1 };
      
      Object.entries(state.mappings).forEach(([fieldName, csvHeader]) => {
        if (csvHeader && csvHeader !== "__NONE__" && row[csvHeader] !== undefined) {
          let value = row[csvHeader];
          if (typeof value === 'string') {
            value = value.trim();
          }
          (shipment as any)[fieldName] = value;
        }
      });
      
      // Apply origin ZIP override if provided
      if (state.originZipOverride && state.originZipOverride.trim()) {
        shipment.originZip = state.originZipOverride.trim();
      }
      
      return shipment;
    });

    setShipments(processedShipments);
    setServiceMappings(state.serviceMappings || []);
    setReadyToAnalyze(true);
  }, [location, navigate]);
  
  // Auto-select all carriers on initial load if available
  useEffect(() => {
    const loadInitialCarriers = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from('carrier_configs')
          .select('id')
          .eq('user_id', user.id)
          .eq('is_active', true);

        if (!error && data && data.length > 0) {
          setSelectedCarriers(data.map(config => config.id));
        }
      } catch (error) {
        console.error('Error loading carrier configs:', error);
      }
    };

    if (shipments.length > 0 && selectedCarriers.length === 0) {
      loadInitialCarriers();
    }
  }, [shipments, selectedCarriers]);

  const handleStartAnalysis = async () => {
    try {
      const state = location.state as any;
      const userRes = await supabase.auth.getUser();
      const userId = userRes.data.user!.id;
      
      const { data, error } = await supabase.functions.invoke(
        'start-background-analysis',
        {
          body: {
            csvUploadId: state.csvUploadId,
            userId,
            mappings: state.mappings,
            serviceMappings: state.serviceMappings,
            carrierConfigs: selectedCarriers
          }
        }
      );
      
      if (error) throw error;
      
      navigate(`/results?analysisId=${data.analysisId}`);
    } catch (err: any) {
      toast.error('Failed to start analysis: ' + err.message);
    }
  };
  
  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold mb-2">Real-Time Shipping Analysis</h1>
          <p className="text-muted-foreground">
            Processing {shipments.length} shipments and comparing current rates across multiple carriers for optimal savings.
          </p>
        </div>
        
        {/* Carrier Selection */}
        {!isAnalysisStarted && !carrierSelectionComplete && (
          <div className="mb-6">
            <CarrierSelector
              selectedCarriers={selectedCarriers}
              onCarrierChange={setSelectedCarriers}
              showAllOption={true}
            />
            {selectedCarriers.length > 0 && (
              <div className="mt-4 flex justify-end">
                <Button 
                  onClick={() => setCarrierSelectionComplete(true)}
                  disabled={selectedCarriers.length === 0}
                  iconLeft={<CheckCircle className="h-4 w-4" />}
                >
                  Start Analysis with {selectedCarriers.length} Carrier{selectedCarriers.length > 1 ? 's' : ''}
                </Button>
              </div>
            )}
          </div>
        )}
        
        {/* Progress Overview */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Package className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{shipments.length}</p>
                  <p className="text-sm text-muted-foreground">Total Shipments</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Shield className="h-8 w-8 text-emerald-600" />
                <div>
                  <p className="text-2xl font-bold">{validationState.summary.valid}</p>
                  <p className="text-sm text-muted-foreground">Valid Shipments</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-2xl font-bold">0</p>
                  <p className="text-sm text-muted-foreground">Analyzed</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <DollarSign className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold">$0.00</p>
                  <p className="text-sm text-muted-foreground">Current Cost</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <TrendingDown className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-2xl font-bold">$0.00</p>
                  <p className="text-sm text-muted-foreground">Potential Savings</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Validation Summary */}
        {validationState.summary.total > 0 && (
          <ValidationSummary 
            validationState={validationState} 
            shipments={shipments} 
            className="mb-6" 
          />
        )}

        {/* Shipment Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Shipment Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {shipments.slice(0, 10).map((shipment, index) => (
                <div 
                  key={index} 
                  className="flex items-center justify-between p-3 border border-border rounded-lg bg-card"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                        <span className="text-xs">{index + 1}</span>
                      </div>
                    </div>
                    
                    <div>
                      <p className="font-medium text-sm">
                        {shipment.trackingId || `Shipment ${index + 1}`}
                      </p>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p>{shipment.originZip} → {shipment.destZip} | {shipment.weight}lbs</p>
                        {shipment.service && (
                          <p>Service: {shipment.service}</p>
                        )}
                        {(shipment.length || shipment.width || shipment.height) && (
                          <p>Dimensions: {shipment.length || 12}" × {shipment.width || 12}" × {shipment.height || 6}"</p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <p className="text-sm font-medium">${shipment.cost || '0.00'}</p>
                    <Badge variant="outline">Ready</Badge>
                  </div>
                </div>
              ))}
              {shipments.length > 10 && (
                <div className="text-center text-sm text-muted-foreground">
                  And {shipments.length - 10} more shipments...
                </div>
              )}
            </div>
            
            {(carrierSelectionComplete && selectedCarriers.length > 0) && (
              <div className="flex justify-end mt-6">
                <Button 
                  onClick={handleStartAnalysis}
                  variant="primary" 
                  iconRight={<CheckCircle className="ml-1 h-4 w-4" />}
                >
                  {isAnalysisStarted ? 'View Detailed Results' : 'Start Analysis'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Analysis;
