
import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { Button } from '@/components/ui-lov/Button';
import { DataTable } from '@/components/ui-lov/DataTable';
import { SummaryStats } from '@/components/ui-lov/SummaryStats';
import { MarkupConfiguration } from '@/components/ui-lov/MarkupConfiguration';
import { ValidationSummary } from '@/components/ui-lov/ValidationSummary';
import { OrphanedShipmentRow } from '@/components/ui-lov/OrphanedShipmentRow';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, FileBarChart, Share2, Download, RefreshCw, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { processAnalysisData, formatShipmentData, handleDataProcessingError } from '@/utils/dataProcessing';
import { useAutoSave } from '@/hooks/useAutoSave';

const Results = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markupData, setMarkupData] = useState<any>(null);
  
  const analysisId = searchParams.get('analysisId');

  useEffect(() => {
    if (analysisId && user) {
      loadAnalysisFromDatabase();
    } else if (!analysisId) {
      setError('No analysis ID provided');
      setLoading(false);
    }
  }, [analysisId, user]);

  const loadAnalysisFromDatabase = async () => {
    try {
      setLoading(true);
      console.log('📊 Loading analysis from database:', analysisId);

      const { data: analysisData, error: analysisError } = await supabase
        .from('shipping_analyses')
        .select('*')
        .eq('id', analysisId)
        .single();

      if (analysisError) {
        throw new Error(`Failed to load analysis: ${analysisError.message}`);
      }

      if (!analysisData) {
        throw new Error('Analysis not found');
      }

      // Validate that the analysis has actual data
      const hasProcessedShipments = analysisData.processed_shipments && Array.isArray(analysisData.processed_shipments) && analysisData.processed_shipments.length > 0;
      const hasOriginalData = analysisData.original_data && Object.keys(analysisData.original_data).length > 0;

      if (!hasProcessedShipments && !hasOriginalData) {
        setError('This analysis appears to be incomplete. No shipment data was found. Please try running the analysis again.');
        setLoading(false);
        return;
      }

      console.log('✅ Analysis loaded successfully:', {
        id: analysisData.id,
        status: analysisData.status,
        processedShipments: analysisData.processed_shipments?.length || 0,
        orphanedShipments: analysisData.orphaned_shipments?.length || 0,
        hasOriginalData
      });

      setAnalysis(analysisData);
      setMarkupData(analysisData.markup_data);

    } catch (error) {
      console.error('❌ Failed to load analysis:', error);
      handleDataProcessingError(error, 'loading analysis');
      setError(error instanceof Error ? error.message : 'Failed to load analysis');
    } finally {
      setLoading(false);
    }
  };

  // Auto-save markup data changes
  const { triggerSave } = useAutoSave(
    analysisId,
    { markup_data: markupData },
    !!markupData && !!analysisId,
    { 
      showSuccessToast: true,
      onError: (error) => toast.error('Failed to save markup configuration')
    }
  );

  useEffect(() => {
    if (markupData && analysisId) {
      triggerSave();
    }
  }, [markupData, triggerSave, analysisId]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading analysis results...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="p-6 max-w-4xl mx-auto">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">Analysis Unavailable</h2>
                <p className="text-muted-foreground mb-4">{error}</p>
                <div className="flex gap-3 justify-center">
                  <Button onClick={() => navigate('/upload')} variant="primary">
                    Start New Analysis
                  </Button>
                  <Button onClick={() => navigate('/reports')} variant="outline">
                    Back to Reports
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  if (!analysis) {
    return (
      <DashboardLayout>
        <div className="p-6 max-w-4xl mx-auto">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">No Analysis Found</h2>
                <p className="text-muted-foreground mb-4">
                  The requested analysis could not be found or you don't have permission to view it.
                </p>
                <div className="flex gap-3 justify-center">
                  <Button onClick={() => navigate('/upload')} variant="primary">
                    Start New Analysis
                  </Button>
                  <Button onClick={() => navigate('/reports')} variant="outline">
                    Back to Reports
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  // Process the analysis data
  const getShipmentMarkup = (shipment: any) => {
    if (!markupData) {
      return { markedUpPrice: shipment.newRate, markup: 0, marginAmount: 0 };
    }

    const markup = markupData.markupPercentage || 0;
    const marginAmount = shipment.newRate * (markup / 100);
    const markedUpPrice = shipment.newRate + marginAmount;

    return { markedUpPrice, markup, marginAmount };
  };

  const processedData = processAnalysisData(analysis, getShipmentMarkup);
  const formattedShipments = formatShipmentData(processedData.recommendations);

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-1">
                {processedData.report_name || processedData.file_name || 'Analysis Results'}
              </h1>
              <p className="text-muted-foreground">
                Shipping rate analysis and optimization recommendations
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadAnalysisFromDatabase}
                iconLeft={<RefreshCw className="h-4 w-4" />}
              >
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                iconLeft={<Share2 className="h-4 w-4" />}
              >
                Share
              </Button>
              <Button
                variant="outline"
                size="sm"
                iconLeft={<Download className="h-4 w-4" />}
              >
                Export
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <SummaryStats 
            data={processedData}
            getShipmentMarkup={getShipmentMarkup}
          />

          <MarkupConfiguration
            markupData={markupData}
            onMarkupChange={setMarkupData}
            recommendations={processedData.recommendations}
          />

          <ValidationSummary 
            totalShipments={processedData.totalShipments}
            processedShipments={processedData.analyzedShipments}
            orphanedShipments={processedData.orphanedShipments?.length || 0}
          />

          <Tabs defaultValue="recommendations" className="w-full">
            <TabsList>
              <TabsTrigger value="recommendations">
                Recommendations ({formattedShipments.length})
              </TabsTrigger>
              {processedData.orphanedShipments && processedData.orphanedShipments.length > 0 && (
                <TabsTrigger value="orphaned">
                  Issues ({processedData.orphanedShipments.length})
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="recommendations">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileBarChart className="h-5 w-5" />
                    Rate Optimization Recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <DataTable 
                    data={formattedShipments}
                    getShipmentMarkup={getShipmentMarkup}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {processedData.orphanedShipments && processedData.orphanedShipments.length > 0 && (
              <TabsContent value="orphaned">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-yellow-500" />
                      Shipments Requiring Attention
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Alert className="mb-4">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        These shipments could not be analyzed due to missing or invalid data. 
                        Review and correct the information below to include them in your analysis.
                      </AlertDescription>
                    </Alert>
                    <div className="space-y-2">
                      {processedData.orphanedShipments.map((shipment: any, index: number) => (
                        <OrphanedShipmentRow 
                          key={index}
                          shipment={shipment}
                          onUpdate={() => {}}
                        />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Results;
