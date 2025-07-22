
import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { Button } from '@/components/ui-lov/Button';
import { SummaryStats } from '@/components/ui-lov/SummaryStats';
import { DataTable } from '@/components/ui-lov/DataTable';
import { MarkupConfiguration } from '@/components/ui-lov/MarkupConfiguration';
import { InlineEditableField } from '@/components/ui-lov/InlineEditableField';
import { ClientCombobox } from '@/components/ui-lov/ClientCombobox';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAutoSave } from '@/hooks/useAutoSave';
import { toast } from 'sonner';
import { ArrowLeft, FileBarChart, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

const ResultsPage = () => {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [processedShipments, setProcessedShipments] = useState<any[]>([]);
  const [orphanedShipments, setOrphanedShipments] = useState<any[]>([]);
  const [markupData, setMarkupData] = useState<any>(null);

  const analysisId = searchParams.get('analysisId');

  console.log('🎯 RESULTS: Page loaded with analysisId:', analysisId);

  // Auto-save configuration
  const autoSaveData = useMemo(() => ({
    report_name: analysisData?.report_name,
    client_id: analysisData?.client_id,
    markup_data: markupData,
    processed_shipments: processedShipments,
    orphaned_shipments: orphanedShipments,
  }), [analysisData?.report_name, analysisData?.client_id, markupData, processedShipments, orphanedShipments]);

  const { triggerSave } = useAutoSave(
    analysisId,
    autoSaveData,
    !!analysisId && !!analysisData,
    {
      debounceMs: 2000,
      showSuccessToast: false,
      onError: (error) => {
        console.error('❌ RESULTS: Auto-save failed:', error);
      }
    }
  );

  useEffect(() => {
    if (!analysisId || !user) {
      console.error('❌ RESULTS: Missing analysisId or user');
      return;
    }

    loadAnalysisData();
  }, [analysisId, user]);

  const loadAnalysisData = async () => {
    try {
      setLoading(true);
      console.log('📊 RESULTS: Loading analysis data for ID:', analysisId);

      const { data, error } = await supabase
        .from('shipping_analyses')
        .select('*')
        .eq('id', analysisId)
        .eq('user_id', user?.id)
        .single();

      if (error) {
        console.error('❌ RESULTS: Database error:', error);
        throw error;
      }

      if (!data) {
        console.error('❌ RESULTS: No analysis found for ID:', analysisId);
        toast.error('Analysis not found');
        return;
      }

      console.log('✅ RESULTS: Analysis data loaded:', {
        id: data.id,
        reportName: data.report_name,
        status: data.status,
        processedCount: data.processed_shipments?.length || 0,
        orphanedCount: data.orphaned_shipments?.length || 0
      });

      setAnalysisData(data);
      setProcessedShipments(data.processed_shipments || []);
      setOrphanedShipments(data.orphaned_shipments || []);
      setMarkupData(data.markup_data || null);

    } catch (error: any) {
      console.error('❌ RESULTS: Failed to load analysis:', error);
      toast.error('Failed to load analysis data');
    } finally {
      setLoading(false);
    }
  };

  const updateAnalysisField = async (field: string, value: any) => {
    if (!analysisId) return;

    try {
      console.log(`🔄 RESULTS: Updating ${field} for analysis ${analysisId}:`, value);
      
      const { error } = await supabase
        .from('shipping_analyses')
        .update({ 
          [field]: value,
          updated_at: new Date().toISOString()
        })
        .eq('id', analysisId);

      if (error) throw error;

      // Update local state
      setAnalysisData((prev: any) => ({
        ...prev,
        [field]: value
      }));

      console.log(`✅ RESULTS: Successfully updated ${field}`);
    } catch (error: any) {
      console.error(`❌ RESULTS: Failed to update ${field}:`, error);
      throw error;
    }
  };

  // Trigger auto-save when relevant data changes
  useEffect(() => {
    if (analysisData && (processedShipments.length > 0 || orphanedShipments.length > 0)) {
      triggerSave();
    }
  }, [autoSaveData, triggerSave, analysisData]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="flex items-center justify-center py-12">
            <div className="text-muted-foreground">Loading analysis results...</div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!analysisData) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileBarChart className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Analysis Not Found</h3>
            <p className="text-muted-foreground mb-4">The requested analysis could not be found.</p>
            <Link to="/reports">
              <Button variant="primary">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Reports
              </Button>
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/reports">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">
                <InlineEditableField
                  value={analysisData.report_name || analysisData.file_name}
                  onSave={async (value) => {
                    await updateAnalysisField('report_name', value);
                    toast.success('Report name updated');
                  }}
                  placeholder="Enter report name"
                  required
                />
              </h1>
              <p className="text-muted-foreground">Analysis ID: {analysisData.id}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div className="min-w-[200px]">
                <ClientCombobox
                  value={analysisData.client_id || ''}
                  onValueChange={async (clientId) => {
                    await updateAnalysisField('client_id', clientId || null);
                    toast.success('Client updated');
                  }}
                  placeholder="Select client"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <SummaryStats
          processedShipments={processedShipments}
          orphanedShipments={orphanedShipments}
          markupData={markupData}
        />

        {/* Markup Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Markup Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <MarkupConfiguration
              shipments={processedShipments}
              markupData={markupData}
              onMarkupChange={(newMarkupData) => {
                setMarkupData(newMarkupData);
                updateAnalysisField('markup_data', newMarkupData);
              }}
            />
          </CardContent>
        </Card>

        {/* Data Table */}
        <DataTable
          processedShipments={processedShipments}
          orphanedShipments={orphanedShipments}
          onShipmentsUpdate={(processed, orphaned) => {
            setProcessedShipments(processed);
            setOrphanedShipments(orphaned);
          }}
          markupData={markupData}
        />
      </div>
    </DashboardLayout>
  );
};

export default ResultsPage;
