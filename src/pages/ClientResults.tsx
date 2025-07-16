import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui-lov/Card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { DollarSign, Package, TruckIcon, ArrowDownRight, AlertCircle, CheckCircle2, XCircle, Calendar, Zap, Target, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn, formatCurrency, formatPercentage, getSavingsColor } from '@/lib/utils';
import { getStateFromZip } from '@/utils/zipToStateMapping';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getSharedReport, updateViewCount } from '@/utils/shareUtils';

interface AnalysisData {
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

const ClientResults = () => {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [shipmentData, setShipmentData] = useState<any[]>([]);
  const [orphanedData, setOrphanedData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clientBranding, setClientBranding] = useState<any>(null);

  useEffect(() => {
    const loadSharedReport = async () => {
      if (!shareToken) {
        setError('Invalid share link');
        setLoading(false);
        return;
      }

      try {
        const sharedData = await getSharedReport(shareToken);
        
        // Update view count
        await updateViewCount(shareToken);

        const analysis = sharedData.shipping_analyses;
        setClientBranding((analysis as any).clients?.branding_config);

        // Process the analysis data similar to Results.tsx
        const processedData = {
          totalCurrentCost: 0,
          totalPotentialSavings: analysis.total_savings || 0,
          recommendations: Array.isArray(analysis.original_data) ? analysis.original_data : [],
          savingsPercentage: 0,
          totalShipments: analysis.total_shipments,
          analyzedShipments: 0,
          completedShipments: 0,
          errorShipments: 0,
          file_name: analysis.file_name,
          report_name: analysis.report_name,
          client_id: analysis.client_id
        };

        // Use markup_data for final calculations if available
        const markupData = analysis.markup_data as any;
        const savingsAnalysis = analysis.savings_analysis as any;
        
        if (markupData?.savingsAmount && markupData?.savingsPercentage) {
          processedData.totalPotentialSavings = markupData.savingsAmount;
          processedData.savingsPercentage = markupData.savingsPercentage;
        } else if (savingsAnalysis) {
          processedData.totalPotentialSavings = savingsAnalysis.totalSavings || analysis.total_savings || 0;
          processedData.savingsPercentage = savingsAnalysis.savingsPercentage || 0;
        }

        // Format shipment data
        const formattedShipments: any[] = [];
        const orphanedShipments: any[] = [];
        const originalData = Array.isArray(analysis.original_data) ? analysis.original_data : [];

        originalData.forEach((rec: any, index: number) => {
          const shipmentData = rec.shipment || rec;
          
          const formattedShipment = {
            id: index + 1,
            trackingId: shipmentData.trackingId || `Shipment-${index + 1}`,
            originZip: shipmentData.originZip || '',
            destinationZip: shipmentData.destZip || '',
            weight: parseFloat(shipmentData.weight || '0'),
            carrier: shipmentData.carrier || rec.carrier || 'Unknown',
            service: rec.originalService || shipmentData.service || '',
            currentRate: rec.currentCost || 0,
            newRate: rec.recommendedCost || 0,
            savings: rec.savings || 0,
            savingsPercent: rec.currentCost > 0 ? (rec.savings / rec.currentCost) * 100 : 0
          };

          // Apply markup if available
          if (analysis.markup_data) {
            const markupData = analysis.markup_data as any;
            let markupPercent = 0;
            
            if (markupData.markupType === 'global') {
              markupPercent = markupData.globalMarkup || 0;
            } else {
              markupPercent = markupData.perServiceMarkup?.[formattedShipment.service] || 0;
            }
            
            const markedUpPrice = formattedShipment.newRate * (1 + markupPercent / 100);
            formattedShipment.newRate = markedUpPrice;
            formattedShipment.savings = formattedShipment.currentRate - markedUpPrice;
            formattedShipment.savingsPercent = formattedShipment.currentRate > 0 ? 
              (formattedShipment.savings / formattedShipment.currentRate) * 100 : 0;
          }

          if (rec.status === 'error' || rec.error) {
            orphanedShipments.push({
              ...formattedShipment,
              error: rec.error || 'Processing failed',
              errorType: rec.errorType || 'Unknown'
            });
          } else {
            formattedShipments.push(formattedShipment);
          }
        });

        // Calculate totals
        processedData.totalCurrentCost = formattedShipments.reduce((sum, item) => sum + (item.currentRate || 0), 0);
        processedData.analyzedShipments = formattedShipments.length;
        processedData.completedShipments = formattedShipments.length;
        processedData.errorShipments = orphanedShipments.length;

        if (processedData.totalCurrentCost > 0) {
          processedData.savingsPercentage = (processedData.totalPotentialSavings / processedData.totalCurrentCost) * 100;
        }

        setAnalysisData(processedData);
        setShipmentData(formattedShipments);
        setOrphanedData(orphanedShipments);
        setLoading(false);
      } catch (error: any) {
        console.error('Error loading shared report:', error);
        setError(error.message || 'Failed to load report');
        setLoading(false);
      }
    };

    loadSharedReport();
  }, [shareToken]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading analysis report...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Unable to Load Report</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!analysisData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">No Data Available</h1>
          <p className="text-muted-foreground">This report appears to be empty.</p>
        </div>
      </div>
    );
  }

