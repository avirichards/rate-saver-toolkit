import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui-lov/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, RotateCw, AlertCircle, DollarSign, TrendingDown, Package, Shield, Clock, Pause, Play } from 'lucide-react';
import { toast } from 'sonner';
import { useShipmentValidation } from '@/hooks/useShipmentValidation';
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
  const { validateShipments, getValidShipments, validationState } = useShipmentValidation();

  useEffect(() => {
    if (csvData.length > 0 && Object.keys(fieldMappings).length > 0) {
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
    
    // Initialize analysis results
    const initialResults = processedShipments.map(shipment => ({
      shipment,
      status: 'pending' as const
    }));
    setAnalysisResults(initialResults);
  };

  const startAnalysis = async () => {
    if (shipments.length === 0) {
      toast.error('No shipments to analyze');
      return;
    }

    setIsAnalyzing(true);
    setCurrentShipmentIndex(0);
    setError(null);
    setIsComplete(false);
    setIsPaused(false);

    try {
      // Validate UPS configuration first
      await validateUpsConfiguration();
      
      // Validate shipments
      const validationResults = await validateShipments(shipments);
      
      const validShipments: ProcessedShipment[] = [];
      const invalidShipments: { shipment: ProcessedShipment; reasons: string[] }[] = [];
      
      shipments.forEach((shipment, index) => {
        const result = validationResults[index];
        if (result && result.isValid) {
          validShipments.push(shipment);
        } else {
          const reasons = result?.errors ? Object.values(result.errors).flat() : ['Validation failed'];
          invalidShipments.push({ shipment, reasons });
        }
      });

      const summary = {
        total: shipments.length,
        valid: validShipments.length,
        invalid: invalidShipments.length
      };
      
      setValidationSummary(summary);

      if (validShipments.length === 0) {
        throw new Error('No valid shipments found. Please check your data and field mappings.');
      }

      // Process shipments sequentially
      for (let i = 0; i < validShipments.length; i++) {
        if (isPaused) break;
        
        setCurrentShipmentIndex(i);
        await processShipment(i, validShipments[i]);
        
        // Small delay to show progress
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      if (!isPaused) {
        setIsComplete(true);
        
        // Calculate final totals and complete analysis
        const completedResults = analysisResults.filter(r => r.status === 'completed');
        const finalTotalSavings = completedResults.reduce((sum, r) => sum + (r.savings || 0), 0);
        const finalTotalCost = completedResults.reduce((sum, r) => sum + (r.currentCost || 0), 0);
        
        const analysisData = {
          totalSavings: finalTotalSavings,
          totalCurrentCost: finalTotalCost,
          totalShipments: completedResults.length,
          recommendations: completedResults,
          validationSummary: summary
        };

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
        const bestRate = rateQuote.rates[0]; // Assuming first rate is best
        const currentCost = parseFloat(shipment.cost || '0');
        const newCost = parseFloat(bestRate.TotalCharges?.MonetaryValue || '0');
        const savings = Math.max(0, currentCost - newCost);
        
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
                  originalService: shipment.service
                }
              : result
          );
        });

        // Update running totals
        setTotalSavings(prev => prev + savings);
        setTotalCurrentCost(prev => prev + currentCost);
      } else {
        throw new Error(rateQuote.error || 'No rates returned from UPS');
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
                attemptCount: retryCount + 1
              }
            : result
        );
      });
    }
  };

  const getUpsRateQuote = async (shipment: ProcessedShipment) => {
    try {
      const originCity = getCityStateFromZip(shipment.originZip || '');
      const destCity = getCityStateFromZip(shipment.destZip || '');
      
      if (!originCity || !destCity) {
        throw new Error('Invalid ZIP codes');
      }

      const isResidential = determineResidentialStatus(shipment, undefined);
      const serviceCodes = getServiceCodesToRequest(shipment.service || 'Ground');

      const shipmentData = {
        shipper: {
          address: {
            city: originCity.city,
            stateProvinceCode: originCity.state,
            postalCode: shipment.originZip,
            countryCode: 'US'
          }
        },
        shipTo: {
          address: {
            city: destCity.city,
            stateProvinceCode: destCity.state,
            postalCode: shipment.destZip,
            countryCode: 'US',
            residentialAddressIndicator: isResidential
          }
        },
        package: {
          weight: {
            unitOfMeasurement: { code: 'LBS' },
            weight: shipment.weight || '1'
          },
          dimensions: {
            unitOfMeasurement: { code: 'IN' },
            length: shipment.length || '12',
            width: shipment.width || '12',
            height: shipment.height || '12'
          }
        },
        serviceCodes
      };

      const { data, error } = await supabase.functions.invoke('ups-rate-quote', {
        body: { shipmentData }
      });

      if (error) throw error;
      return data;
    } catch (error: any) {
      return { success: false, error: error.message };
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
          <Button onClick={startAnalysis} size="lg">
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
            <Button variant="outline" onClick={startAnalysis} className="mt-4">
              Retry Analysis
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};