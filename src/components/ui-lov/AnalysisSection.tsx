import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui-lov/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, RotateCw, AlertCircle, DollarSign, TrendingDown, Package, Shield, Clock, Pause, Play } from 'lucide-react';
import { toast } from 'sonner';
import { useShipmentValidation } from '@/hooks/useShipmentValidation';
import { useUpsConnectivity } from '@/hooks/useUpsConnectivity';
import { useTestMode } from '@/hooks/useTestMode';
import { useAutoSave } from '@/hooks/useAutoSave';
import { ValidationSummary } from '@/components/ui-lov/ValidationSummary';
import { getCityStateFromZip } from '@/utils/zipCodeMapping';
import { mapServiceToServiceCode, getServiceCodesToRequest } from '@/utils/serviceMapping';
import type { ServiceMapping } from '@/utils/csvParser';
import { determineResidentialStatus } from '@/utils/csvParser';

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
  recipientState?: string;
}

interface AnalysisResult {
  shipment: ProcessedShipment;
  status: 'pending' | 'processing' | 'completed' | 'error';
  currentCost?: number;
  originalService?: string;
  upsRates?: any[];
  bestRate?: any;
  savings?: number;
  error?: string;
  errorType?: string;
  errorCategory?: string;
  attemptCount?: number;
  expectedServiceCode?: string;
  mappingValidation?: {
    isValid: boolean;
    expectedService: string;
    actualService: string;
    expectedServiceCode?: string;
    actualServiceCode?: string;
    message?: string;
  };
}

interface AnalysisSectionProps {
  csvData: any[];
  fieldMappings: Record<string, string>;
  serviceMappings: ServiceMapping[];
  reportId?: string;
  onAnalysisComplete: (results: any) => void;
}

