import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAutoSave } from '@/hooks/useAutoSave';
import { processAnalysisData, handleDataProcessingError, convertFromDatabaseFormat, convertToUnifiedFormat } from '@/utils/dataProcessing';
import { UnifiedAnalysisData } from '@/types/analysisTypes';
import { PostUploadNamingDialog } from '@/components/ui-lov/PostUploadNamingDialog';
import { SummaryStats } from '@/components/ui-lov/SummaryStats';
import { DataTable } from '@/components/ui-lov/DataTable';
import { MarkupConfiguration } from '@/components/ui-lov/MarkupConfiguration';
import { ValidationSummary } from '@/components/ui-lov/ValidationSummary';
import { toast } from 'sonner';

const ResultsPage = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Unified state management
  const [unifiedData, setUnifiedData] = useState<UnifiedAnalysisData | null>(null);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markupData, setMarkupData] = useState<any>(null);
  const [showNamingDialog, setShowNamingDialog] = useState(false);

  // Auto-save with unified data
  const { triggerSave } = useAutoSave(
    analysisId, 
    unifiedData, 
    true, 
    {
      showSuccessToast: true,
      onError: (error) => {
        console.error('Auto-save failed:', error);
        toast.error('Failed to auto-save changes');
      }
    }
  );

  // Initialize data from navigation state or database
  useEffect(() => {
    const initializeData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Check for fresh analysis data from navigation state
        const navigationState = location.state?.analysisData;
        const paramAnalysisId = searchParams.get('analysisId');

        console.log('🔍 Initializing Results page:', {
          hasNavigationState: !!navigationState,
          paramAnalysisId,
          userId: user?.id
        });

        if (navigationState) {
          // Fresh analysis - convert to unified format
          console.log('📊 Processing fresh analysis data');
          const unified = convertToUnifiedFormat(navigationState);
          setUnifiedData(unified);
          
          // Create new analysis record if from fresh analysis
          if (!paramAnalysisId) {
            console.log('💾 Creating new analysis record');
            const { data: newAnalysis, error: createError } = await supabase
              .from('shipping_analyses')
              .insert({
                user_id: user!.id,
                file_name: unified.file_name || 'Analysis',
                total_shipments: unified.totalShipments,
                status: 'processing'
              })
              .select('id')
              .single();

            if (createError) throw createError;
            
            setAnalysisId(newAnalysis.id);
            setShowNamingDialog(true);
          } else {
            setAnalysisId(paramAnalysisId);
          }
        } else if (paramAnalysisId) {
          // Loading existing analysis from database
          console.log('📖 Loading existing analysis from database:', paramAnalysisId);
          
          const { data: analysis, error: fetchError } = await supabase
            .from('shipping_analyses')
            .select('*')
            .eq('id', paramAnalysisId)
            .eq('user_id', user!.id)
            .single();

          if (fetchError) throw fetchError;
          if (!analysis) throw new Error('Analysis not found');

          console.log('📋 Loaded analysis data:', analysis);

          // Check if analysis has proper data
          const hasData = analysis.processed_shipments?.length > 0 || 
                         analysis.recommendations?.length > 0 || 
                         analysis.original_data?.recommendations?.length > 0;

          if (!hasData) {
            setError('No analysis results found. The analysis may be incomplete or corrupted.');
            return;
          }

          // Convert database format to unified format
          const unified = convertFromDatabaseFormat(analysis);
          setUnifiedData(unified);
          setAnalysisId(paramAnalysisId);
          setMarkupData(analysis.markup_data);
        } else {
          throw new Error('No analysis data provided');
        }
      } catch (error: any) {
        console.error('❌ Error initializing Results page:', error);
        setError(error.message || 'Failed to load analysis results');
        handleDataProcessingError(error, 'results initialization');
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      initializeData();
    }
  }, [user, searchParams, location.state]);

  // Trigger auto-save when unified data changes
  useEffect(() => {
    if (unifiedData && analysisId) {
      console.log('🔄 Triggering auto-save due to data change');
      triggerSave();
    }
  }, [unifiedData, analysisId, triggerSave]);

  // Handle markup updates
  const handleMarkupChange = (newMarkupData: any) => {
    console.log('💰 Markup configuration updated:', newMarkupData);
    setMarkupData(newMarkupData);
    
    // Trigger auto-save with markup data
    if (analysisId) {
      supabase
        .from('shipping_analyses')
        .update({ 
          markup_data: newMarkupData,
          updated_at: new Date().toISOString()
        })
        .eq('id', analysisId)
        .then(({ error }) => {
          if (error) {
            console.error('Failed to save markup data:', error);
            toast.error('Failed to save markup configuration');
          } else {
            console.log('✅ Markup data saved successfully');
          }
        });
    }
  };

  // Loading state
  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading analysis results...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Error state
  if (error) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center max-w-md">
            <h3 className="text-lg font-medium mb-2">Analysis Not Found</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <button 
              onClick={() => navigate('/reports')}
              className="bg-primary text-primary-foreground px-4 py-2 rounded hover:bg-primary/90"
            >
              Back to Reports
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Main render with unified data
  if (!unifiedData) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <p className="text-muted-foreground">No analysis data available</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Analysis Results</h1>
            <p className="text-muted-foreground">
              {unifiedData.file_name} • {unifiedData.totalShipments} shipments analyzed
            </p>
          </div>
        </div>

        <SummaryStats 
          data={unifiedData}
          markupData={markupData}
        />

        <ValidationSummary
          totalShipments={unifiedData.totalShipments}
          completedShipments={unifiedData.completedShipments}
          errorShipments={unifiedData.errorShipments}
          orphanedShipments={unifiedData.orphanedShipments}
        />

        <MarkupConfiguration
          analysisId={analysisId}
          recommendations={unifiedData.recommendations}
          markupData={markupData}
          onMarkupChange={handleMarkupChange}
        />

        <DataTable
          data={unifiedData.recommendations}
          orphanedData={unifiedData.orphanedShipments}
          analysisId={analysisId}
          markupData={markupData}
        />

        <PostUploadNamingDialog
          open={showNamingDialog}
          onOpenChange={setShowNamingDialog}
          analysisId={analysisId || ''}
          defaultReportName={unifiedData.file_name || 'Analysis Report'}
        />
      </div>
    </DashboardLayout>
  );
};

export default ResultsPage;
