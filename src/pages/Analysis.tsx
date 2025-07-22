
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { ProgressIndicator } from '@/components/ui-lov/ProgressIndicator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { processShipmentData } from '@/utils/dataProcessing';
import { toast } from 'sonner';

const AnalysisPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('Initializing analysis...');
  const [analysisId, setAnalysisId] = useState<string | null>(null);

  const uploadId = searchParams.get('uploadId');
  const reportName = searchParams.get('reportName');

  useEffect(() => {
    if (!uploadId || !user) {
      console.error('❌ ANALYSIS: Missing uploadId or user');
      navigate('/upload');
      return;
    }

    console.log('🚀 ANALYSIS: Starting analysis for uploadId:', uploadId);
    runAnalysis();
  }, [uploadId, user, navigate]);

  const runAnalysis = async () => {
    try {
      console.log('📊 ANALYSIS: Loading CSV data...');
      setProgress(10);
      setCurrentStep('Loading CSV data...');

      // Load CSV upload data
      const { data: uploadData, error: uploadError } = await supabase
        .from('csv_uploads')
        .select('*')
        .eq('id', uploadId)
        .single();

      if (uploadError || !uploadData) {
        throw new Error('Failed to load CSV data');
      }

      console.log('📄 ANALYSIS: CSV data loaded, rows:', uploadData.row_count);
      setProgress(20);
      setCurrentStep('Loading column mappings...');

      // Load column mappings
      const { data: mappingsData, error: mappingsError } = await supabase
        .from('column_mappings')
        .select('*')
        .eq('csv_upload_id', uploadId);

      if (mappingsError) {
        throw new Error('Failed to load column mappings');
      }

      console.log('🗂️ ANALYSIS: Column mappings loaded:', mappingsData?.length);
      setProgress(40);
      setCurrentStep('Creating analysis record...');

      // Create a single analysis record
      const { data: analysisData, error: analysisError } = await supabase
        .from('shipping_analyses')
        .insert({
          user_id: user.id,
          csv_upload_id: uploadId,
          file_name: uploadData.file_name,
          report_name: reportName || uploadData.file_name,
          total_shipments: uploadData.row_count,
          status: 'processing',
          column_mappings: mappingsData?.reduce((acc, mapping) => {
            acc[mapping.field_name] = mapping.csv_header;
            return acc;
          }, {} as Record<string, string>) || {},
          original_data: uploadData.csv_content ? JSON.parse(uploadData.csv_content) : []
        })
        .select()
        .single();

      if (analysisError || !analysisData) {
        console.error('❌ ANALYSIS: Failed to create analysis record:', analysisError);
        throw new Error('Failed to create analysis record');
      }

      console.log('✅ ANALYSIS: Analysis record created with ID:', analysisData.id);
      setAnalysisId(analysisData.id);
      setProgress(60);
      setCurrentStep('Processing shipment data...');

      // Process the shipment data
      const csvData = uploadData.csv_content ? JSON.parse(uploadData.csv_content) : [];
      const columnMappings = mappingsData?.reduce((acc, mapping) => {
        acc[mapping.field_name] = mapping.csv_header;
        return acc;
      }, {} as Record<string, string>) || {};

      console.log('🔄 ANALYSIS: Processing shipments...');
      const processedData = await processShipmentData(csvData, columnMappings);
      
      setProgress(80);
      setCurrentStep('Saving results...');

      // Update the analysis record with processed data
      const { error: updateError } = await supabase
        .from('shipping_analyses')
        .update({
          processed_shipments: processedData.validShipments,
          orphaned_shipments: processedData.invalidShipments,
          total_shipments: processedData.validShipments.length + processedData.invalidShipments.length,
          processing_metadata: {
            totalProcessed: processedData.validShipments.length,
            totalOrphaned: processedData.invalidShipments.length,
            processingComplete: true
          },
          status: 'completed'
        })
        .eq('id', analysisData.id);

      if (updateError) {
        console.error('❌ ANALYSIS: Failed to update analysis:', updateError);
        throw new Error('Failed to save analysis results');
      }

      setProgress(100);
      setCurrentStep('Analysis complete!');

      console.log('✅ ANALYSIS: Processing complete, navigating to results');
      
      // Navigate to results with the analysis ID
      setTimeout(() => {
        navigate(`/results?analysisId=${analysisData.id}`);
      }, 1000);

    } catch (error: any) {
      console.error('❌ ANALYSIS: Analysis failed:', error);
      toast.error(`Analysis failed: ${error.message}`);
      navigate('/upload');
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Analyzing Your Data</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <ProgressIndicator 
                progress={progress} 
                currentStep={currentStep}
              />
              <div className="text-center text-muted-foreground">
                <p>Please wait while we process your shipment data...</p>
                {analysisId && (
                  <p className="text-xs mt-2">Analysis ID: {analysisId}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AnalysisPage;