export const AnalysisSection: React.FC<AnalysisSectionProps> = ({
  csvData,
  fieldMappings,
  serviceMappings,
  reportId,
  onAnalysisComplete
}) => {
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
  const [csvResidentialField, setCsvResidentialField] = useState<string | undefined>(undefined);
  
  // Use all the original hooks for full functionality
  const { validateShipments, getValidShipments, validationState } = useShipmentValidation();
  const { testing, testUpsConnection } = useUpsConnectivity();
  const { isTestMode, isDevelopment } = useTestMode();
  const { triggerSave, saveNow } = useAutoSave(reportId || null, {}, true);

  useEffect(() => {
    if (csvData.length > 0 && Object.keys(fieldMappings).length > 0) {
      console.log('🔄 Initializing shipments with:', {
        csvDataLength: csvData.length,
        fieldMappingsCount: Object.keys(fieldMappings).length,
        fieldMappings
      });
      initializeShipments();
    }
  }, [csvData, fieldMappings]);

  const initializeShipments = () => {
    // Process CSV data into shipments using the confirmed mappings
    const processedShipments = csvData.map((row, index) => {
      const shipment: ProcessedShipment = { id: index + 1 };
      
      Object.entries(fieldMappings).forEach(([fieldName, csvHeader]) => {
        if (csvHeader && csvHeader !== "__NONE__" && row[csvHeader] !== undefined) {
          let value = row[csvHeader];
          if (typeof value === 'string') {
            value = value.trim();
          }
          (shipment as any)[fieldName] = value;
        }
      });
      
      return shipment;
    });

    console.log(`✅ Processed ${processedShipments.length} shipments from CSV data`);
    setShipments(processedShipments);
    
    // Check if we have a residential field mapped from CSV
    const residentialField = Object.entries(fieldMappings).find(([fieldName, csvHeader]) => 
      fieldName === 'isResidential' && csvHeader && csvHeader !== "__NONE__"
    );
    if (residentialField) {
      setCsvResidentialField(residentialField[1]);
      console.log('Found residential field mapping:', residentialField[1]);
    }
    
    // Initialize analysis results
    const initialResults = processedShipments.map(shipment => ({
      shipment,
      status: 'pending' as const
    }));
    setAnalysisResults(initialResults);
  };

  const validateAndStartAnalysis = async (shipmentsToAnalyze: ProcessedShipment[]) => {
    setIsAnalyzing(true);
    setError(null);
    
    try {
      console.log('🔍 Starting validation of shipments:', {
        totalShipments: shipmentsToAnalyze.length,
        sampleShipments: shipmentsToAnalyze.slice(0, 3).map(s => ({
          id: s.id,
          trackingId: s.trackingId,
          service: s.service,
          originZip: s.originZip,
          destZip: s.destZip,
          weight: s.weight,
          cost: s.cost
        }))
      });
      
      const validationResults = await validateShipments(shipmentsToAnalyze);
      
      const validShipments: ProcessedShipment[] = [];
      const invalidShipments: { shipment: ProcessedShipment; reasons: string[] }[] = [];
      
      shipmentsToAnalyze.forEach((shipment, index) => {
        const result = validationResults[index];
        if (result && result.isValid) {
          validShipments.push(shipment);
        } else {
          const reasons = result?.errors ? Object.values(result.errors).flat() : ['Validation failed'];
          invalidShipments.push({ shipment, reasons });
        }
      });
      
      const summary = {
        total: shipmentsToAnalyze.length,
        valid: validShipments.length,
        invalid: invalidShipments.length
      };
      
      setValidationSummary(summary);
      
      console.log('✅ Validation complete:', summary);
      
      // Store invalid shipments in analysis results for tracking
      const invalidResults = invalidShipments.map(({ shipment, reasons }) => ({
        shipment,
        status: 'error' as const,
        error: `Validation failed: ${reasons.join(', ')}`,
        errorType: 'validation_error',
        errorCategory: 'Data Validation'
      }));
      
      // Initialize results with both valid (pending) and invalid (error) shipments
      const initialResults = [
        ...validShipments.map(shipment => ({
          shipment,
          status: 'pending' as const
        })),
        ...invalidResults
      ];
      
      setAnalysisResults(initialResults);
      
      if (validShipments.length === 0) {
        throw new Error('No valid shipments found. Please check your data and field mappings.');
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
    setIsComplete(false);
    setIsPaused(false);

    console.log('🚀 Starting sequential analysis of shipments:', {
      totalShipments: shipmentsToAnalyze.length,
      serviceMappingsAvailable: serviceMappings.length,
      firstShipment: shipmentsToAnalyze[0]
    });

    try {
      // Validate UPS configuration first
      await validateUpsConfiguration();
      
      // Process shipments sequentially
      for (let i = 0; i < shipmentsToAnalyze.length; i++) {
        if (isPaused) {
          console.log('Analysis paused, stopping processing');
          break;
        }
        
        console.log(`🔄 Processing shipment ${i + 1}/${shipmentsToAnalyze.length}`, {
          shipmentId: shipmentsToAnalyze[i].id,
          service: shipmentsToAnalyze[i].service,
          weight: shipmentsToAnalyze[i].weight
        });
        
        setCurrentShipmentIndex(i);
        await processShipment(i, shipmentsToAnalyze[i]);
        
        // Auto-save progress periodically
        if (i % 10 === 0 && reportId) {
          triggerSave();
        }
        
        // Small delay to show progress
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      if (!isPaused) {
        console.log('✅ Analysis complete');
        setIsComplete(true);
        
        // Calculate final totals and complete analysis
        const completedResults = analysisResults.filter(r => r.status === 'completed');
        const finalTotalSavings = completedResults.reduce((sum, r) => sum + (r.savings || 0), 0);
        const finalTotalCost = completedResults.reduce((sum, r) => sum + (r.currentCost || 0), 0);
        
        const analysisData = {
          totalSavings: finalTotalSavings,
          totalCurrentCost: finalTotalCost,
          totalShipments: shipmentsToAnalyze.length,
          completedShipments: completedResults.length,
          errorShipments: analysisResults.filter(r => r.status === 'error').length,
          recommendations: completedResults,
          validationSummary: validationSummary,
          orphanedShipments: analysisResults.filter(r => r.status === 'error'),
          analysisComplete: true,
          processingDate: new Date().toISOString()
        };

        // Save final results to database if reportId provided
        if (reportId) {
          await saveNow();
        }

        onAnalysisComplete(analysisData);
        toast.success(`Analysis complete! Found ${finalTotalSavings > 0 ? '$' + finalTotalSavings.toFixed(2) : '$0'} in potential savings.`);
      }
      
    } catch (error: any) {
      console.error('Analysis error:', error);
      setError(error.message);
      toast.error('Analysis failed: ' + error.message);
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

  const processShipment = async (index: number, shipment: ProcessedShipment, retryCount = 0) => {
    const maxRetries = 2;
    
    console.log(`🔍 Processing shipment ${index + 1} (attempt ${retryCount + 1}/${maxRetries + 1}):`, {
      shipmentId: shipment.id,
      service: shipment.service,
      carrier: shipment.carrier,
      originZip: shipment.originZip,
      destZip: shipment.destZip,
      weight: shipment.weight,
      cost: shipment.cost,
      isRetry: retryCount > 0
    });
    
    // Update status to processing
    setAnalysisResults(prev => {
      return prev.map(result => 
        result.shipment.id === shipment.id 
          ? { ...result, status: 'processing' }
          : result
      );
    });

    try {
      // Get UPS rate quote
      const rateQuote = await getUpsRateQuote(shipment);
      
      if (rateQuote.success && rateQuote.rates && rateQuote.rates.length > 0) {
        const bestRate = rateQuote.rates[0];
        const currentCost = parseFloat(shipment.cost || '0');
        // Handle both old and new data formats
        const newCost = parseFloat(
          bestRate.totalCharges || 
          bestRate.TotalCharges?.MonetaryValue || 
          bestRate.total_cost || 
          '0'
        );
        const savings = Math.max(0, currentCost - newCost);
        
        console.log(`💰 Shipment ${shipment.id} calculation:`, {
          currentCost,
          newCost,
          savings,
          bestRateService: bestRate.serviceName || bestRate.Service?.Description || bestRate.service_name
        });
        
        // Update analysis results
        setAnalysisResults(prev => {
          return prev.map(result => 
            result.shipment.id === shipment.id 
              ? { 
                  ...result, 
                  status: 'completed',
                  currentCost,
                  upsRates: rateQuote.rates,
                  bestRate,
                  savings,
                  originalService: shipment.service,
                  attemptCount: retryCount + 1
                }
              : result
          );
        });

        // Update running totals
        setTotalSavings(prev => prev + savings);
        setTotalCurrentCost(prev => prev + currentCost);
        
        console.log(`✅ Shipment ${shipment.id} processed successfully:`, {
          currentCost,
          newCost,
          savings,
          serviceName: bestRate.Service?.Description || bestRate.service_name,
          totalSavingsSoFar: totalSavings + savings
        });
      } else {
        const errorMsg = rateQuote.error || 'No rates returned from UPS';
        console.error(`❌ UPS Rate Quote failed for shipment ${shipment.id}:`, {
          error: errorMsg,
          rateQuoteResponse: rateQuote,
          shipmentData: {
            originZip: shipment.originZip,
            destZip: shipment.destZip,
            weight: shipment.weight,
            service: shipment.service
          }
        });
        throw new Error(errorMsg);
      }
    } catch (error: any) {
      console.error(`Error processing shipment ${shipment.id}:`, error);
      
      if (retryCount < maxRetries) {
        console.log(`Retrying shipment ${shipment.id} (attempt ${retryCount + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return processShipment(index, shipment, retryCount + 1);
      }
      
      // Mark as error after all retries
      setAnalysisResults(prev => {
        return prev.map(result => 
          result.shipment.id === shipment.id 
            ? { 
                ...result, 
                status: 'error',
                error: error.message,
                errorType: 'ups_api_error',
                errorCategory: 'UPS API Error',
                attemptCount: retryCount + 1
              }
            : result
        );
      });
    }
  };

  const getUpsRateQuote = async (shipment: ProcessedShipment) => {
    try {
      console.log('🔍 Getting UPS rate quote for shipment:', {
        id: shipment.id,
        originZip: shipment.originZip,
        destZip: shipment.destZip,
        weight: shipment.weight,
        service: shipment.service
      });

      // Validate required fields
      if (!shipment.originZip || !shipment.destZip || !shipment.weight) {
        throw new Error(`Missing required fields - Origin: ${shipment.originZip}, Dest: ${shipment.destZip}, Weight: ${shipment.weight}`);
      }

      const originCity = getCityStateFromZip(shipment.originZip);
      const destCity = getCityStateFromZip(shipment.destZip);
      
      if (!originCity || !destCity) {
        console.warn(`⚠️ Could not resolve cities for ZIP codes: ${shipment.originZip} → ${shipment.destZip}`);
        // Use fallback ZIP codes but continue processing
      }

      const isResidential = csvResidentialField && shipment.hasOwnProperty(csvResidentialField) 
        ? (shipment as any)[csvResidentialField] === 'true' || (shipment as any)[csvResidentialField] === true
        : false; // Default to false if not specified

      const serviceCodes = getServiceCodesToRequest(shipment.service || 'Ground');
      console.log('🚛 Service codes to request:', serviceCodes);

      // Enhanced shipment data with better validation
      const shipmentData = {
        shipper: {
          address: {
            city: originCity?.city || 'Atlanta',
            stateProvinceCode: originCity?.state || 'GA',
            postalCode: shipment.originZip.replace(/[^0-9-]/g, ''),
            countryCode: 'US'
          }
        },
        shipTo: {
          address: {
            city: destCity?.city || 'Atlanta',
            stateProvinceCode: destCity?.state || 'GA',
            postalCode: shipment.destZip.replace(/[^0-9-]/g, ''),
            countryCode: 'US',
            residentialAddressIndicator: isResidential
          }
        },
        package: {
          weight: {
            unitOfMeasurement: { code: 'LBS' },
            weight: Math.max(1, parseFloat(shipment.weight || '1')).toString()
          },
          dimensions: {
            unitOfMeasurement: { code: 'IN' },
            length: shipment.length || '12',
            width: shipment.width || '12',
            height: shipment.height || '12'
          }
        },
        serviceCodes,
        // Add shipment context for better debugging
        shipmentContext: {
          id: shipment.id,
          originalService: shipment.service,
          cost: shipment.cost
        }
      };

      console.log('📦 Sending UPS request with data:', shipmentData);

      const { data, error } = await supabase.functions.invoke('ups-rate-quote', {
        body: { shipmentData }
      });

      if (error) {
        console.error('❌ UPS Edge Function Error:', error);
        throw new Error(`UPS API Error: ${error.message || 'Unknown error'}`);
      }

      if (!data) {
        console.error('❌ No data returned from UPS Edge Function');
        throw new Error('No response from UPS API');
      }

      console.log('✅ UPS Rate Quote Response:', {
        success: data.success,
        ratesCount: data.rates?.length || 0,
        error: data.error
      });

      return data;
    } catch (error: any) {
      console.error('❌ UPS rate quote error:', error);
      return { 
        success: false, 
        error: error.message,
        shipmentId: shipment.id 
      };
    }
  };

  const togglePause = () => {
    setIsPaused(!isPaused);
    if (isPaused) {
      toast.info('Analysis resumed');
    } else {
      toast.info('Analysis paused');
    }
  };

  if (isComplete) {
    return (
      <div className="text-center py-12">
        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">Analysis Complete!</h2>
        <p className="text-muted-foreground mb-4">
          Found ${totalSavings.toFixed(2)} in potential savings across {analysisResults.filter(r => r.status === 'completed').length} shipments.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-md mx-auto">
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{analysisResults.filter(r => r.status === 'completed').length}</div>
            <div className="text-sm text-green-700">Completed</div>
          </div>
          <div className="bg-red-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-red-600">{analysisResults.filter(r => r.status === 'error').length}</div>
            <div className="text-sm text-red-700">Errors</div>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">${totalSavings.toFixed(2)}</div>
            <div className="text-sm text-blue-700">Total Savings</div>
          </div>
        </div>
      </div>
    );
  }

  const completedCount = analysisResults.filter(r => r.status === 'completed').length;
  const errorCount = analysisResults.filter(r => r.status === 'error').length;
  const processingCount = analysisResults.filter(r => r.status === 'processing').length;
  const totalCount = shipments.length;
  const progressPercent = totalCount > 0 ? ((completedCount + errorCount) / totalCount) * 100 : 0;

  return (
    <div className="space-y-6">
      {!isAnalyzing && !isComplete && (
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">Ready to Analyze {shipments.length} Shipments</h2>
          <p className="text-muted-foreground mb-6">
            We'll compare your current shipping costs with UPS rates to find potential savings.
          </p>
          
          {/* UPS Connectivity Status */}
          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center justify-center gap-2">
              <Shield className="h-5 w-5 text-blue-600" />
              <span className="font-medium text-blue-900">
                UPS API: {testing ? 'Testing...' : 'Ready'}
              </span>
            </div>
            <p className="text-sm text-blue-700 mt-1">
              Connection will be verified when analysis starts
            </p>
          </div>

          {/* Test Mode Warning */}
          {isTestMode && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center justify-center gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
                <span className="font-medium text-yellow-900">Test Mode Active</span>
              </div>
              <p className="text-sm text-yellow-700 mt-1">Running in development mode</p>
            </div>
          )}
          
          <Button onClick={() => validateAndStartAnalysis(shipments)} size="lg">
            Start Analysis
          </Button>
        </div>
      )}

      {isAnalyzing && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Analysis Progress</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={togglePause}
                  className="flex items-center gap-2"
                >
                  {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                  {isPaused ? 'Resume' : 'Pause'}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Progress value={progressPercent} className="w-full" />
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{totalCount}</div>
                    <div className="text-sm text-muted-foreground">Total</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{completedCount}</div>
                    <div className="text-sm text-muted-foreground">Completed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">{processingCount}</div>
                    <div className="text-sm text-muted-foreground">Processing</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{errorCount}</div>
                    <div className="text-sm text-muted-foreground">Errors</div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span>Processing shipment {currentShipmentIndex + 1} of {totalCount}</span>
                  <span>{Math.round(progressPercent)}% complete</span>
                </div>

                {totalSavings > 0 && (
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-lg font-semibold text-green-700">
                      ${totalSavings.toFixed(2)} in potential savings found so far
                    </div>
                  </div>
                )}

                {isPaused && (
                  <div className="text-center p-4 bg-yellow-50 rounded-lg">
                    <div className="flex items-center justify-center gap-2 text-yellow-700">
                      <Clock className="h-5 w-5" />
                      <span className="font-medium">Analysis Paused</span>
                    </div>
                    <p className="text-sm text-yellow-600 mt-1">
                      Click Resume to continue processing shipments
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {validationSummary && (
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-sm mb-2 text-blue-900">Validation Summary:</h4>
              <p className="text-sm text-blue-700">
                {validationSummary.valid} valid shipments, {validationSummary.invalid} invalid shipments out of {validationSummary.total} total
              </p>
            </div>
          )}
        </div>
      )}

      {error && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              <span className="font-medium">Analysis Error</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">{error}</p>
            <Button variant="outline" onClick={() => validateAndStartAnalysis(shipments)} className="mt-4">
              Retry Analysis
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};