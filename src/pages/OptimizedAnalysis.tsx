import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui-lov/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, RotateCw, AlertCircle, DollarSign, TrendingDown, Package, Pause, Play, StopCircle } from 'lucide-react';
import { toast } from 'sonner';
import { VirtualizedResultsTable } from '@/components/ui-lov/VirtualizedResultsTable';
import { ValidationSummary } from '@/components/ui-lov/ValidationSummary';
import { CarrierSelector } from '@/components/ui-lov/CarrierSelector';
import { useOptimizedAnalysis } from '@/hooks/useOptimizedAnalysis';
import { formatCurrency } from '@/lib/utils';
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

const OptimizedAnalysis = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [shipments, setShipments] = useState<ProcessedShipment[]>([]);
  const [serviceMappings, setServiceMappings] = useState<ServiceMapping[]>([]);
  const [selectedCarriers, setSelectedCarriers] = useState<string[]>([]);
  const [carrierSelectionComplete, setCarrierSelectionComplete] = useState(false);
  const [isReadyToStart, setIsReadyToStart] = useState(false);
  
  const {
    results,
    summary,
    isProcessing,
    progress,
    isPaused,
    startAnalysis,
    pauseAnalysis,
    resumeAnalysis,
    clearResults
  } = useOptimizedAnalysis();

  // Process CSV data from navigation state
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

    // Process CSV data using Web Worker
    const worker = new Worker('/csvProcessor.js');
    
    worker.postMessage({
      type: 'PROCESS_BATCH',
      data: {
        rows: state.csvData,
        mappings: state.mappings,
        startIndex: 0,
        originZipOverride: state.originZipOverride
      }
    });

    worker.onmessage = (e) => {
      const { type, data } = e.data;
      
      if (type === 'BATCH_COMPLETE') {
        setShipments(data.shipments);
        setServiceMappings(state.serviceMappings || []);
        setIsReadyToStart(true);
        toast.success(`✅ Processed ${data.shipments.length} shipments`);
      } else if (type === 'ERROR') {
        toast.error(`Processing error: ${data.error}`);
      }
      
      worker.terminate();
    };

    return () => worker.terminate();
  }, [location, navigate]);

  // Calculate totals
  const totals = useMemo(() => ({
    currentCost: summary.totalCurrentCost,
    savings: summary.totalSavings,
    savingsPercentage: summary.totalCurrentCost > 0 
      ? (summary.totalSavings / summary.totalCurrentCost) * 100 
      : 0
  }), [summary]);

  const handleStartAnalysis = async () => {
    if (shipments.length === 0 || selectedCarriers.length === 0) {
      toast.error('Please select carriers and ensure shipments are loaded');
      return;
    }

    try {
      await startAnalysis(shipments, selectedCarriers, serviceMappings);
      toast.success('Analysis completed successfully!');
    } catch (error) {
      toast.error(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleViewResults = () => {
    if (summary.completed === 0) {
      toast.warning('No completed analyses to view');
      return;
    }

    navigate('/results', {
      state: {
        analysisComplete: true,
        totalSavings: totals.savings,
        totalCurrentCost: totals.currentCost,
        results: results.filter(r => r.status === 'completed'),
        summary: {
          totalShipments: summary.totalShipments,
          validShipments: summary.completed,
          invalidShipments: summary.errors,
          totalSavings: totals.savings,
          savingsPercentage: totals.savingsPercentage
        }
      }
    });
  };

  const isAnalysisInProgress = isProcessing && !isPaused;
  const canStartAnalysis = isReadyToStart && !isProcessing && selectedCarriers.length > 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Rate Analysis</h1>
            <p className="text-muted-foreground">
              Real-time analysis of shipping rates across multiple carriers
            </p>
          </div>
        </div>

        {/* Progress Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Package className="h-4 w-4 text-muted-foreground" />
                <div className="ml-2">
                  <p className="text-sm font-medium text-muted-foreground">Total Shipments</p>
                  <p className="text-2xl font-bold">{summary.totalShipments.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <div className="ml-2">
                  <p className="text-sm font-medium text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold text-green-600">{summary.completed.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <DollarSign className="h-4 w-4 text-green-600" />
                <div className="ml-2">
                  <p className="text-sm font-medium text-muted-foreground">Total Savings</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(totals.savings)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <TrendingDown className="h-4 w-4 text-green-600" />
                <div className="ml-2">
                  <p className="text-sm font-medium text-muted-foreground">Savings %</p>
                  <p className="text-2xl font-bold text-green-600">
                    {totals.savingsPercentage.toFixed(1)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Carrier Selection */}
        {!isProcessing && (
          <Card>
            <CardHeader>
              <CardTitle>Select Carriers for Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <CarrierSelector
                selectedCarriers={selectedCarriers}
                onCarrierChange={setSelectedCarriers}
                showAllOption={true}
              />
            </CardContent>
          </Card>
        )}

        {/* Progress Bar */}
        {isProcessing && (
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    {isAnalysisInProgress && <RotateCw className="h-4 w-4 animate-spin" />}
                    <span className="font-medium">
                      {isPaused ? 'Analysis Paused' : 'Analysis In Progress'}
                    </span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {progress.toFixed(1)}% Complete
                  </span>
                </div>
                <Progress value={progress} className="w-full" />
                <div className="flex justify-center space-x-2">
                  {isPaused ? (
                    <Button onClick={resumeAnalysis} size="sm">
                      <Play className="h-4 w-4 mr-2" />
                      Resume
                    </Button>
                  ) : (
                    <Button onClick={pauseAnalysis} variant="outline" size="sm">
                      <Pause className="h-4 w-4 mr-2" />
                      Pause
                    </Button>
                  )}
                  <Button onClick={handleViewResults} variant="outline" size="sm">
                    <StopCircle className="h-4 w-4 mr-2" />
                    View Current Results
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Control Buttons */}
        {!isProcessing && (
          <div className="flex justify-center space-x-4">
            <Button
              onClick={handleStartAnalysis}
              disabled={!canStartAnalysis}
              size="lg"
            >
              Start Analysis
            </Button>
            {summary.completed > 0 && (
              <Button onClick={handleViewResults} variant="outline" size="lg">
                View Results
              </Button>
            )}
          </div>
        )}

        {/* Results Table */}
        {results.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Analysis Results</CardTitle>
              <p className="text-sm text-muted-foreground">
                Live results as analysis progresses
              </p>
            </CardHeader>
            <CardContent>
              <VirtualizedResultsTable
                results={results}
                height={600}
              />
            </CardContent>
          </Card>
        )}

        {/* Validation Summary */}
        {summary.errors > 0 && (
          <ValidationSummary
            validationState={{
              isValidating: false,
              results: {},
              summary: {
                total: summary.totalShipments,
                valid: summary.completed,
                invalid: summary.errors,
                warnings: 0
              }
            }}
            shipments={shipments}
          />
        )}
      </div>
    </DashboardLayout>
  );
};

export default OptimizedAnalysis;