
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui-lov/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle, 
  RotateCw, 
  AlertCircle, 
  DollarSign, 
  TrendingDown, 
  Package, 
  Shield, 
  Clock,
  Download,
  Share2,
  ArrowLeft
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { SummaryStats } from '@/components/ui-lov/SummaryStats';
import { DataTable } from '@/components/ui-lov/DataTable';
import { OrphanedShipmentRow } from '@/components/ui-lov/OrphanedShipmentRow';
import { downloadReportExcel } from '@/utils/exportUtils';
import { getOrCreateReportShare, getShareUrl } from '@/utils/shareUtils';

interface ResultsProps {
  isClientView?: boolean;
  shareToken?: string;
}

const Results = ({ isClientView = false, shareToken }: ResultsProps) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const analysisId = shareToken ? null : searchParams.get('analysisId');
  
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!analysisId) {
      toast.error('No analysis ID provided');
      navigate('/upload');
      return;
    }

    let interval: NodeJS.Timeout;
    
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('shipping_analyses')
        .select('*')
        .eq('id', analysisId)
        .single();
      
      if (!error) {
        setAnalysis(data);
      }
      setLoading(false);
    };

    load();
    interval = setInterval(load, 5000);
    
    return () => clearInterval(interval);
  }, [analysisId, navigate]);

  if (loading && !analysis) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="flex items-center gap-2">
            <RotateCw className="h-6 w-6 animate-spin" />
            <span>Loading analysis...</span>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!analysis) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Analysis Not Found</h2>
            <p className="text-muted-foreground">The requested analysis could not be found.</p>
            <Button onClick={() => navigate('/upload')} className="mt-4">
              Start New Analysis
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const isCompleted = analysis.status === 'completed';
  const isProcessing = analysis.status === 'processing';
  const isFailed = analysis.status === 'failed';
  
  const processedShipments = analysis.processed_shipments || [];
  const orphanedShipments = analysis.orphaned_shipments || [];
  const metadata = analysis.processing_metadata || {};
  
  const progress = metadata.totalShipments > 0 
    ? ((metadata.completedShipments || 0) / metadata.totalShipments) * 100 
    : 0;

  const handleExport = async () => {
    try {
      await downloadReportExcel(analysis.id);
      toast.success('Analysis exported successfully!');
    } catch (error) {
      toast.error('Failed to export analysis');
    }
  };

  const handleShare = async () => {
    try {
      const shareData = await getOrCreateReportShare(analysis.id);
      if (shareData) {
        const shareUrl = getShareUrl(shareData.shareToken);
        await navigator.clipboard.writeText(shareUrl);
        toast.success('Share link copied to clipboard!');
      }
    } catch (error) {
      toast.error('Failed to create share link');
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto p-6">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-semibold mb-2">Analysis Results</h1>
              <p className="text-muted-foreground">
                {analysis.file_name} • {analysis.total_shipments} shipments
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate('/upload')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                New Analysis
              </Button>
              {isCompleted && (
                <>
                  <Button variant="outline" onClick={handleExport}>
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                  <Button variant="outline" onClick={handleShare}>
                    <Share2 className="h-4 w-4 mr-2" />
                    Share
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Status and Progress */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {isProcessing && <RotateCw className="h-5 w-5 animate-spin text-blue-500" />}
                {isCompleted && <CheckCircle className="h-5 w-5 text-green-500" />}
                {isFailed && <AlertCircle className="h-5 w-5 text-red-500" />}
                <span className="font-medium">
                  {isProcessing && 'Processing...'}
                  {isCompleted && 'Completed'}
                  {isFailed && 'Failed'}
                </span>
              </div>
              <div className="text-sm text-muted-foreground">
                {isProcessing && `${metadata.completedShipments || 0} of ${metadata.totalShipments || 0} processed`}
                {isCompleted && `Completed ${metadata.completedShipments || 0} shipments`}
                {isFailed && 'Analysis failed'}
              </div>
            </div>
            
            {(isProcessing || isCompleted) && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary Stats */}
        {(isCompleted || (isProcessing && processedShipments.length > 0)) && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <SummaryStats
              title="Total Shipments"
              value={metadata.totalShipments || 0}
              icon={<Package className="h-5 w-5" />}
              color="blue"
            />
            <SummaryStats
              title="Total Savings"
              value={`$${(analysis.total_savings || 0).toFixed(2)}`}
              icon={<DollarSign className="h-5 w-5" />}
              color="green"
            />
            <SummaryStats
              title="Completed"
              value={metadata.completedShipments || 0}
              icon={<CheckCircle className="h-5 w-5" />}
              color="green"
            />
            <SummaryStats
              title="Errors"
              value={metadata.errorShipments || 0}
              icon={<AlertCircle className="h-5 w-5" />}
              color="red"
            />
          </div>
        )}

        {/* Processed Shipments */}
        {processedShipments.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Processed Shipments ({processedShipments.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable 
                data={processedShipments} 
                columns={[
                  { key: 'trackingId', header: 'Tracking ID' },
                  { key: 'originZip', header: 'Origin' },
                  { key: 'destZip', header: 'Destination' },
                  { key: 'weight', header: 'Weight' },
                  { key: 'currentCost', header: 'Current Cost' },
                  { key: 'bestRate', header: 'Best Rate' },
                  { key: 'savings', header: 'Savings' }
                ]}
              />
            </CardContent>
          </Card>
        )}

        {/* Orphaned Shipments */}
        {orphanedShipments.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Orphaned Shipments ({orphanedShipments.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {orphanedShipments.map((shipment: any, index: number) => (
                  <OrphanedShipmentRow 
                    key={index} 
                    shipment={shipment} 
                    onFixAndAnalyze={() => {}}
                    isFixing={false}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error State */}
        {isFailed && (
          <Card className="border-red-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-red-500" />
                <div>
                  <p className="font-medium text-red-900">Analysis Failed</p>
                  <p className="text-sm text-red-700 mt-1">
                    {metadata.error || 'An unknown error occurred during analysis'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Results;
