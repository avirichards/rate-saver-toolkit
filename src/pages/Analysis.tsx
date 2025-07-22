
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { Button } from '@/components/ui-lov/Button';
import { CarrierSelector } from '@/components/ui-lov/CarrierSelector';
import { ValidationSummary } from '@/components/ui-lov/ValidationSummary';
import { toast } from 'sonner';
import { ArrowLeft, Play } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const Analysis = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [selectedCarriers, setSelectedCarriers] = useState<string[]>([]);
  const [isStartingAnalysis, setIsStartingAnalysis] = useState(false);

  // Get data from navigation state
  const { 
    csvUploadId,
    mappings,
    serviceMappings,
    fileName,
    csvData
  } = location.state || {};

  // Redirect if no data
  useEffect(() => {
    if (!csvUploadId || !csvData || !fileName) {
      toast.error('No shipment data found. Please upload a file first.');
      navigate('/upload');
    }
  }, [csvUploadId, csvData, fileName, navigate]);

  const handleStartAnalysis = async () => {
    if (selectedCarriers.length === 0) {
      toast.error('Please select at least one carrier for analysis');
      return;
    }

    try {
      setIsStartingAnalysis(true);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const analysisParams = {
        csvUploadId,
        userId: user.id,
        mappings: mappings || {},
        serviceMappings: serviceMappings || [],
        carrierConfigs: selectedCarriers
      };

      console.log('Starting background analysis with params:', {
        csvUploadId,
        userId: user.id,
        carrierConfigs: selectedCarriers.length,
        serviceMappings: serviceMappings?.length || 0
      });

      const { data, error } = await supabase.functions.invoke('start-background-analysis', {
        body: analysisParams
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data?.success || !data?.analysisId) {
        throw new Error('Failed to start background analysis');
      }

      toast.success('Analysis started! Redirecting to results page...');
      navigate(`/results?analysisId=${data.analysisId}`);
      
    } catch (error) {
      console.error('Error starting background analysis:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to start analysis');
    } finally {
      setIsStartingAnalysis(false);
    }
  };

  const canStartAnalysis = selectedCarriers.length > 0 && !isStartingAnalysis;

  if (!csvUploadId || !csvData || !fileName) {
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
          fileName={fileName}
          csvData={csvData}
        />

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
                <li>• {csvData?.length || 0} shipments ready for processing</li>
                <li>• {selectedCarriers.length} carrier account{selectedCarriers.length !== 1 ? 's' : ''} selected</li>
                <li>• Analysis will run in the background - you can safely navigate away</li>
                <li>• You'll be redirected to the results page to monitor progress</li>
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
      </div>
    </DashboardLayout>
  );
};

export default Analysis;
