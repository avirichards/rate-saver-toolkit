import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui-lov/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { Badge } from '@/components/ui/badge';
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { DataTable } from "@/components/ui-lov/data-table"
import { generateExportData } from '@/utils/dataProcessing';
import { handleDataProcessingError, processAnalysisData, processNormalViewData } from '@/utils/dataProcessing';
import { columns } from "@/components/ui-lov/columns"
import { ArrowLeft, ArrowRight, FileDown, RefreshCw } from 'lucide-react';
import { useMarkup } from '@/hooks/useMarkup';
import { ExportDialog } from '@/components/ui-lov/ExportDialog';
import { DEFAULT_MARKUP_PERCENT } from '@/utils/constants';
import { useDebounce } from '@/hooks/useDebounce';
import { AnalyticsDashboard } from '@/components/ui-lov/AnalyticsDashboard';
import { ReportNameDialog } from '@/components/ui-lov/ReportNameDialog';
import { ClientSelector } from '@/components/ui-lov/ClientSelector';
import { useUser } from '@/providers/UserProvider';
import { useToast } from '@/components/ui/use-toast';

interface ProcessedAnalysisData {
  totalCurrentCost: number;
  totalPotentialSavings: number;
  recommendations: any[];
  savingsPercentage: number;
  totalShipments: number;
  analyzedShipments: number;
  orphanedShipments?: any[];
  completedShipments?: number;
  errorShipments?: number;
  averageSavingsPercent?: number;
  file_name?: string;
  report_name?: string;
  client_id?: string;
}

