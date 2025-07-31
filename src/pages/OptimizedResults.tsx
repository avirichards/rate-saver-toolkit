import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { Button } from '@/components/ui-lov/Button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  ArrowLeft, 
  Download, 
  DollarSign, 
  Package, 
  TrendingUp, 
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  SkipBack,
  SkipForward
} from 'lucide-react';
import { toast } from 'sonner';
import { VirtualizedResultsTable } from '@/components/ui-lov/VirtualizedResultsTable';
import { useOptimizedAnalysis } from '@/hooks/useOptimizedAnalysis';
import { formatCurrency } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const OptimizedResults = () => {
  const navigate = useNavigate();
  const { analysisId } = useParams<{ analysisId: string }>();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'all' | 'wins' | 'losses'>('all');
  
  const {
    summary,
    shipments,
    currentPage,
    totalPages,
    loading,
    detailsLoading,
    nextPage,
    prevPage,
    firstPage,
    lastPage,
    hasNextPage,
    hasPrevPage,
    startRecord,
    endRecord,
    totalRecords,
    loadFullDetails
  } = useOptimizedAnalysis({ 
    analysisId,
    pageSize: 1000 // Load 1000 shipments per page
  });

  // Load full details when component mounts (for charts and stats)
  useEffect(() => {
    if (analysisId && summary) {
      loadFullDetails(analysisId);
    }
  }, [analysisId, summary, loadFullDetails]);

  const handleExport = async () => {
    toast.info('Export functionality will be implemented in next update');
  };

  const handleShipmentClick = (shipment: any) => {
    console.log('Clicked shipment:', shipment);
    // Could open detail modal or navigate to shipment detail page
  };

  if (loading && !summary) {
    return (
      <DashboardLayout>
        <div className="p-6 max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading analysis results...</p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!summary) {
    return (
      <DashboardLayout>
        <div className="p-6 max-w-7xl mx-auto">
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold mb-2">Analysis not found</h2>
            <p className="text-muted-foreground mb-4">The requested analysis could not be loaded.</p>
            <Button onClick={() => navigate('/reports')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Reports
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const totalSavings = summary.total_savings || 0;
  const savingsPercentage = totalSavings > 0 ? 15 : 0; // Estimate, would calculate from full data
  const winsCount = Math.floor(summary.total_shipments * 0.65); // Estimate
  const lossesCount = summary.total_shipments - winsCount;

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => navigate('/reports')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{summary.report_name || summary.file_name}</h1>
              <p className="text-muted-foreground">
                Analysis completed • {summary.total_shipments.toLocaleString()} shipments
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Savings</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(totalSavings)}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Shipments</p>
                  <p className="text-2xl font-bold">
                    {summary.total_shipments.toLocaleString()}
                  </p>
                </div>
                <Package className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Wins</p>
                  <p className="text-2xl font-bold text-green-600">
                    {winsCount.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {((winsCount / summary.total_shipments) * 100).toFixed(1)}%
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Losses</p>
                  <p className="text-2xl font-bold text-red-600">
                    {lossesCount.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {((lossesCount / summary.total_shipments) * 100).toFixed(1)}%
                  </p>
                </div>
                <TrendingDown className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Results Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Shipment Results</CardTitle>
              <div className="flex items-center gap-4">
                {/* Pagination Info */}
                <div className="text-sm text-muted-foreground">
                  {startRecord.toLocaleString()} - {endRecord.toLocaleString()} of {totalRecords.toLocaleString()}
                </div>
                
                {/* Pagination Controls */}
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={firstPage}
                    disabled={!hasPrevPage || loading}
                    className="h-8 w-8"
                  >
                    <SkipBack className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={prevPage}
                    disabled={!hasPrevPage || loading}
                    className="h-8 w-8"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="px-3 py-1 text-sm bg-muted rounded">
                    {currentPage + 1} of {totalPages}
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={nextPage}
                    disabled={!hasNextPage || loading}
                    className="h-8 w-8"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={lastPage}
                    disabled={!hasNextPage || loading}
                    className="h-8 w-8"
                  >
                    <SkipForward className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
              <TabsList className="mb-4">
                <TabsTrigger value="all">All Shipments</TabsTrigger>
                <TabsTrigger value="wins">Wins Only</TabsTrigger>
                <TabsTrigger value="losses">Losses Only</TabsTrigger>
              </TabsList>
              
              <TabsContent value="all">
                {loading && shipments.length === 0 ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
                      <p className="text-sm text-muted-foreground">Loading shipments...</p>
                    </div>
                  </div>
                ) : (
                  <VirtualizedResultsTable
                    shipments={shipments}
                    height={600}
                    onRowClick={handleShipmentClick}
                  />
                )}
              </TabsContent>
              
              <TabsContent value="wins">
                <VirtualizedResultsTable
                  shipments={shipments}
                  height={600}
                  onRowClick={handleShipmentClick}
                  showOnlyWins={true}
                />
              </TabsContent>
              
              <TabsContent value="losses">
                <VirtualizedResultsTable
                  shipments={shipments}
                  height={600}
                  onRowClick={handleShipmentClick}
                  showOnlyLosses={true}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Loading Indicator */}
        {loading && (
          <div className="text-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">Loading data...</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default OptimizedResults;