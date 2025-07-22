
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { Button } from '@/components/ui-lov/Button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { SummaryStats } from '@/components/ui-lov/SummaryStats';
import { DataTable } from '@/components/ui-lov/DataTable';
import { OrphanedShipmentRow } from '@/components/ui-lov/OrphanedShipmentRow';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowLeft, RefreshCw, Clock, CheckCircle, XCircle } from 'lucide-react';

interface ResultsProps {
  isClientView?: boolean;
  shareToken?: string;
}

const Results: React.FC<ResultsProps> = ({ isClientView, shareToken }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get analysisId from URL params
  const searchParams = new URLSearchParams(location.search);
  const analysisId = searchParams.get('analysisId');

  // Load analysis data
  const loadAnalysis = async () => {
    if (!analysisId) {
      setError('No analysis ID provided');
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('shipping_analyses')
        .select('*')
        .eq('id', analysisId)
        .single();

      if (error) {
        throw error;
      }

      setAnalysis(data);
      setError(null);
    } catch (err: any) {
      console.error('Error loading analysis:', err);
      setError(err.message);
      toast.error('Failed to load analysis');
    } finally {
      setLoading(false);
    }
  };

  // Set up real-time subscription
  useEffect(() => {
    if (!analysisId) return;

    // Initial load
    loadAnalysis();

    // Set up real-time subscription
    const channel = supabase
      .channel(`analysis-${analysisId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'shipping_analyses',
          filter: `id=eq.${analysisId}`
        },
        (payload) => {
          console.log('Real-time analysis update:', payload);
          setAnalysis(payload.new);
        }
      )
      .subscribe();

    // Set up polling for processing analyses
    let pollInterval: NodeJS.Timeout;
    if (analysis?.status === 'processing') {
      pollInterval = setInterval(loadAnalysis, 5000);
    }

    return () => {
      supabase.removeChannel(channel);
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [analysisId, analysis?.status]);

  const getStatusIcon = () => {
    switch (analysis?.status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'processing':
        return <Clock className="h-5 w-5 text-blue-500 animate-pulse" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusText = () => {
    switch (analysis?.status) {
      case 'completed':
        return 'Analysis Complete';
      case 'failed':
        return 'Analysis Failed';
      case 'processing':
        return 'Analysis in Progress';
      default:
        return 'Unknown Status';
    }
  };

  const getStatusBadge = () => {
    switch (analysis?.status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800">Failed</Badge>;
      case 'processing':
        return <Badge className="bg-blue-100 text-blue-800">Processing</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const metadata = analysis?.processing_metadata || {};
  const progressPercentage = metadata.progressPercentage || 0;
  const currentShipment = metadata.currentShipment || 0;
  const completedShipments = metadata.completedShipments || 0;
  const errorShipments = metadata.errorShipments || 0;
  const totalShipments = analysis?.total_shipments || 0;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-500" />
            <p className="text-muted-foreground">Loading analysis results...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !analysis) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <XCircle className="h-8 w-8 mx-auto mb-4 text-red-500" />
            <p className="text-red-600 mb-4">{error || 'Analysis not found'}</p>
            <Button onClick={() => navigate('/upload')}>
              Back to Upload
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
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
              <h1 className="text-2xl font-bold">Analysis Results</h1>
              <p className="text-muted-foreground">
                {analysis.file_name} • {getStatusText()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            {getStatusBadge()}
          </div>
        </div>

        {/* Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getStatusIcon()}
              {getStatusText()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analysis.status === 'processing' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progress: {progressPercentage}%</span>
                    <span>
                      {currentShipment} of {totalShipments} shipments processed
                    </span>
                  </div>
                  <Progress value={progressPercentage} className="w-full" />
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="text-center">
                    <div className="font-medium text-green-600">{completedShipments}</div>
                    <div className="text-muted-foreground">Completed</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-red-600">{errorShipments}</div>
                    <div className="text-muted-foreground">Errors</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-blue-600">{totalShipments - completedShipments - errorShipments}</div>
                    <div className="text-muted-foreground">Remaining</div>
                  </div>
                </div>
              </div>
            )}

            {analysis.status === 'failed' && (
              <div className="bg-red-50 p-4 rounded-lg">
                <p className="text-sm font-medium text-red-800">
                  {metadata.error || 'An error occurred during processing'}
                </p>
                <p className="text-sm text-red-600 mt-2">
                  Failed at: {metadata.failedAt ? new Date(metadata.failedAt).toLocaleString() : 'Unknown'}
                </p>
              </div>
            )}

            {analysis.status === 'completed' && analysis.total_savings && (
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm font-medium text-green-800">
                  Total Potential Savings: ${analysis.total_savings.toFixed(2)}
                </p>
                <p className="text-sm text-green-600 mt-1">
                  Completed {completedShipments} of {totalShipments} shipments
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results - Only show if completed */}
        {analysis.status === 'completed' && (
          <>
            {/* Summary Stats */}
            {analysis.savings_analysis && (
              <SummaryStats 
                totalShipments={analysis.savings_analysis.totalShipments}
                totalSavings={analysis.savings_analysis.totalPotentialSavings}
                totalCurrentCost={analysis.savings_analysis.totalCurrentCost}
                completedShipments={analysis.savings_analysis.completedShipments}
                errorShipments={analysis.savings_analysis.errorShipments}
                savingsPercentage={analysis.savings_analysis.savingsPercentage}
              />
            )}

            {/* Processed Shipments */}
            {analysis.processed_shipments && analysis.processed_shipments.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Processed Shipments</CardTitle>
                </CardHeader>
                <CardContent>
                  <DataTable 
                    data={analysis.processed_shipments} 
                    columns={[
                      { accessorKey: 'trackingId', header: 'Tracking ID' },
                      { accessorKey: 'originZip', header: 'Origin' },
                      { accessorKey: 'destinationZip', header: 'Destination' },
                      { accessorKey: 'weight', header: 'Weight' },
                      { accessorKey: 'service', header: 'Service' },
                      { accessorKey: 'currentRate', header: 'Current Rate' },
                      { accessorKey: 'newRate', header: 'New Rate' },
                      { accessorKey: 'savings', header: 'Savings' }
                    ]}
                    title="Processed Shipments"
                  />
                </CardContent>
              </Card>
            )}

            {/* Orphaned Shipments */}
            {analysis.orphaned_shipments && analysis.orphaned_shipments.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Failed Shipments</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {analysis.orphaned_shipments.map((orphan: any, index: number) => (
                  <OrphanedShipmentRow 
                    key={index} 
                    shipment={orphan} 
                    onFixAndAnalyze={() => {}}
                    isFixing={false}
                  />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Results;
