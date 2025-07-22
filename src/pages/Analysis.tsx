
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { Button } from '@/components/ui-lov/Button';
import { CarrierSelector } from '@/components/ui-lov/CarrierSelector';
import { ValidationSummary } from '@/components/ui-lov/ValidationSummary';
import { BackgroundAnalysisProgress } from '@/components/ui-lov/BackgroundAnalysisProgress';
import { useShipmentValidation } from '@/hooks/useShipmentValidation';
import { toast } from 'sonner';
import { ArrowLeft, Play } from 'lucide-react';
import { startBackgroundAnalysis } from '@/utils/backgroundAnalysis';

const Analysis = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [selectedCarriers, setSelectedCarriers] = useState<string[]>([]);
  const [isStartingAnalysis, setIsStartingAnalysis] = useState(false);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const { validationState, validateShipments } = useShipmentValidation();

  // Get data from navigation state
  const { 
    shipmentData, 
    fileName, 
    serviceMappings,
    reportName 
  } = location.state || {};

  // Redirect if no data and validate shipments
  useEffect(() => {
    if (!shipmentData || !fileName) {
      toast.error('No shipment data found. Please upload a file first.');
      navigate('/upload');
    } else {
      // Validate shipments when component mounts
      validateShipments(shipmentData);
    }
  }, [shipmentData, fileName, navigate, validateShipments]);

  const handleStartAnalysis = async () => {
    if (selectedCarriers.length === 0) {
      toast.error('Please select at least one carrier for analysis');
      return;
    }

    try {
      setIsStartingAnalysis(true);
      
      const analysisParams = {
        fileName,
        originalData: shipmentData,
        carrierConfigIds: selectedCarriers,
        serviceMappings: serviceMappings || [],
        reportName
      };

      console.log('Starting background analysis with params:', {
        fileName,
        shipmentCount: shipmentData.length,
        carrierConfigs: selectedCarriers.length,
        reportName
      });

      const newAnalysisId = await startBackgroundAnalysis(analysisParams);
      setAnalysisId(newAnalysisId);
      
      toast.success('Analysis started! You can safely navigate away - the analysis will continue in the background.');
    } catch (error) {
      console.error('Error starting background analysis:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to start analysis');
    } finally {
      setIsStartingAnalysis(false);
    }
  };

  const handleAnalysisComplete = (completedAnalysisId: string) => {
    console.log('Analysis completed:', completedAnalysisId);
    toast.success('Analysis completed successfully!');
    navigate('/results', { 
      state: { 
        analysisId: completedAnalysisId,
        fromBackground: true 
      } 
    });
  };

  const handleAnalysisError = (error: string) => {
    console.error('Analysis error:', error);
    toast.error(`Analysis failed: ${error}`);
    setAnalysisId(null);
  };

  const canStartAnalysis = selectedCarriers.length > 0 && !isStartingAnalysis && !analysisId;

  if (!shipmentData || !fileName) {
    return null; // Will redirect via useEffect
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              iconLeft={<ArrowLeft className="h-4 w-4" />}
              onClick={() => navigate('/upload')}
            >
              Back to Upload
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Analysis Setup</h1>
              <p className="text-muted-foreground">
                Configure your analysis settings and start processing
              </p>
            </div>
          </div>
        </div>

        {/* Validation Summary */}
        <ValidationSummary 
          validationState={validationState}
          shipments={shipmentData}
        />

        {/* Analysis Status */}
        {analysisId ? (
          <BackgroundAnalysisProgress
            analysisId={analysisId}
            onComplete={handleAnalysisComplete}
            onError={handleAnalysisError}
          />
        ) : (
          <>
            {/* Carrier Selection */}
            <CarrierSelector
              selectedCarriers={selectedCarriers}
              onCarrierChange={setSelectedCarriers}
            />

            {/* Start Analysis */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Play className="h-5 w-5" />
                  Start Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="font-medium text-blue-900 mb-2">Ready to Analyze</h3>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• {shipmentData.length} shipments ready for processing</li>
                    <li>• {selectedCarriers.length} carrier account{selectedCarriers.length !== 1 ? 's' : ''} selected</li>
                    <li>• Analysis will run in the background - you can safely navigate away</li>
                    <li>• You'll be notified when analysis is complete</li>
                  </ul>
                </div>

                <div className="flex justify-end">
                  <Button
                    variant="primary"
                    iconLeft={<Play className="h-4 w-4" />}
                    onClick={handleStartAnalysis}
                    disabled={!canStartAnalysis}
                    loading={isStartingAnalysis}
                  >
                    {isStartingAnalysis ? 'Starting Analysis...' : 'Start Background Analysis'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Analysis;
