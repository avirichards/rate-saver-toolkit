import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ProgressIndicator } from '@/components/ui-lov/ProgressIndicator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const AnalysisPage = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Preparing analysis...');
  const [analysisResults, setAnalysisResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      console.warn('User not authenticated, redirecting to /auth/sign-in');
      return;
    }

    runAnalysis();
  }, [user, runAnalysis]);

  const runAnalysis = useCallback(async () => {
    try {
      setCurrentStep(1);
      setProgress(10);
      setStatusMessage('Loading shipment data...');

      const csvUploadId = searchParams.get('csvUploadId');
      if (!csvUploadId) {
        throw new Error('No CSV upload ID provided');
      }

      const { data: uploadData, error: uploadError } = await supabase
        .from('csv_uploads')
        .select('*')
        .eq('id', csvUploadId)
        .single();

      if (uploadError) {
        throw uploadError;
      }

      if (!uploadData) {
        throw new Error('CSV upload data not found');
      }

      setCurrentStep(2);
      setProgress(20);
      setStatusMessage('Parsing CSV data...');

      const csvData = uploadData.csv_data;
      if (!csvData || !Array.isArray(csvData)) {
        throw new Error('No CSV data found in upload');
      }

      setCurrentStep(3);
      setProgress(40);
      setStatusMessage('Validating shipment data...');

      const validatedData = csvData.filter((item: any) => {
        const originZip = item.originZip || item.origin_zip;
        const destZip = item.destZip || item.dest_zip || item.destinationZip || item.destination_zip;
        const weight = item.weight;

        return originZip && destZip && weight;
      });

      const orphanedShipments = csvData.filter((item: any) => {
        const originZip = item.originZip || item.origin_zip;
        const destZip = item.destZip || item.dest_zip || item.destinationZip || item.destination_zip;
        const weight = item.weight;

        return !originZip || !destZip || !weight;
      });

      setCurrentStep(4);
      setProgress(60);
      setStatusMessage('Analyzing shipments...');

      const recommendations = validatedData.map((item: any) => {
        const originZip = item.originZip || item.origin_zip;
        const destZip = item.destZip || item.dest_zip || item.destinationZip || item.destination_zip;
        const weight = item.weight;
        const carrier = item.carrier;
        const service = item.service;

        const currentCost = parseFloat(item.currentCost || item.current_cost || '0');
        const savings = parseFloat(item.savings || '0');

        return {
          originZip,
          destZip,
          weight,
          carrier,
          service,
          currentCost,
          savings
        };
      });

      const processedRecommendations = recommendations.map((rec: any) => ({
        ...rec,
        recommendedService: 'UPS Ground',
        recommendedCost: rec.currentCost - rec.savings
      }));

      setCurrentStep(5);
      setProgress(80);
      setStatusMessage('Calculating savings...');

      const totalCurrentCost = processedRecommendations.reduce((sum: number, item: any) => sum + item.currentCost, 0);
      const totalSavings = processedRecommendations.reduce((sum: number, item: any) => sum + item.savings, 0);

      setCurrentStep(7);
      setProgress(100);
      setStatusMessage('Analysis complete! Redirecting...');

      console.log('✅ Analysis completed, navigating to results with data');
      
      // Navigate directly to Results with analysis data - NO database creation
      setTimeout(() => {
        navigate('/results', {
          state: {
            analysisData: {
              recommendations: processedRecommendations,
              orphanedShipments: orphanedShipments,
              totalShipments: validatedData.length,
              file_name: uploadData.file_name,
              // Include other metadata
              savingsPercentage: totalCurrentCost > 0 ? (totalSavings / totalCurrentCost) * 100 : 0,
              totalCurrentCost,
              totalPotentialSavings: totalSavings
            }
          }
        });
      }, 1000);

    } catch (error: any) {
      console.error('❌ Analysis failed:', error);
      setError(error.message || 'Analysis failed');
      toast.error(error.message || 'Analysis failed');
    }
  }, [searchParams, navigate, user]);

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">Analyzing Your Shipments</h1>
            <p className="text-muted-foreground">
              We're processing your shipping data to find the best rates and savings opportunities.
            </p>
          </div>

          {error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
              <h3 className="text-lg font-medium text-red-800 mb-2">Analysis Failed</h3>
              <p className="text-red-600 mb-4">{error}</p>
              <button
                onClick={() => navigate('/upload')}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
              >
                Try Again
              </button>
            </div>
          ) : (
            <ProgressIndicator
              currentStep={currentStep}
              totalSteps={7}
              progress={progress}
              statusMessage={statusMessage}
            />
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AnalysisPage;
