
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { Button } from '@/components/ui-lov/Button';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Play, Clock, CheckCircle, AlertCircle, Package, TrendingUp, DollarSign, Settings } from 'lucide-react';

const Analysis = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [analysis, setAnalysis] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [progress, setProgress] = useState(0);
  const [processedShipments, setProcessedShipments] = useState<any[]>([]);
  const [carrierConfigs, setCarrierConfigs] = useState<any[]>([]);
  const [selectedCarriers, setSelectedCarriers] = useState<string[]>([]);
  const [processingResults, setProcessingResults] = useState<any[]>([]);

  useEffect(() => {
    // Check if we have fresh data from navigation state first
    const state = location.state as any;
    if (state && state.readyForAnalysis) {
      console.log('📊 Analysis page - Received fresh data from service mapping:', state);
      
      setAnalysis({
        id: 'new-analysis',
        status: 'processing',
        csvUploadId: state.csvUploadId,
        fileName: state.fileName,
        mappings: state.mappings,
        serviceMappings: state.serviceMappings,
        csvData: state.csvData,
        rowCount: state.rowCount,
        originZipOverride: state.originZipOverride,
        uploadTimestamp: state.uploadTimestamp
      });
    } else if (id) {
      loadAnalysis();
    }
    
    loadCarrierConfigs();
  }, [id, location.state]);

  const loadCarrierConfigs = async () => {
    try {
      const { data, error } = await supabase
        .from('carrier_configs')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;
      
      console.log('🚚 Loaded carrier configs:', data);
      setCarrierConfigs(data || []);
      // Select all carriers by default
      setSelectedCarriers((data || []).map(c => c.id));
    } catch (error: any) {
      console.error('Error loading carrier configs:', error);
      toast.error('Failed to load carrier configurations');
    }
  };

  const loadAnalysis = async () => {
    try {
      const { data, error } = await supabase
        .from('shipping_analyses')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setAnalysis(data);
    } catch (error: any) {
      console.error('Error loading analysis:', error);
      toast.error('Failed to load analysis');
    }
  };

  const handleCarrierSelection = (carrierId: string, checked: boolean) => {
    if (checked) {
      setSelectedCarriers(prev => [...prev, carrierId]);
    } else {
      setSelectedCarriers(prev => prev.filter(id => id !== carrierId));
    }
  };

  const processMultiCarrierAnalysis = async () => {
    if (!analysis || selectedCarriers.length === 0) {
      toast.error('Please select at least one carrier account.');
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setProcessingResults([]);
    setProcessingStep('Initializing multi-carrier analysis...');

    try {
      const shipmentData = analysis.csvData || [];
      const processedShipments = [];

      setProcessingStep('Processing shipments...');

      // Process each shipment
      for (let i = 0; i < shipmentData.length; i++) {
        const shipment = shipmentData[i];
        
        setProgress(((i + 1) / shipmentData.length) * 100);
        setProcessingStep(`Processing shipment ${i + 1} of ${shipmentData.length}: ${shipment.trackingId || 'Unknown'}`);

        try {
          // Call the multi-carrier quote function
          const response = await fetch(`https://olehfhquezzfkdgilkut.supabase.co/functions/v1/multi-carrier-quote`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
            },
            body: JSON.stringify({
              carrierConfigs: selectedCarriers,
              shipFromZip: shipment.originZip,
              shipToZip: shipment.destZip || shipment.destinationZip,
              weight: parseFloat(shipment.weight),
              length: parseFloat(shipment.length) || 12,
              width: parseFloat(shipment.width) || 12, 
              height: parseFloat(shipment.height) || 6,
              serviceTypes: [shipment.serviceCode || '03'],
              isResidential: shipment.isResidential || false
            })
          });

          if (!response.ok) {
            console.error('❌ HTTP error for shipment:', shipment.trackingId, response.status, response.statusText);
            setProcessingResults(prev => [...prev, {
              shipmentId: shipment.trackingId,
              status: 'error',
              message: `HTTP ${response.status}: ${response.statusText}`
            }]);
            continue;
          }

          const multiCarrierResult = await response.json();

          console.log('✅ Multi-carrier result:', {
            totalRates: multiCarrierResult?.allRates?.length || 0,
            bestRatesCount: multiCarrierResult?.bestRates?.length || 0,
            carrierResults: multiCarrierResult?.carrierResults?.length || 0
          });

          // Find the best rate (lowest cost)
          const allRates = multiCarrierResult?.allRates || [];
          let bestRate = null;
          let currentRate = parseFloat(shipment.currentCost || shipment.current_rate || '0');

          if (allRates.length > 0) {
            bestRate = allRates.reduce((best, rate) => {
              const ratePrice = parseFloat(rate.rate || rate.cost || rate.totalCharges || '0');
              const bestPrice = parseFloat(best.rate || best.cost || best.totalCharges || '0');
              return ratePrice < bestPrice ? rate : best;
            });
          }

          const bestRatePrice = bestRate ? parseFloat(bestRate.rate || bestRate.cost || bestRate.totalCharges || '0') : currentRate;
          const savings = currentRate - bestRatePrice;

          // Create processed shipment with multi-carrier data
          const processedShipment = {
            id: i + 1,
            trackingId: shipment.trackingId || shipment.tracking_id || `SHIP-${String(i + 1).padStart(4, '0')}`,
            originZip: shipment.originZip,
            destinationZip: shipment.destZip || shipment.destinationZip,
            weight: parseFloat(shipment.weight),
            length: parseFloat(shipment.length) || undefined,
            width: parseFloat(shipment.width) || undefined,
            height: parseFloat(shipment.height) || undefined,
            carrier: shipment.carrier || 'Unknown',
            service: shipment.service || 'Standard',
            originalService: shipment.originalService || shipment.service || 'Unknown',
            currentRate: currentRate,
            newRate: bestRatePrice,
            savings: savings,
            savingsPercent: currentRate > 0 ? (savings / currentRate) * 100 : 0,
            
            // Enhanced multi-carrier data for Account Review tab
            accounts: allRates.map(rate => ({
              carrierId: rate.carrierId || 'default',
              carrierType: rate.carrierType || 'Unknown',
              accountName: rate.accountName || 'Default',
              displayName: rate.displayName || `${rate.carrierType || 'Unknown'} – ${rate.accountName || 'Default'}`,
              rate: parseFloat(rate.rate || rate.cost || rate.totalCharges || '0'),
              service: rate.serviceName || rate.serviceCode || 'Standard'
            })),
            
            allRates: allRates,
            carrierResults: multiCarrierResult?.carrierResults || [],
            
            // Store complete multi-carrier response for analysis
            multi_carrier_results: multiCarrierResult
          };

          processedShipments.push(processedShipment);

          setProcessingResults(prev => [...prev, {
            shipmentId: shipment.trackingId,
            status: 'success',
            message: `Found ${allRates.length} rates, best: $${bestRatePrice.toFixed(2)}`
          }]);

        } catch (error: any) {
          console.error('❌ Error processing shipment:', error);
          setProcessingResults(prev => [...prev, {
            shipmentId: shipment.trackingId,
            status: 'error',
            message: error.message
          }]);
          // Continue processing other shipments
        }
      }

      console.log('✅ Processed shipments:', processedShipments.length);

      // Calculate summary stats
      const totalCurrentCost = processedShipments.reduce((sum, s) => sum + s.currentRate, 0);
      const totalNewCost = processedShipments.reduce((sum, s) => sum + s.newRate, 0);
      const totalSavings = totalCurrentCost - totalNewCost;
      const savingsPercentage = totalCurrentCost > 0 ? (totalSavings / totalCurrentCost) * 100 : 0;

      console.log('💰 Analysis summary:', {
        processedShipments: processedShipments.length,
        totalCurrentCost,
        totalSavings,
        savingsPercentage
      });

      setProcessingStep('Saving analysis results...');

      // Save to database
      const { data: savedAnalysis, error: saveError } = await supabase
        .from('shipping_analyses')
        .insert({
          user_id: (await supabase.auth.getUser()).data.user?.id,
          file_name: analysis.fileName,
          total_shipments: shipmentData.length,
          total_savings: totalSavings,
          status: 'completed',
          original_data: shipmentData,
          processed_shipments: processedShipments,
          carrier_configs_used: selectedCarriers,
          processing_metadata: {
            processedCount: processedShipments.length,
            totalCount: shipmentData.length,
            savingsPercentage
          }
        })
        .select()
        .single();

      if (saveError) {
        console.error('❌ Error saving analysis:', saveError);
        toast.error('Failed to save analysis results');
      } else {
        console.log('✅ Analysis saved with ID:', savedAnalysis.id);
      }

      toast.success('Multi-carrier analysis completed!');

      // Navigate to results
      navigate('/results', {
        state: {
          analysisComplete: true,
          analysisData: {
            recommendations: processedShipments,
            totalShipments: shipmentData.length,
            totalPotentialSavings: totalSavings,
            orphanedShipments: []
          }
        }
      });

    } catch (error: any) {
      console.error('❌ Analysis error:', error);
      toast.error(`Analysis failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!analysis) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Clock className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading analysis...</p>
        </div>
      </div>
    );
  }

  const canProcess = analysis.status === 'processing' || analysis.status === 'draft' || analysis.csvData;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Multi-Carrier Analysis</h1>
          <p className="text-muted-foreground">
            Analyze your shipments against multiple carrier accounts to find the best rates
          </p>
        </div>

        {/* Analysis Details */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Analysis Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <Package className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                <div className="text-2xl font-bold">
                  {analysis.rowCount || analysis.csvData?.length || 0}
                </div>
                <div className="text-sm text-muted-foreground">Total Shipments</div>
              </div>

              <div className="text-center p-4 bg-green-50 rounded-lg">
                <TrendingUp className="h-8 w-8 mx-auto mb-2 text-green-500" />
                <div className="text-2xl font-bold">
                  {selectedCarriers.length}
                </div>
                <div className="text-sm text-muted-foreground">Selected Carriers</div>
              </div>

              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <DollarSign className="h-8 w-8 mx-auto mb-2 text-purple-500" />
                <div className="text-2xl font-bold">
                  ${(analysis.total_savings || 0).toFixed(2)}
                </div>
                <div className="text-sm text-muted-foreground">Potential Savings</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Carrier Selection */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Select Carrier Accounts</span>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate('/settings')}
                className="flex items-center gap-2"
              >
                <Settings className="h-4 w-4" />
                Manage Accounts
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {carrierConfigs.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Carrier Accounts Configured</h3>
                <p className="text-muted-foreground mb-4">
                  You need to configure at least one carrier account before running analysis.
                </p>
                <Button onClick={() => navigate('/settings')}>
                  Configure Carrier Accounts
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {carrierConfigs.map((config) => (
                  <div key={config.id} className="flex items-center space-x-3 p-4 border rounded-lg">
                    <Checkbox
                      id={config.id}
                      checked={selectedCarriers.includes(config.id)}
                      onCheckedChange={(checked) => handleCarrierSelection(config.id, checked as boolean)}
                    />
                    <div className="flex-1">
                      <label htmlFor={config.id} className="cursor-pointer">
                        <div className="font-medium">{config.account_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {config.carrier_type.toUpperCase()} • {config.account_group || 'Default Group'}
                          {config.is_sandbox && ' • Sandbox'}
                        </div>
                      </label>
                    </div>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Processing Section */}
        {isProcessing && (
          <Card className="mb-8">
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="text-center">
                  <div className="text-lg font-medium mb-2">{processingStep}</div>
                  <Progress value={progress} className="w-full" />
                  <div className="text-sm text-muted-foreground mt-2">
                    {Math.round(progress)}% Complete
                  </div>
                </div>
                
                {processingResults.length > 0 && (
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {processingResults.slice(-5).map((result, index) => (
                      <div key={index} className={`text-xs p-2 rounded ${
                        result.status === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                      }`}>
                        {result.shipmentId}: {result.message}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex gap-4">
          {canProcess && !isProcessing && (
            <Button 
              onClick={processMultiCarrierAnalysis}
              className="flex items-center gap-2"
              disabled={carrierConfigs.length === 0 || selectedCarriers.length === 0}
            >
              <Play className="h-4 w-4" />
              Start Multi-Carrier Analysis
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Analysis;