const Results = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { reportId } = useParams<{ reportId: string }>();
  const { toast } = useToast();
  const { user } = useUser();

  const [analysisData, setAnalysisData] = useState<ProcessedAnalysisData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentAnalysisId, setCurrentAnalysisId] = useState<string | null>(null);
  const [markupPercent, setMarkupPercent] = useState<number>(DEFAULT_MARKUP_PERCENT);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [reportName, setReportName] = useState<string>('');
  const [isReportNameDialogOpen, setIsReportNameDialogOpen] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isClientFilterVisible, setIsClientFilterVisible] = useState(false);
  const [clientFilter, setClientFilter] = useState<string | null>(null);
  const debouncedClientFilter = useDebounce(clientFilter, 500);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  const { getShipmentMarkup } = useMarkup(markupPercent);

  // Process analysis data from database with improved data handling
  const processAnalysisFromDatabase = (analysis: any): ProcessedAnalysisData => {
    console.log('📊 Processing analysis from database:', {
      id: analysis.id,
      hasProcessedShipments: !!analysis.processed_shipments,
      processedShipmentsCount: analysis.processed_shipments?.length || 0,
      hasOrphanedShipments: !!analysis.orphaned_shipments,
      orphanedShipmentsCount: analysis.orphaned_shipments?.length || 0,
      hasRecommendations: !!analysis.recommendations,
      recommendationsCount: analysis.recommendations?.length || 0,
      totalSavings: analysis.total_savings,
      status: analysis.status
    });

    // Use the centralized data processing function
    return processAnalysisData(analysis);
  };

  // Load analysis data with proper error handling and duplicate prevention
  const loadAnalysisData = async (analysisId: string) => {
    console.log('🔍 Loading analysis data for ID:', analysisId);
    setIsLoading(true);
    setError(null);

    try {
      const { data: analysis, error } = await supabase
        .from('shipping_analyses')
        .select('*')
        .eq('id', analysisId)
        .single();

      if (error) {
        console.error('❌ Error loading analysis:', error);
        throw new Error(`Failed to load analysis: ${error.message}`);
      }

      if (!analysis) {
        throw new Error('Analysis not found');
      }

      console.log('✅ Analysis loaded successfully:', {
        id: analysis.id,
        fileName: analysis.file_name,
        reportName: analysis.report_name,
        status: analysis.status,
        totalShipments: analysis.total_shipments,
        hasProcessedShipments: !!analysis.processed_shipments,
        hasOrphanedShipments: !!analysis.orphaned_shipments
      });

      // Process the loaded analysis data
      const processedData = processAnalysisFromDatabase(analysis);
      setAnalysisData(processedData);
      setCurrentAnalysisId(analysisId); // Set the current analysis ID

    } catch (error: any) {
      console.error('❌ Error in loadAnalysisData:', error);
      setError(error.message);
      handleDataProcessingError(error, 'analysis loading');
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-save analysis - only create new if no existing ID is provided
  const autoSaveAnalysis = async (data: ProcessedAnalysisData, existingAnalysisId?: string) => {
    console.log('💾 Auto-save analysis called:', {
      hasExistingId: !!existingAnalysisId,
      existingId: existingAnalysisId,
      dataStructure: {
        totalShipments: data.totalShipments,
        analyzedShipments: data.analyzedShipments,
        totalSavings: data.totalPotentialSavings
      }
    });

    // If we have an existing analysis ID, update it instead of creating new
    if (existingAnalysisId) {
      console.log('✅ Using existing analysis ID, no duplicate creation needed:', existingAnalysisId);
      setCurrentAnalysisId(existingAnalysisId);
      return existingAnalysisId;
    }

    // Only create new analysis if we don't have an existing one
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Please log in to save analysis');
      }

      const state = location.state as any;
      const baseName = state?.fileName || data.file_name || 'Analysis';

      console.log('💾 Creating new analysis record:', {
        fileName: baseName,
        totalShipments: data.totalShipments,
        analyzedShipments: data.analyzedShipments
      });

      const analysisRecord = {
        user_id: user.id,
        file_name: baseName,
        report_name: data.report_name || baseName,
        total_shipments: data.totalShipments,
        total_savings: data.totalPotentialSavings,
        status: 'completed',
        processed_shipments: data.recommendations || [],
        orphaned_shipments: data.orphanedShipments || [],
        recommendations: data.recommendations || [], // Legacy compatibility
        original_data: {} as any,
        processing_metadata: {
          completedAt: new Date().toISOString(),
          totalCurrentCost: data.totalCurrentCost,
          analyzedShipments: data.analyzedShipments,
          errorShipments: data.errorShipments || 0,
          dataSource: 'auto_save'
        } as any
      };

      const { data: savedAnalysis, error } = await supabase
        .from('shipping_analyses')
        .insert(analysisRecord)
        .select()
        .single();

      if (error) {
        console.error('❌ Error auto-saving analysis:', error);
        throw new Error('Failed to save analysis');
      }

      console.log('✅ Analysis auto-saved successfully:', savedAnalysis.id);
      setCurrentAnalysisId(savedAnalysis.id);
      return savedAnalysis.id;

    } catch (error: any) {
      console.error('❌ Error in autoSaveAnalysis:', error);
      toast.error('Failed to save analysis automatically');
      return null;
    }
  };

  // Load analysis data from report ID
  useEffect(() => {
    if (reportId) {
      console.log('🔍 Loading analysis data from report ID:', reportId);
      loadAnalysisData(reportId);
    }
  }, [reportId]);

  // Handle analysis data from navigation state with duplicate prevention
  useEffect(() => {
    const state = location.state as { 
      analysisComplete?: boolean, 
      analysisData?: any,
      analysisId?: string // Check for existing analysis ID
    } | null;
    
    console.log('🔍 Results useEffect - Navigation state:', {
      hasState: !!state,
      analysisComplete: state?.analysisComplete,
      hasAnalysisData: !!state?.analysisData,
      hasAnalysisId: !!state?.analysisId,
      existingAnalysisId: state?.analysisId
    });

    if (state?.analysisComplete && state?.analysisData) {
      console.log('📊 Processing fresh analysis data from navigation');
      const processedData = processNormalViewData(state.analysisData.recommendations || []);
      
      // Enhanced data structure for Results display
      const enhancedData = {
        ...processedData,
        file_name: state.analysisData.file_name,
        report_name: state.analysisData.report_name,
        client_id: state.analysisData.client_id,
        totalShipments: state.analysisData.totalShipments,
        completedShipments: state.analysisData.completedShipments,
        errorShipments: state.analysisData.errorShipments,
        orphanedShipments: state.analysisData.orphanedShipments || []
      };
      
      setAnalysisData(enhancedData);
      
      // Use existing analysis ID if provided, otherwise auto-save
      if (state.analysisId) {
        console.log('✅ Using existing analysis ID from navigation:', state.analysisId);
        setCurrentAnalysisId(state.analysisId);
      } else {
        console.log('⚠️ No existing analysis ID, will auto-save');
        autoSaveAnalysis(enhancedData);
      }
    }
  }, [location.state]);

  // Update report name in database
  const updateReportName = async (newName: string) => {
    if (!currentAnalysisId) {
      toast({
        title: "Error",
        description: "No analysis ID found. Cannot update report name.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('shipping_analyses')
        .update({ report_name: newName })
        .eq('id', currentAnalysisId);

      if (error) {
        console.error('Error updating report name:', error);
        toast({
          title: "Error",
          description: "Failed to update report name.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Report name updated successfully.",
        });
        setAnalysisData((prevData: any) => ({ ...prevData, report_name: newName }));
      }
    } finally {
      setIsSaving(false);
      setIsReportNameDialogOpen(false);
    }
  };

  // Update client ID in database
  const updateClientId = async (newClientId: string | null) => {
    if (!currentAnalysisId) {
      toast({
        title: "Error",
        description: "No analysis ID found. Cannot update client ID.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('shipping_analyses')
        .update({ client_id: newClientId })
        .eq('id', currentAnalysisId);

      if (error) {
        console.error('Error updating client ID:', error);
        toast({
          title: "Error",
          description: "Failed to update client ID.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Client ID updated successfully.",
        });
        setAnalysisData((prevData: any) => ({ ...prevData, client_id: newClientId }));
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Load initial report name from analysis data
  useEffect(() => {
    if (analysisData) {
      setReportName(analysisData.report_name || analysisData.file_name || 'Analysis Report');
      setClientId(analysisData.client_id || null);
    }
  }, [analysisData]);

  // Filter data by client ID
  useEffect(() => {
    if (analysisData && analysisData.recommendations) {
      let filtered = analysisData.recommendations;

      if (debouncedClientFilter) {
        filtered = filtered.filter((item: any) => item.client_id === debouncedClientFilter);
      }

      if (debouncedSearchTerm) {
        const lowerSearchTerm = debouncedSearchTerm.toLowerCase();
        filtered = filtered.filter((item: any) =>
          Object.values(item).some((value: any) =>
            typeof value === 'string' && value.toLowerCase().includes(lowerSearchTerm)
          )
        );
      }

      setFilteredData(filtered);
    }
  }, [analysisData, debouncedClientFilter, debouncedSearchTerm]);

  // Generate CSV export data
  const getExportData = () => {
    if (analysisData && analysisData.recommendations) {
      return generateExportData(filteredData, getShipmentMarkup);
    }
    return [];
  };

  // Navigate back to upload page
  const handleStartOver = () => {
    navigate('/upload');
  };

  // Navigate to reports page
  const handleViewReports = () => {
    navigate('/reports');
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-full">
          <div className="flex flex-col items-center">
            <RefreshCw className="h-10 w-10 text-muted-foreground animate-spin mb-3" />
            <p className="text-lg text-muted-foreground">Loading analysis results...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-full">
          <div className="flex flex-col items-center">
            <p className="text-red-500 text-lg mb-3">Error: {error}</p>
            <Button variant="outline" onClick={handleStartOver}>
              Try Again
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!analysisData) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-full">
          <div className="flex flex-col items-center">
            <p className="text-muted-foreground text-lg mb-3">No analysis data found.</p>
            <Button variant="outline" onClick={handleStartOver}>
              Start Over
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto py-10">
        {/* Header Section */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{reportName}</h1>
            <p className="text-muted-foreground">
              View and analyze the shipping optimization results.
            </p>
          </div>
          <div className="space-x-2">
            <Button variant="outline" onClick={handleViewReports}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Reports
            </Button>
            <Button onClick={() => setIsReportNameDialogOpen(true)} disabled={isSaving}>
              Rename Report
            </Button>
          </div>
        </div>

        {/* Report Name Dialog */}
        <ReportNameDialog
          open={isReportNameDialogOpen}
          onOpenChange={setIsReportNameDialogOpen}
          reportName={reportName}
          setReportName={setReportName}
          updateReportName={updateReportName}
          isSaving={isSaving}
        />

        {/* Analytics Dashboard */}
        <AnalyticsDashboard analysisData={analysisData} />

        {/* Filters and Actions */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* Search Input */}
            <div>
              <Label htmlFor="search">Search:</Label>
              <Input
                id="search"
                placeholder="Search shipments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-xs"
              />
            </div>

            {/* Client Filter */}
            <div>
              <Button variant="outline" onClick={() => setIsClientFilterVisible(!isClientFilterVisible)}>
                {isClientFilterVisible ? "Hide Client Filter" : "Show Client Filter"}
              </Button>
              {isClientFilterVisible && (
                <ClientSelector clientId={clientId} setClientId={setClientId} updateClientId={updateClientId} />
              )}
            </div>
          </div>

          {/* Export and Markup Controls */}
          <div className="flex items-center space-x-4">
            {/* Markup Input */}
            <div className="flex items-center space-x-2">
              <Label htmlFor="markup">Markup:</Label>
              <Input
                id="markup"
                type="number"
                placeholder="Enter markup %"
                value={markupPercent.toString()}
                onChange={(e) => {
                  const value = parseFloat(e.target.value);
                  if (!isNaN(value)) {
                    setMarkupPercent(value);
                  }
                }}
                className="w-24"
              />
              <span>%</span>
            </div>

            {/* Export Button */}
            <Button onClick={() => setIsExportDialogOpen(true)}>
              <FileDown className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Data Table */}
        {analysisData.recommendations && (
          <DataTable columns={columns(getShipmentMarkup)} data={filteredData} />
        )}

        {/* Export Dialog */}
        <ExportDialog
          open={isExportDialogOpen}
          onOpenChange={setIsExportDialogOpen}
          getExportData={getExportData}
        />
      </div>
    </DashboardLayout>
  );
};

export default Results;