  // Chart data processing (similar to Results.tsx)
  const serviceBreakdownData = shipmentData.reduce((acc: any[], item) => {
    const existing = acc.find(a => a.service === item.service);
    if (existing) {
      existing.count += 1;
      existing.totalSavings += item.savings;
    } else {
      acc.push({
        service: item.service,
        count: 1,
        totalSavings: item.savings
      });
    }
    return acc;
  }, []);

  const topSavingsOpportunities = [...shipmentData]
    .sort((a, b) => b.savings - a.savings)
    .slice(0, 10);

  const stateDistribution = shipmentData.reduce((acc: any[], item) => {
    const state = getStateFromZip(item.destinationZip);
    const existing = acc.find(a => a.state === state);
    if (existing) {
      existing.shipments += 1;
      existing.savings += item.savings;
    } else {
      acc.push({
        state,
        shipments: 1,
        savings: item.savings
      });
    }
    return acc;
  }, []).sort((a, b) => b.shipments - a.shipments);

  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00C49F', '#FFBB28', '#FF8042', '#0088FE'];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Shipping Analysis Report
            </h1>
            <p className="text-muted-foreground">
              {analysisData.report_name || analysisData.file_name}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Savings</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(analysisData.totalPotentialSavings)}
              </div>
              <p className="text-xs text-muted-foreground">
                {formatPercentage(analysisData.savingsPercentage)} reduction
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Shipments</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analysisData.totalShipments}</div>
              <p className="text-xs text-muted-foreground">
                {analysisData.analyzedShipments} analyzed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatPercentage((analysisData.completedShipments || 0) / analysisData.totalShipments * 100)}
              </div>
              <p className="text-xs text-muted-foreground">
                {analysisData.completedShipments} successful
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Savings</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {formatPercentage(analysisData.savingsPercentage)}
              </div>
              <p className="text-xs text-muted-foreground">
                per shipment
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Service Breakdown Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Savings by Service Type</CardTitle>
              <CardDescription>Total savings breakdown by shipping service</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={serviceBreakdownData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="service" />
                  <YAxis tickFormatter={(value) => `$${value}`} />
                  <Tooltip formatter={(value) => [formatCurrency(value as number), 'Total Savings']} />
                  <Bar dataKey="totalSavings" fill="#22c55e" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* State Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Geographic Distribution</CardTitle>
              <CardDescription>Shipments by destination state</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={stateDistribution.slice(0, 8)}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ state, percent }) => `${state} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="shipments"
                  >
                    {stateDistribution.slice(0, 8).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Top Savings Opportunities */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Top Savings Opportunities</CardTitle>
            <CardDescription>Highest individual savings potential</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tracking ID</TableHead>
                    <TableHead>Route</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Weight</TableHead>
                    <TableHead className="text-right">Current Rate</TableHead>
                    <TableHead className="text-right">Recommended Rate</TableHead>
                    <TableHead className="text-right">Savings</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topSavingsOpportunities.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.trackingId}</TableCell>
                      <TableCell>{item.originZip} → {item.destinationZip}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.service}</Badge>
                      </TableCell>
                      <TableCell>{item.weight} lbs</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.currentRate)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.newRate)}</TableCell>
                      <TableCell className="text-right">
                        <div className={cn("font-medium", getSavingsColor(item.savingsPercent))}>
                          {formatCurrency(item.savings)}
                          <div className="text-xs text-muted-foreground">
                            {formatPercentage(item.savingsPercent)}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Error Summary */}
        {orphanedData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-orange-500" />
                Processing Issues
              </CardTitle>
              <CardDescription>
                {orphanedData.length} shipments could not be processed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {orphanedData.slice(0, 5).map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-2 bg-muted rounded">
                    <span className="font-medium">{item.trackingId}</span>
                    <span className="text-sm text-muted-foreground">{item.error}</span>
                  </div>
                ))}
                {orphanedData.length > 5 && (
                  <p className="text-sm text-muted-foreground text-center">
                    ... and {orphanedData.length - 5} more
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ClientResults;