import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui-lov/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, RotateCw, AlertCircle, DollarSign, TrendingDown, Package, Shield, Clock, Pause, Play } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useShipmentValidation } from '@/hooks/useShipmentValidation';
import { ValidationSummary } from '@/components/ui-lov/ValidationSummary';
import { getCityStateFromZip } from '@/utils/zipCodeMapping';
import { mapServiceToUpsCode, getServiceCodesToRequest } from '@/utils/serviceMapping';

interface ProcessedShipment {
  id: number;
  trackingId?: string;
  service?: string;
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
  recipientState?: string;
}

interface AnalysisResult {
  shipment: ProcessedShipment;
  status: 'pending' | 'processing' | 'completed' | 'error';
  currentCost?: number;
  originalService?: string; // Original service from CSV
  upsRates?: any[];
  bestRate?: any;
  savings?: number;
  error?: string;
}

const Analysis = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [shipments, setShipments] = useState<ProcessedShipment[]>([]);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([]);
  const [currentShipmentIndex, setCurrentShipmentIndex] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalSavings, setTotalSavings] = useState(0);
  const [totalCurrentCost, setTotalCurrentCost] = useState(0);
  const [validationSummary, setValidationSummary] = useState<any>(null);
  const { validateShipments, getValidShipments, validationState } = useShipmentValidation();
  
  useEffect(() => {
    const state = location.state as { 
      readyForAnalysis?: boolean, 
      processedShipments?: ProcessedShipment[],
      fileName?: string,
      csvUploadId?: string
    } | null;
    
    if (!state || !state.readyForAnalysis || !state.processedShipments) {
      toast.error('Please map columns first');
      navigate('/mapping');
      return;
    }
    
    console.log(`Analysis received ${state.processedShipments.length} shipments (sample):`, state.processedShipments.slice(0, 2));
    setShipments(state.processedShipments);
    
    // Initialize analysis results
    const initialResults = state.processedShipments.map(shipment => ({
      shipment,
      status: 'pending' as const
    }));
    setAnalysisResults(initialResults);
    
    // Validate shipments first, then start analysis
    validateAndStartAnalysis(state.processedShipments);
  }, [location, navigate]);
  
  const validateAndStartAnalysis = async (shipmentsToAnalyze: ProcessedShipment[]) => {
    setIsAnalyzing(true);
    setError(null);
    
    try {
      // Validate all shipments first
      console.log('Validating shipments...');
      const validationResults = await validateShipments(shipmentsToAnalyze);
      
      // Filter valid shipments using the validation results directly
      const validShipments = shipmentsToAnalyze.filter((_, index) => {
        const result = validationResults[index];
        return result && result.isValid;
      });
      
      const summary = {
        total: shipmentsToAnalyze.length,
        valid: validShipments.length,
        invalid: shipmentsToAnalyze.length - validShipments.length
      };
      
      setValidationSummary(summary);
      console.log('Validation complete:', summary);
      console.log('Valid shipments found:', validShipments.length);
      
      if (validShipments.length === 0) {
        throw new Error('No valid shipments found. Please check your data and field mappings.');
      }
      
      if (summary.invalid > 0) {
        toast.warning(`${summary.invalid} shipments have validation errors and will be skipped.`);
      }
      
      // Process only valid shipments
      await startAnalysis(validShipments);
      
    } catch (error: any) {
      console.error('Validation error:', error);
      setError(error.message);
      setIsAnalyzing(false);
    }
  };

  const startAnalysis = async (shipmentsToAnalyze: ProcessedShipment[]) => {
    setIsAnalyzing(true);
    setCurrentShipmentIndex(0);
    setError(null);
    
    try {
      // Validate UPS configuration first
      await validateUpsConfiguration();
      
      // Process shipments one by one
      for (let i = 0; i < shipmentsToAnalyze.length; i++) {
        // Check if paused
        while (isPaused) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        setCurrentShipmentIndex(i);
        await processShipment(i, shipmentsToAnalyze[i]);
        
        // Small delay to show progress
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      setIsComplete(true);
      await saveAnalysisToDatabase();
      
    } catch (error: any) {
      console.error('Analysis error:', error);
      setError(error.message);
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  const validateUpsConfiguration = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Please log in to run analysis');
    }

    const { data: config, error } = await supabase
      .from('ups_configs')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (error || !config) {
      throw new Error('UPS configuration not found. Please configure UPS API in Settings.');
    }

    // Test UPS connection
    const { data, error: authError } = await supabase.functions.invoke('ups-auth', {
      body: { action: 'get_token' }
    });

    if (authError || !data?.access_token) {
      throw new Error('Failed to authenticate with UPS. Please check your API credentials.');
    }
  };
  
  const processShipment = async (index: number, shipment: ProcessedShipment) => {
    // Update status to processing
    setAnalysisResults(prev => prev.map((result, i) => 
      i === index ? { ...result, status: 'processing' } : result
    ));
    
    try {
      // Enhanced validation with better error messages
      const missingFields = [];
      if (!shipment.originZip?.trim()) missingFields.push('Origin ZIP');
      if (!shipment.destZip?.trim()) missingFields.push('Destination ZIP');
      
      let weight = 0;
      if (!shipment.weight || shipment.weight === '') {
        missingFields.push('Weight');
      } else {
        weight = parseFloat(shipment.weight);
        // Handle oz to lbs conversion
        if (shipment.weightUnit && shipment.weightUnit.toLowerCase().includes('oz')) {
          weight = weight / 16;
        }
        if (isNaN(weight) || weight <= 0) {
          missingFields.push('Valid Weight');
        }
      }
      
      if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
      }
      
      // Validate ZIP codes format (basic US ZIP validation)
      const zipRegex = /^\d{5}(-\d{4})?$/;
      if (!zipRegex.test(shipment.originZip.trim())) {
        throw new Error(`Invalid origin ZIP code format: ${shipment.originZip}`);
      }
      if (!zipRegex.test(shipment.destZip.trim())) {
        throw new Error(`Invalid destination ZIP code format: ${shipment.destZip}`);
      }
      
      const currentCost = parseFloat(shipment.cost || '0');
      const length = parseFloat(shipment.length || '12');
      const width = parseFloat(shipment.width || '12'); 
      const height = parseFloat(shipment.height || '6');
      
      // Map the original service to UPS service codes
      const serviceMapping = mapServiceToUpsCode(shipment.service || '');
      const serviceCodesToRequest = getServiceCodesToRequest(shipment.service || '');
      
      console.log(`Processing shipment ${index + 1}:`, {
        originZip: shipment.originZip,
        destZip: shipment.destZip,
        weight,
        dimensions: { length, width, height },
        currentCost,
        originalService: shipment.service,
        mappedService: serviceMapping,
        serviceCodes: serviceCodesToRequest
      });
      
      // Use real address data from CSV or map ZIP codes to correct cities for test data
      const originCityState = getCityStateFromZip(shipment.originZip);
      const destCityState = getCityStateFromZip(shipment.destZip);
      
      console.log(`ZIP code mapping for shipment ${index + 1}:`, {
        originZip: shipment.originZip,
        originMapping: originCityState,
        destZip: shipment.destZip,
        destMapping: destCityState
      });
      
      const shipmentRequest = {
        shipFrom: {
          name: shipment.shipperName || 'Sample Shipper',
          address: shipment.shipperAddress || '123 Main St',
          city: shipment.shipperCity || originCityState.city,
          state: shipment.shipperState || originCityState.state,
          zipCode: shipment.originZip.trim(),
          country: 'US'
        },
        shipTo: {
          name: shipment.recipientName || 'Sample Recipient',
          address: shipment.recipientAddress || '456 Oak Ave',
          city: shipment.recipientCity || destCityState.city,
          state: shipment.recipientState || destCityState.state,
          zipCode: shipment.destZip.trim(),
          country: 'US'
        },
        package: {
          weight,
          weightUnit: 'LBS',
          length,
          width,
          height,
          dimensionUnit: 'IN'
        },
        serviceTypes: serviceCodesToRequest
      };
      
      // Fetch UPS rates with enhanced error handling
      const { data, error } = await supabase.functions.invoke('ups-rate-quote', {
        body: { shipment: shipmentRequest }
      });

      console.log(`UPS API response for shipment ${index + 1}:`, { data, error });

      if (error) {
        throw new Error(`UPS API Error: ${error.message || 'Unknown error'}`);
      }
      
      if (!data) {
        throw new Error('No data returned from UPS API');
      }
      
      if (!data.rates || !Array.isArray(data.rates) || data.rates.length === 0) {
        console.error('UPS API returned no rates. Full response:', data);
        throw new Error('No rates returned from UPS. This may indicate:\n• Invalid ZIP codes\n• Package dimensions exceed limits\n• Service unavailable for this route\n• UPS API configuration issues');
      }
      
      // Find equivalent service rate (for apples-to-apples comparison)
      const equivalentServiceRate = data.rates.find((rate: any) => rate.isEquivalentService);
      
      // Find best overall rate (lowest cost)
      const bestOverallRate = data.rates.reduce((best: any, current: any) => 
        (current.totalCharges || 0) < (best.totalCharges || 0) ? current : best
      );
      
      // Use equivalent service for comparison if available, otherwise use best overall rate
      const comparisonRate = equivalentServiceRate || bestOverallRate;
      
      // But track both for display purposes
      const equivalentServiceInfo = equivalentServiceRate ? {
        serviceName: equivalentServiceRate.serviceName,
        cost: equivalentServiceRate.totalCharges,
        isEquivalent: true
      } : null;
      
      if (!comparisonRate || comparisonRate.totalCharges === undefined) {
        throw new Error('Invalid rate data returned from UPS');
      }
      
      const savings = currentCost - comparisonRate.totalCharges;
      
      console.log(`Shipment ${index + 1} analysis complete:`, {
        originalService: shipment.service,
        equivalentService: serviceMapping.upsServiceName,
        currentCost,
        comparisonRate: comparisonRate.totalCharges,
        savings,
        recommendedUpsService: comparisonRate.serviceName,
        isEquivalentService: equivalentServiceRate ? true : false
      });
      
      // Update totals
      setTotalCurrentCost(prev => prev + currentCost);
      setTotalSavings(prev => prev + savings);
      
      // Update result
      setAnalysisResults(prev => prev.map((result, i) => 
        i === index ? {
          ...result,
          status: 'completed',
          currentCost,
          originalService: shipment.service, // Store original service from CSV
          upsRates: data.rates,
          bestRate: comparisonRate,
          savings
        } : result
      ));
      
    } catch (error: any) {
      console.error(`Error processing shipment ${index + 1}:`, error);
      setAnalysisResults(prev => prev.map((result, i) => 
        i === index ? {
          ...result,
          status: 'error',
          error: error.message
        } : result
      ));
    }
  };
  
  const saveAnalysisToDatabase = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const state = location.state as any;
    const completedResults = analysisResults.filter(r => r.status === 'completed');
    
    const recommendations = completedResults
      .filter(r => r.savings && r.savings > 0)
      .map(r => ({
        shipment: r.shipment,
        originalService: r.originalService, // Include original service
        currentCost: r.currentCost,
        recommendedCost: r.bestRate?.totalCharges,
        savings: r.savings,
        recommendedService: r.bestRate?.serviceName
      }));
    
    const { error } = await supabase
      .from('shipping_analyses')
      .insert({
        user_id: user.id,
        file_name: state?.fileName || 'Real-time Analysis',
        original_data: shipments as any,
        ups_quotes: completedResults.map(r => r.upsRates) as any,
        savings_analysis: {
          totalCurrentCost,
          totalPotentialSavings: totalSavings,
          savingsPercentage: totalCurrentCost > 0 ? (totalSavings / totalCurrentCost) * 100 : 0
        } as any,
        recommendations: recommendations as any,
        total_shipments: shipments.length,
        total_savings: totalSavings,
        status: 'completed'
      });

    if (error) {
      console.error('Error saving analysis:', error);
    }
  };
  
  const handleViewResults = () => {
    const completedResults = analysisResults.filter(r => r.status === 'completed');
    const recommendations = completedResults
      .filter(r => r.savings && r.savings > 0)
      .map(r => ({
        shipment: r.shipment,
        originalService: r.originalService, // Include original service
        currentCost: r.currentCost,
        recommendedCost: r.bestRate?.totalCharges,
        savings: r.savings,
        recommendedService: r.bestRate?.serviceName
      }));
    
    navigate('/results', { 
      state: { 
        analysisComplete: true,
        analysisData: {
          totalCurrentCost,
          totalPotentialSavings: totalSavings,
          recommendations,
          savingsPercentage: totalCurrentCost > 0 ? (totalSavings / totalCurrentCost) * 100 : 0,
          totalShipments: shipments.length,
          analyzedShipments: completedResults.length
        }
      } 
    });
  };
  
  const progress = shipments.length > 0 ? (currentShipmentIndex / shipments.length) * 100 : 0;
  const completedCount = analysisResults.filter(r => r.status === 'completed').length;
  const errorCount = analysisResults.filter(r => r.status === 'error').length;
  
  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold mb-2">Real-Time Shipping Analysis</h1>
          <p className="text-muted-foreground">
            Processing {shipments.length} shipments and comparing current rates with UPS optimization.
          </p>
        </div>
        
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

          {validationSummary && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Shield className="h-8 w-8 text-emerald-600" />
                  <div>
                    <p className="text-2xl font-bold">{validationSummary.valid}</p>
                    <p className="text-sm text-muted-foreground">Valid Shipments</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-2xl font-bold">{completedCount}</p>
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
                  <p className="text-2xl font-bold">${totalCurrentCost.toFixed(2)}</p>
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
                  <p className="text-2xl font-bold">${totalSavings.toFixed(2)}</p>
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

        {/* Progress Bar */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex justify-between mb-2 items-center">
              <div className="text-sm font-medium">
                {isComplete 
                  ? 'Analysis Complete!' 
                  : isAnalyzing 
                    ? `Processing shipment ${currentShipmentIndex + 1} of ${shipments.length}...` 
                    : 'Ready to analyze'
                }
              </div>
              <div className="text-sm font-medium">
                {Math.round(progress)}%
              </div>
            </div>
            <Progress value={progress} className="h-2" />
            
            {/* Control Buttons */}
            {isAnalyzing && !isComplete && (
              <div className="flex gap-2 mt-4">
                <Button
                  variant={isPaused ? "primary" : "outline"}
                  size="sm"
                  onClick={() => setIsPaused(!isPaused)}
                  iconLeft={isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                >
                  {isPaused ? 'Resume Analysis' : 'Pause Analysis'}
                </Button>
                {isPaused && (
                  <div className="text-sm text-muted-foreground self-center">
                    Analysis paused. Click Resume to continue.
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Error Display */}
        {error && (
          <Card className="mb-6 border-red-200">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-900">Analysis Error</p>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Real-time Results */}
        <Card>
          <CardHeader>
            <CardTitle>Live Analysis Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {analysisResults.map((result, index) => (
                <div 
                  key={index} 
                  className="flex items-center justify-between p-3 border border-border rounded-lg bg-card"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      {result.status === 'pending' && (
                        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                          <span className="text-xs">{index + 1}</span>
                        </div>
                      )}
                      {result.status === 'processing' && (
                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                          <RotateCw className="w-4 h-4 text-primary animate-spin" />
                        </div>
                      )}
                      {result.status === 'completed' && (
                        <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        </div>
                      )}
                      {result.status === 'error' && (
                        <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
                          <AlertCircle className="w-4 h-4 text-red-600" />
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <p className="font-medium text-sm">
                        {result.shipment.trackingId || `Shipment ${index + 1}`}
                      </p>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p>{result.shipment.originZip} → {result.shipment.destZip} | {result.shipment.weight}lbs</p>
                        {result.shipment.service && (
                          <p>Service: {result.shipment.service}</p>
                        )}
                        {(result.shipment.length || result.shipment.width || result.shipment.height) && (
                          <p>Dimensions: {result.shipment.length || 12}" × {result.shipment.width || 12}" × {result.shipment.height || 6}"</p>
                        )}
                        {result.status === 'processing' && (
                          <p className="text-primary font-medium">Getting UPS rates...</p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                   <div className="text-right">
                     {result.status === 'completed' && (
                       <div className="flex items-center gap-2">
                         <div className="text-right">
                           <p className="text-sm font-medium">
                             ${result.currentCost?.toFixed(2)} → ${result.bestRate?.totalCharges?.toFixed(2)}
                           </p>
                           <div className="text-xs text-muted-foreground mb-1">
                             via {result.bestRate?.serviceName || 'UPS Service'}
                           </div>
                           {result.savings && result.savings > 0 ? (
                             <Badge variant="secondary" className="bg-green-100 text-green-800">
                               Save ${result.savings.toFixed(2)}
                             </Badge>
                           ) : result.savings && result.savings < 0 ? (
                             <Badge variant="secondary" className="bg-red-100 text-red-800">
                               Loss ${Math.abs(result.savings).toFixed(2)}
                             </Badge>
                           ) : (
                             <Badge variant="outline">No change</Badge>
                           )}
                         </div>
                       </div>
                     )}
                    
                    {result.status === 'error' && (
                      <Badge variant="destructive">Error</Badge>
                    )}
                    
                    {result.status === 'processing' && (
                      <Badge variant="secondary">Processing...</Badge>
                    )}
                    
                    {result.status === 'pending' && (
                      <Badge variant="outline">Pending</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            {isComplete && (
              <div className="flex justify-end mt-6">
                <Button 
                  variant="primary" 
                  onClick={handleViewResults}
                  iconRight={<CheckCircle className="ml-1 h-4 w-4" />}
                >
                  View Detailed Results
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