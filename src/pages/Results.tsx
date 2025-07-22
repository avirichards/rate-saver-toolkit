import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui-lov/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { 
  ArrowLeft, 
  FileBarChart, 
  Download, 
  DollarSign, 
  TrendingDown, 
  Package, 
  Users,
  AlertCircle,
  CheckCircle,
  Eye,
  Save
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { DataTable } from '@/components/ui-lov/DataTable';
import { SummaryStats } from '@/components/ui-lov/SummaryStats';
import { MarkupConfiguration } from '@/components/ui-lov/MarkupConfiguration';

interface ProcessedShipment {
  id: number;
  trackingId?: string;
  service?: string;
  carrier?: string;
  weight?: string;
  weightUnit?: string;
  cost?: string;
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
}

interface AnalysisData {
  totalShipments: number;
  completedShipments: number;
  errorShipments: number;
  totalCurrentCost: number;
  totalPotentialSavings: number;
  averageSavingsPercent: number;
  recommendations: any[];
  orphanedShipments: any[];
}

const Results = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportName, setReportName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [currentAnalysisId, setCurrentAnalysisId] = useState<string | null>(null);

  useEffect(() => {
    loadAnalysisData();
  }, [location]);

  const loadAnalysisData = async () => {
    try {
      setLoading(true);
      
      // Get analysis ID from location state
      const state = location.state as { 
        analysisComplete?: boolean;
        analysisId?: string;
        analysisData?: AnalysisData;
      } | null;

      if (!state) {
        console.error('❌ No state found in location');
        toast.error('No analysis data found');
        navigate('/upload');
        return;
      }

      // If we have analysisId, load from database (single source of truth)
      if (state.analysisId) {
        console.log('📊 Loading analysis from database using single ID:', state.analysisId);
        setCurrentAnalysisId(state.analysisId);
        
        const { data: analysis, error } = await supabase
          .from('shipping_analyses')
          .select('*')
          .eq('id', state.analysisId)
          .single();

        if (error) {
          console.error('❌ Error loading analysis:', error);
          toast.error('Failed to load analysis data');
          navigate('/upload');
          return;
        }

        if (!analysis) {
          console.error('❌ No analysis found with ID:', state.analysisId);
          toast.error('Analysis not found');
          navigate('/upload');
          return;
        }

        console.log('✅ Successfully loaded analysis from single record:', analysis.id);

        // Extract data from the single analysis record
        const processedShipments = analysis.processed_shipments || [];
        const orphanedShipments = analysis.orphaned_shipments || [];
        
        const analysisData: AnalysisData = {
          totalShipments: analysis.total_shipments || 0,
          completedShipments: processedShipments.length,
          errorShipments: orphanedShipments.length,
          totalCurrentCost: processedShipments.reduce((sum: number, item: any) => sum + (item.currentCost || 0), 0),
          totalPotentialSavings: analysis.total_savings || 0,
          averageSavingsPercent: 0, // Will be calculated below
          recommendations: processedShipments,
          orphanedShipments: orphanedShipments
        };

        // Calculate average savings percentage
        if (analysisData.totalCurrentCost > 0) {
          analysisData.averageSavingsPercent = (analysisData.totalPotentialSavings / analysisData.totalCurrentCost) * 100;
        }

        setAnalysisData(analysisData);
        setReportName(analysis.report_name || analysis.file_name || 'Untitled Report');
        
        console.log('🔍 Loaded unified analysis data:', {
          analysisId: analysis.id,
          totalShipments: analysisData.totalShipments,
          completedShipments: analysisData.completedShipments,
          errorShipments: analysisData.errorShipments,
          totalSavings: analysisData.totalPotentialSavings
        });
      } 
      // Fallback to state data (for backward compatibility)
      else if (state.analysisData) {
        console.log('📊 Using analysis data from state (fallback)');
        setAnalysisData(state.analysisData);
      } else {
        console.error('❌ No analysis ID or data found in state');
        toast.error('No analysis data available');
        navigate('/upload');
        return;
      }
      
    } catch (error: any) {
      console.error('❌ Error loading analysis data:', error);
      toast.error('Failed to load analysis data');
      navigate('/upload');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveReport = async () => {
    if (!currentAnalysisId || !reportName.trim()) {
      toast.error('Please enter a report name');
      return;
    }

    setIsSaving(true);
    try {
      console.log('💾 Saving report name to single analysis record:', currentAnalysisId);
      
      const { error } = await supabase
        .from('shipping_analyses')
        .update({ 
          report_name: reportName.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', currentAnalysisId);

      if (error) {
        console.error('❌ Error saving report:', error);
        toast.error('Failed to save report');
        return;
      }

      console.log('✅ Report name saved successfully to single record');
      toast.success('Report saved successfully');
      
    } catch (error: any) {
      console.error('❌ Error saving report:', error);
      toast.error('Failed to save report');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <p>Loading analysis data...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!analysisData) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <p>No analysis data available.</p>
        </div>
      </DashboardLayout>
    );
  }

  const columns = [
    {
      accessorKey: 'shipment.trackingId',
      header: 'Tracking ID',
    },
    {
      accessorKey: 'shipment.service',
      header: 'Original Service',
    },
    {
      accessorKey: 'recommendedService',
      header: 'Recommended Service',
    },
    {
      accessorKey: 'currentCost',
      header: 'Current Cost',
      cell: ({ row }) => `$${row.currentCost.toFixed(2)}`,
    },
    {
      accessorKey: 'recommendedCost',
      header: 'Recommended Cost',
      cell: ({ row }) => `$${row.recommendedCost.toFixed(2)}`,
    },
    {
      accessorKey: 'savings',
      header: 'Savings',
      cell: ({ row }) => {
        const savings = row.savings;
        const isNegative = savings < 0;
        const formattedSavings = `$${Math.abs(savings).toFixed(2)}`;
    
        return (
          <span style={{ color: isNegative ? 'red' : 'inherit' }}>
            {isNegative ? `(${formattedSavings})` : formattedSavings}
          </span>
        );
      },
    },
  ];

  const orphanedColumns = [
    {
      accessorKey: 'shipment.trackingId',
      header: 'Tracking ID',
    },
    {
      accessorKey: 'shipment.service',
      header: 'Original Service',
    },
    {
      accessorKey: 'error',
      header: 'Error',
    },
  ];

  return (
    <DashboardLayout>
      <div className="container mx-auto py-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <Button variant="ghost" onClick={() => navigate('/reports')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Reports
            </Button>
            <h1 className="text-3xl font-bold mb-1">Analysis Results</h1>
            <p className="text-muted-foreground">
              Review the analysis results and potential savings.
            </p>
          </div>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Report Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label htmlFor="report-name">Report Name</Label>
              <div className="flex items-center">
                <Input
                  id="report-name"
                  placeholder="Enter report name"
                  value={reportName}
                  onChange={(e) => setReportName(e.target.value)}
                  className="mr-2"
                />
                <Button
                  size="sm"
                  onClick={handleSaveReport}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <RotateCw className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <SummaryStats analysisData={analysisData} />

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            {analysisData.recommendations.length > 0 ? (
              <DataTable columns={columns} data={analysisData.recommendations} />
            ) : (
              <div className="flex items-center justify-center h-32">
                <p className="text-muted-foreground">No recommendations found.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Orphaned Shipments</CardTitle>
          </CardHeader>
          <CardContent>
            {analysisData.orphanedShipments.length > 0 ? (
              <DataTable columns={orphanedColumns} data={analysisData.orphanedShipments} />
            ) : (
              <div className="flex items-center justify-center h-32">
                <p className="text-muted-foreground">No orphaned shipments found.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Results;
