
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { Button } from '@/components/ui-lov/Button';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, AlertCircle, Loader2, FileText, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const Analysis = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('Initializing...');
  const [isComplete, setIsComplete] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const hasStarted = useRef(false);
  const csvUploadId = searchParams.get('csvUploadId');
  const reportName = searchParams.get('reportName');
  const clientId = searchParams.get('clientId');

  useEffect(() => {
    if (!csvUploadId || !user || hasStarted.current) return;
    
    hasStarted.current = true;
    startAnalysis();
  }, [csvUploadId, user]);

  const startAnalysis = async () => {
    try {
      console.log('🚀 Starting analysis for csvUploadId:', csvUploadId);
      
      // Get CSV upload data
      const { data: csvUpload, error: csvError } = await supabase
        .from('csv_uploads')
        .select('*')
        .eq('id', csvUploadId)
        .single();

      if (csvError || !csvUpload) {
        throw new Error('Failed to load CSV upload data');
      }

      setCurrentStep('Loading shipping data...');
      setProgress(10);

      // Get column mappings
      const { data: mappings, error: mappingsError } = await supabase
        .from('column_mappings')
        .select('*')
        .eq('csv_upload_id', csvUploadId);

      if (mappingsError) {
        throw new Error('Failed to load column mappings');
      }

      setCurrentStep('Processing shipments...');
      setProgress(30);

      // Parse CSV and process shipments
      const csvData = csvUpload.csv_content;
      const lines = csvData.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      const rows = lines.slice(1);

      // Create mapping object
      const fieldMap: { [key: string]: string } = {};
      mappings.forEach(mapping => {
        fieldMap[mapping.field_name] = mapping.csv_header;
      });

      setCurrentStep('Analyzing rates...');
      setProgress(60);

      // Process each shipment
      const processedShipments: any[] = [];
      const orphanedShipments: any[] = [];

      for (let i = 0; i < Math.min(rows.length, 100); i++) { // Limit for demo
        const row = rows[i];
        if (!row.trim()) continue;

        const cells = row.split(',').map(c => c.trim().replace(/"/g, ''));
        const shipment: any = {};

        // Map data using column mappings
        Object.keys(fieldMap).forEach(fieldName => {
          const headerName = fieldMap[fieldName];
          const headerIndex = headers.indexOf(headerName);
          if (headerIndex !== -1) {
            shipment[fieldName] = cells[headerIndex] || '';
          }
        });

        // Validate required fields
        if (!shipment.originZip || !shipment.destZip || !shipment.weight) {
          orphanedShipments.push({
            ...shipment,
            rowIndex: i + 2, // +2 for header and 0-based index
            reason: 'Missing required fields (origin, destination, or weight)'
          });
          continue;
        }

        // Generate mock analysis results
        const currentRate = parseFloat(shipment.cost || '0') || (Math.random() * 50 + 10);
        const potentialRate = currentRate * (0.7 + Math.random() * 0.2); // 10-30% savings
        const savings = currentRate - potentialRate;

        processedShipments.push({
          ...shipment,
          trackingId: shipment.trackingId || `TRK-${i + 1}`,
          currentRate: parseFloat(currentRate.toFixed(2)),
          newRate: parseFloat(potentialRate.toFixed(2)),
          recommendedService: 'UPS Ground',
          originalService: shipment.service || 'Unknown',
          savings: parseFloat(savings.toFixed(2)),
          savingsPercent: parseFloat(((savings / currentRate) * 100).toFixed(1))
        });
      }

      setCurrentStep('Finalizing analysis...');
      setProgress(90);

      // Calculate totals
      const totalCurrentCost = processedShipments.reduce((sum, s) => sum + s.currentRate, 0);
      const totalPotentialSavings = processedShipments.reduce((sum, s) => sum + s.savings, 0);
      const savingsPercentage = totalCurrentCost > 0 ? (totalPotentialSavings / totalCurrentCost) * 100 : 0;

      const results = {
        totalCurrentCost,
        totalPotentialSavings,
        recommendations: processedShipments,
        savingsPercentage,
        totalShipments: rows.length,
        analyzedShipments: processedShipments.length,
        orphanedShipments,
        completedShipments: processedShipments.length,
        errorShipments: orphanedShipments.length,
        file_name: csvUpload.file_name,
        report_name: reportName,
        client_id: clientId
      };

      setAnalysisResults(results);
      setCurrentStep('Analysis complete!');
      setProgress(100);
      setIsComplete(true);

      console.log('✅ Analysis completed:', results);

    } catch (error) {
      console.error('❌ Analysis failed:', error);
      setError(error instanceof Error ? error.message : 'Analysis failed');
      toast.error('Analysis failed. Please try again.');
    }
  };

  const saveToDatabase = async () => {
    if (!analysisResults || !user) return;

    setIsSaving(true);
    try {
      console.log('💾 Saving analysis to database...');

      // Save the complete analysis to shipping_analyses table
      const { data: savedAnalysis, error: saveError } = await supabase
        .from('shipping_analyses')
        .insert({
          user_id: user.id,
          file_name: analysisResults.file_name,
          report_name: analysisResults.report_name || analysisResults.file_name,
          client_id: analysisResults.client_id,
          status: 'completed',
          total_shipments: analysisResults.totalShipments,
          total_savings: analysisResults.totalPotentialSavings,
          processed_shipments: analysisResults.recommendations,
          orphaned_shipments: analysisResults.orphanedShipments,
          original_data: {
            totalCurrentCost: analysisResults.totalCurrentCost,
            totalPotentialSavings: analysisResults.totalPotentialSavings,
            savingsPercentage: analysisResults.savingsPercentage
          },
          processing_metadata: {
            analyzedShipments: analysisResults.analyzedShipments,
            completedShipments: analysisResults.completedShipments,
            errorShipments: analysisResults.errorShipments
          },
          csv_upload_id: csvUploadId
        })
        .select()
        .single();

      if (saveError) {
        throw saveError;
      }

      console.log('✅ Analysis saved successfully:', savedAnalysis.id);
      toast.success('Analysis saved successfully!');

      // Navigate to results with analysisId only
      navigate(`/results?analysisId=${savedAnalysis.id}`);

    } catch (error) {
      console.error('❌ Failed to save analysis:', error);
      toast.error('Failed to save analysis. Please try again.');
      setError('Failed to save analysis to database');
    } finally {
      setIsSaving(false);
    }
  };

  if (error) {
    return (
      <DashboardLayout>
        <div className="p-6 max-w-4xl mx-auto">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">Analysis Failed</h2>
                <p className="text-muted-foreground mb-4">{error}</p>
                <Button onClick={() => navigate('/upload')} variant="primary">
                  Start New Analysis
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-1">Analyzing Your Shipments</h1>
          <p className="text-muted-foreground">
            Processing your shipping data to find cost savings opportunities
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {isComplete ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <Loader2 className="h-5 w-5 animate-spin" />
              )}
              {isComplete ? 'Analysis Complete' : 'Analysis in Progress'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>{currentStep}</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>

            {isComplete && analysisResults && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="font-medium text-green-800">Analysis Complete!</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {analysisResults.analyzedShipments}
                    </div>
                    <div className="text-sm text-muted-foreground">Shipments Analyzed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      ${analysisResults.totalPotentialSavings?.toFixed(2) || '0.00'}
                    </div>
                    <div className="text-sm text-muted-foreground">Potential Savings</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {analysisResults.savingsPercentage?.toFixed(1) || '0.0'}%
                    </div>
                    <div className="text-sm text-muted-foreground">Average Savings</div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button 
                    onClick={saveToDatabase}
                    disabled={isSaving}
                    variant="primary"
                    className="flex-1"
                    iconLeft={isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
                  >
                    {isSaving ? 'Saving Analysis...' : 'View Detailed Results'}
                  </Button>
                  <Button 
                    onClick={() => navigate('/reports')}
                    variant="outline"
                    iconLeft={<FileText className="h-4 w-4" />}
                  >
                    Back to Reports
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Analysis;
