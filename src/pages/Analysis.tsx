import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui-lov/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, RotateCw, AlertCircle, DollarSign, Package, Clock, Pause, Play } from 'lucide-react';
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
  currentRate?: string;
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
  zone?: string;
}

interface AnalysisProgress {
  analysisId: string;
  totalShipments: number;
  processedShipments: number;
  currentStatus: 'validating' | 'processing' | 'completed' | 'failed';
  totalSavings: number;
  totalCurrentCost: number;
  estimatedTimeRemaining?: number;
  errorCount: number;
}

const Analysis = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [shipments, setShipments] = useState<ProcessedShipment[]>([]);
  const [analysisProgress, setAnalysisProgress] = useState<AnalysisProgress | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationSummary, setValidationSummary] = useState<any>(null);
  const [serviceMappings, setServiceMappings] = useState<ServiceMapping[]>([]);
  const [csvResidentialField, setCsvResidentialField] = useState<string | undefined>(undefined);
  const [readyToAnalyze, setReadyToAnalyze] = useState(false);
  const [selectedCarriers, setSelectedCarriers] = useState<string[]>([]);
  const [carrierSelectionComplete, setCarrierSelectionComplete] = useState(false);
  const [hasLoadedInitialCarriers, setHasLoadedInitialCarriers] = useState(false);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);
  
  const { validateShipments, validationState } = useShipmentValidation();
  
  // Load shipment data from route state
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
    
    if (state.uploadTimestamp && (Date.now() - state.uploadTimestamp) > 300000) {
      toast.warning('Using data older than 5 minutes');
    }
    
    if (!state.serviceMappings || state.serviceMappings.length === 0) {
      toast.error('No service mappings found. Please complete the service mapping step first.');
      navigate('/service-mapping', { 
        state: { 
          csvData: state.csvData,
          mappings: state.mappings,
          fileName: state.fileName,
          csvUploadId: state.csvUploadId,
          originZipOverride: state.originZipOverride
        }
      });
      return;
    }
    
    // Process CSV data into shipments
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
    setServiceMappings(state.serviceMappings);
    
    // Check if we have a residential field mapped from CSV
    const residentialField = Object.entries(state.mappings).find(([fieldName, csvHeader]) => 
      fieldName === 'isResidential' && csvHeader && csvHeader !== "__NONE__"
    );
    if (residentialField) {
      setCsvResidentialField(residentialField[1]);
    }
    
    setReadyToAnalyze(true);
  }, [location, navigate]);
  
  // Load initial carriers
  useEffect(() => {
    const loadInitialCarriers = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setHasLoadedInitialCarriers(true);
      } catch (error) {
        console.error('Error loading carrier configs:', error);
        setHasLoadedInitialCarriers(true);
      }
    };

    if (shipments.length > 0 && !hasLoadedInitialCarriers) {
      loadInitialCarriers();
    }
  }, [shipments, hasLoadedInitialCarriers]);

  // Start analysis when ready
  useEffect(() => {
    if (readyToAnalyze && serviceMappings.length > 0 && shipments.length > 0 && 
        selectedCarriers.length > 0 && carrierSelectionComplete && !isAnalyzing) {
      startBulkAnalysis();
      setReadyToAnalyze(false);
    }
  }, [readyToAnalyze, serviceMappings, shipments, selectedCarriers, carrierSelectionComplete, isAnalyzing]);

  // Poll for analysis progress via REST API
  const pollAnalysisProgress = useCallback(async (analysisId: string) => {
    try {
      const response = await fetch(`http://localhost:5000/api/analyses/${analysisId}/progress`);
      
      if (!response.ok) {
        console.error('Error polling analysis progress: HTTP', response.status);
        return;
      }

      const data = await response.json();
      
      setAnalysisProgress({
        analysisId,
        totalShipments: data.total_shipments,
        processedShipments: data.processed_shipments,
        currentStatus: data.status === 'completed' ? 'completed' : 
                      data.status === 'failed' ? 'failed' : 'processing',
        totalSavings: data.total_savings || 0,
        totalCurrentCost: data.total_current_cost || 0,
        errorCount: data.error_count || 0
      });

      // Stop polling if completed or failed
      if (data.status === 'completed' || data.status === 'failed') {
        if (pollInterval) {
          clearInterval(pollInterval);
          setPollInterval(null);
        }
        setIsAnalyzing(false);
        
        if (data.status === 'completed') {
          toast.success(`Analysis completed! Processed ${data.processed_shipments} shipments with $${data.total_savings?.toFixed(2) || '0.00'} total savings.`);
          navigate('/results', { 
            state: { 
              analysisId, 
              fileName: location.state?.fileName || 'Bulk Analysis' 
            } 
          });
        } else {
          toast.error('Analysis failed. Please try again.');
          setError('Analysis processing failed on the server.');
        }
      }
    } catch (error) {
      console.error('Error polling progress:', error);
    }
  }, [pollInterval, navigate, location.state]);

  const startBulkAnalysis = async () => {
    setIsAnalyzing(true);
    setError(null);
    
    try {
      console.log('🚀 Starting bulk analysis with', shipments.length, 'shipments');
      
      // Quick validation of first 500 shipments on client (for immediate feedback)
      const validationSample = shipments.slice(0, 500);
      const validationResults = await validateShipments(validationSample);
      
      const validCount = Object.values(validationResults).filter(r => r.isValid).length;
      const invalidCount = validationSample.length - validCount;
      
      setValidationSummary({
        total: shipments.length,
        validSample: validCount,
        invalidSample: invalidCount,
        sampleSize: validationSample.length,
        message: `Validated ${validationSample.length} sample shipments. Full validation will occur on server.`
      });

      // Create analysis record
      const analysisId = await createAnalysisRecord();
      if (!analysisId) {
        throw new Error('Failed to create analysis record');
      }

      // Start bulk processing via REST API
      const response = await fetch('http://localhost:5000/api/analyses/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          analysisId,
          shipments,
          carrierConfigs: selectedCarriers,
          serviceMappings,
          columnMappings: location.state?.mappings,
          originZipOverride: location.state?.originZipOverride,
          fileName: location.state?.fileName || 'Bulk Analysis'
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Analysis failed' }));
        throw new Error(`Bulk analysis failed: ${errorData.message}`);
      }

      const data = await response.json();

      console.log('✅ Bulk analysis started:', data);
      
      // Initialize progress tracking
      setAnalysisProgress({
        analysisId,
        totalShipments: shipments.length,
        processedShipments: 0,
        currentStatus: 'processing',
        totalSavings: 0,
        totalCurrentCost: 0,
        errorCount: 0,
        estimatedTimeRemaining: data.estimatedTime
      });

      // Set up WebSocket for real-time progress
      const socket = new WebSocket('ws://localhost:5000/ws');
      socket.send(JSON.stringify({type: 'subscribe', analysisId: analysisId}));
      
      socket.onmessage = (event) => {
        const progressData = JSON.parse(event.data);
        setAnalysisProgress(progressData);
        
        if (progressData.currentStatus === 'completed') {
          socket.close();
          clearInterval(interval);
          navigate('/results', { 
            state: { 
              analysisId, 
              fileName: location.state?.fileName || 'Bulk Analysis' 
            } 
          });
        }
      };

      // Fallback polling in case WebSocket fails
      const interval = setInterval(() => {
        pollAnalysisProgress(analysisId);
      }, 5000); // Poll every 5 seconds as fallback
      
      setPollInterval(interval);

    } catch (error: any) {
      console.error('Bulk analysis error:', error);
      setError(error.message);
      setIsAnalyzing(false);
      toast.error(`Analysis failed: ${error.message}`);
    }
  };

  const createAnalysisRecord = async (): Promise<string | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Please log in to run analysis');
    }

    const state = location.state as any;
    const baseName = state?.fileName || 'Bulk Analysis';

    const analysisRecord = {
      user_id: user.id,
      file_name: baseName,
      report_name: `${baseName} - ${new Date().toLocaleDateString()}`,
      total_shipments: shipments.length,
      original_data: shipments as any,
      carrier_configs_used: selectedCarriers as any,
      service_mappings: serviceMappings as any,
      column_mappings: state?.mappings as any,
      status: 'processing',
      csv_upload_id: state?.csvUploadId,
      processing_metadata: {
        startedAt: new Date().toISOString(),
        processingMethod: 'bulk_analysis',
        shipmentsCount: shipments.length,
        carrierCount: selectedCarriers.length
      } as any
    };

    const { data, error } = await supabase
      .from('shipping_analyses')
      .insert(analysisRecord)
      .select('id')
      .single();

    if (error) {
      console.error('Error creating analysis record:', error);
      throw new Error('Failed to create analysis record');
    }

    return data.id;
  };

  const handleViewResults = () => {
    if (analysisProgress?.analysisId) {
      navigate('/results', { 
        state: { 
          analysisId: analysisProgress.analysisId,
          fromBulkAnalysis: true
        } 
      });
    }
  };

  const handleStopAnalysis = () => {
    if (pollInterval) {
      clearInterval(pollInterval);
      setPollInterval(null);
    }
    setIsAnalyzing(false);
    setIsPaused(true);
    toast.info('Analysis monitoring stopped. You can check results later in Reports.');
  };

  const progressPercentage = analysisProgress ? 
    Math.round((analysisProgress.processedShipments / analysisProgress.totalShipments) * 100) : 0;

  return (
    <DashboardLayout>
      <div className="p-6 max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Shipment Analysis</h1>
          <p className="text-muted-foreground">
            High-performance bulk rate analysis for {shipments.length.toLocaleString()} shipments
          </p>
        </div>

        {/* Carrier Selection */}
        {!isAnalyzing && !analysisProgress && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Select Carrier Accounts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CarrierSelector
                selectedCarriers={selectedCarriers}
                onCarrierChange={setSelectedCarriers}
                hasZoneMapping={!!csvResidentialField}
              />
              {selectedCarriers.length > 0 && !carrierSelectionComplete && (
                <Button 
                  onClick={() => setCarrierSelectionComplete(true)} 
                  variant="primary" 
                  className="mt-4"
                >
                  Start Analysis
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Validation Summary */}
        {validationSummary && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="space-y-2">
                <h3 className="font-medium text-lg">Validation Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold">{validationSummary.total.toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">Total Shipments</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{validationSummary.validSample}</div>
                    <div className="text-sm text-muted-foreground">Valid (Sample)</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-red-600">{validationSummary.invalidSample}</div>
                    <div className="text-sm text-muted-foreground">Invalid (Sample)</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold">{validationSummary.sampleSize}</div>
                    <div className="text-sm text-muted-foreground">Sample Size</div>
                  </div>
                </div>
                {validationSummary.message && (
                  <p className="text-muted-foreground text-sm">{validationSummary.message}</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Analysis Progress */}
        {(isAnalyzing || analysisProgress) && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {analysisProgress?.currentStatus === 'completed' ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : analysisProgress?.currentStatus === 'failed' ? (
                  <AlertCircle className="h-5 w-5 text-red-500" />
                ) : (
                  <RotateCw className="h-5 w-5 animate-spin text-blue-500" />
                )}
                Analysis Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              {analysisProgress && (
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Processing shipments...</span>
                      <span>{analysisProgress.processedShipments.toLocaleString()} / {analysisProgress.totalShipments.toLocaleString()}</span>
                    </div>
                    <Progress value={progressPercentage} className="h-2" />
                    <div className="flex justify-between text-sm text-muted-foreground mt-1">
                      <span>{progressPercentage}% complete</span>
                      {analysisProgress.estimatedTimeRemaining && (
                        <span>~{analysisProgress.estimatedTimeRemaining} min remaining</span>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        ${analysisProgress.totalSavings.toFixed(0)}
                      </div>
                      <div className="text-sm text-muted-foreground">Total Savings</div>
                    </div>
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <div className="text-2xl font-bold">
                        {analysisProgress.processedShipments.toLocaleString()}
                      </div>
                      <div className="text-sm text-muted-foreground">Processed</div>
                    </div>
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <div className="text-2xl font-bold">
                        {(analysisProgress.totalShipments - analysisProgress.processedShipments).toLocaleString()}
                      </div>
                      <div className="text-sm text-muted-foreground">Remaining</div>
                    </div>
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <div className="text-2xl font-bold text-red-600">
                        {analysisProgress.errorCount}
                      </div>
                      <div className="text-sm text-muted-foreground">Errors</div>
                    </div>
                  </div>

                  {/* Control Buttons */}
                  <div className="flex gap-3">
                    {analysisProgress.currentStatus === 'completed' ? (
                      <Button onClick={handleViewResults} variant="primary" className="flex-1">
                        <CheckCircle className="h-4 w-4 mr-2" />
                        View Results
                      </Button>
                    ) : analysisProgress.currentStatus === 'failed' ? (
                      <Button onClick={() => navigate('/upload')} variant="outline" className="flex-1">
                        <RotateCw className="h-4 w-4 mr-2" />
                        Start Over
                      </Button>
                    ) : (
                      <>
                        <Button onClick={handleStopAnalysis} variant="outline" className="flex-1">
                          <Pause className="h-4 w-4 mr-2" />
                          Stop Monitoring
                        </Button>
                        <Button onClick={handleViewResults} variant="secondary" className="flex-1">
                          <DollarSign className="h-4 w-4 mr-2" />
                          View Partial Results
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Error Display */}
        {error && (
          <Card className="mb-6 border-red-200">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
                <div>
                  <h3 className="font-medium text-red-900">Analysis Error</h3>
                  <p className="text-red-700 mt-1">{error}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Info Card */}
        {!isAnalyzing && !analysisProgress && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <div className="mx-auto w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Package className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-medium mb-2">Ready for High-Speed Analysis</h3>
                  <p className="text-muted-foreground">
                    Select your carrier accounts above to begin processing {shipments.length.toLocaleString()} shipments.
                    This new bulk analysis system is up to 400x faster than before!
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Analysis;