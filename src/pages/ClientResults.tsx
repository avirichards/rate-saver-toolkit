import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui-lov/Card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { Download, DollarSign, Package, TruckIcon, ArrowDownRight, AlertCircle, Filter, CheckCircle2, XCircle, Calendar, Zap, Target, TrendingUp, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui-lov/Button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn, formatCurrency, formatPercentage, getSavingsColor } from '@/lib/utils';
import { getStateFromZip } from '@/utils/zipToStateMapping';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
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

// Custom slider component for All/Wins/Losses
const ResultFilter = ({ value, onChange }: { value: 'all' | 'wins' | 'losses', onChange: (value: 'all' | 'wins' | 'losses') => void }) => {
  const options = [
    { value: 'all', label: 'All' },
    { value: 'wins', label: 'Wins' },
    { value: 'losses', label: 'Losses' }
  ] as const;

  return (
    <div className="flex items-center bg-muted rounded-lg p-1">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "px-4 py-2 text-sm font-medium rounded-md transition-all",
            value === option.value
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};

const ClientResults = () => {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [shipmentData, setShipmentData] = useState<any[]>([]);
  const [orphanedData, setOrphanedData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [resultFilter, setResultFilter] = useState<'all' | 'wins' | 'losses'>('all');
  const [sortConfig, setSortConfig] = useState<{key: string, direction: 'asc' | 'desc'} | null>(null);
  const [availableServices, setAvailableServices] = useState<string[]>([]);
  const [selectedService, setSelectedService] = useState<string>('all');
  const [selectedServicesOverview, setSelectedServicesOverview] = useState<string[]>([]);
  const [snapshotDays, setSnapshotDays] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [clientBranding, setClientBranding] = useState<any>(null);

  // Data validation function to check for missing critical data
  const validateShipmentData = (shipment: any): { isValid: boolean; missingFields: string[]; errorType: string } => {
    const missingFields: string[] = [];
    
    if (!shipment.originZip) missingFields.push('Origin ZIP');
    if (!shipment.destZip && !shipment.destinationZip) missingFields.push('Destination ZIP');
    if (!shipment.weight || shipment.weight <= 0) missingFields.push('Weight');
    if (!shipment.service) missingFields.push('Service');
    
    const isValid = missingFields.length === 0;
    const errorType = isValid ? 'None' : 'Missing Data';
    
    return { isValid, missingFields, errorType };
  };

  // Calculate markup for individual shipment (using final markup data)
  const getShipmentMarkup = (shipment: any, markupData: any) => {
    if (!markupData) return { markedUpPrice: shipment.newRate, margin: 0, marginPercent: 0 };
    
    const shipProsCost = shipment.newRate || 0;
    let markupPercent = 0;
    
    if (markupData.markupType === 'global') {
      markupPercent = markupData.globalMarkup || 0;
    } else {
      markupPercent = markupData.perServiceMarkup?.[shipment.service] || 0;
    }
    
    const markedUpPrice = shipProsCost * (1 + markupPercent / 100);
    const margin = markedUpPrice - shipProsCost;
    const marginPercent = shipProsCost > 0 ? (margin / shipProsCost) * 100 : 0;
    
    return { markedUpPrice, margin, marginPercent };
  };

  // Export functionality
  const exportToCSV = () => {
    const csvData = filteredData.map(item => {
      return {
        'Tracking ID': item.trackingId,
        'Origin ZIP': item.originZip,
        'Destination ZIP': item.destinationZip,
        'Weight': item.weight,
        'Carrier': item.carrier,
        'Service': item.service,
        'Current Rate': formatCurrency(item.currentRate),
        'Recommended Rate': formatCurrency(item.newRate),
        'Savings': formatCurrency(item.savings),
        'Savings Percentage': formatPercentage(item.savingsPercent)
      };
    });

    const csvContent = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `shipping_analysis_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    const loadSharedReport = async () => {
      if (!shareToken) {
        setError('Invalid share link');
        setLoading(false);
        return;
      }

      try {
        const sharedData = await getSharedReport(shareToken);
        await updateViewCount(shareToken);

        const analysis = sharedData.shipping_analyses;
        setClientBranding((analysis as any).clients?.branding_config);

        // Process the analysis data exactly like Results.tsx
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

        // Format shipment data exactly like Results.tsx
        const formattedShipments: any[] = [];
        const orphanedShipments: any[] = [];
        const originalData = Array.isArray(analysis.original_data) ? analysis.original_data : [];

        originalData.forEach((rec: any, index: number) => {
          const shipmentData = rec.shipment || rec;
          const validation = validateShipmentData(shipmentData);
          
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

          // Apply markup if available (same logic as Results.tsx)
          if (analysis.markup_data) {
            const markupInfo = getShipmentMarkup(formattedShipment, analysis.markup_data);
            formattedShipment.newRate = markupInfo.markedUpPrice;
            formattedShipment.savings = formattedShipment.currentRate - markupInfo.markedUpPrice;
            formattedShipment.savingsPercent = formattedShipment.currentRate > 0 ? 
              (formattedShipment.savings / formattedShipment.currentRate) * 100 : 0;
          }

          // Check if shipment has explicit error status OR missing data
          if (rec.status === 'error' || rec.error || !validation.isValid) {
            orphanedShipments.push({
              ...formattedShipment,
              error: rec.error || `Missing required data: ${validation.missingFields.join(', ')}`,
              errorType: rec.errorType || validation.errorType,
              missingFields: validation.missingFields
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

        // Initialize service data
        const services = [...new Set(formattedShipments.map(item => item.service).filter(Boolean))] as string[];
        setAvailableServices(services);
        setSelectedServicesOverview([]); // Default to unchecked

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

  // Filter and sort logic (same as Results.tsx)
  useEffect(() => {
    if (!shipmentData) return;

    let filtered = [...shipmentData];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.trackingId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.originZip?.toString().includes(searchTerm) ||
        item.destinationZip?.toString().includes(searchTerm) ||
        item.service?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.carrier?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply result filter
    if (resultFilter === 'wins') {
      filtered = filtered.filter(item => item.savings > 0);
    } else if (resultFilter === 'losses') {
      filtered = filtered.filter(item => item.savings <= 0);
    }

    // Apply service filter
    if (selectedService !== 'all') {
      filtered = filtered.filter(item => item.service === selectedService);
    }

    // Apply sorting
    if (sortConfig) {
      filtered.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];
        
        if (typeof aValue === 'string') aValue = aValue.toLowerCase();
        if (typeof bValue === 'string') bValue = bValue.toLowerCase();
        
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    setFilteredData(filtered);
  }, [shipmentData, searchTerm, resultFilter, selectedService, sortConfig]);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

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

  // Chart data processing (same as Results.tsx)
  const serviceBreakdownData = filteredData.reduce((acc: any[], item) => {
    const existing = acc.find(a => a.service === item.service);
    if (existing) {
      existing.count += 1;
      existing.totalSavings += item.savings;
      existing.currentCost += item.currentRate;
      existing.newCost += item.newRate;
    } else {
      acc.push({
        service: item.service,
        count: 1,
        totalSavings: item.savings,
        currentCost: item.currentRate,
        newCost: item.newRate
      });
    }
    return acc;
  }, []);

  const topSavingsOpportunities = [...filteredData]
    .sort((a, b) => b.savings - a.savings)
    .slice(0, 10);

  const stateDistribution = filteredData.reduce((acc: any[], item) => {
    const state = getStateFromZip(item.destinationZip);
    const existing = acc.find(a => a.state === state);
    if (existing) {
      existing.shipments += 1;
      existing.savings += item.savings;
      existing.volume += item.currentRate;
    } else {
      acc.push({
        state,
        shipments: 1,
        savings: item.savings,
        volume: item.currentRate
      });
    }
    return acc;
  }, []).sort((a, b) => b.shipments - a.shipments);

  const serviceStats = serviceBreakdownData.map(service => ({
    ...service,
    avgSavings: service.count > 0 ? service.totalSavings / service.count : 0,
    savingsPercent: service.currentCost > 0 ? (service.totalSavings / service.currentCost) * 100 : 0
  }));

  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00C49F', '#FFBB28', '#FF8042', '#0088FE'];

  return (
    <div className="min-h-screen bg-background">
      {/* Header with Navigation */}
      <div className="bg-card border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-foreground">
                Shipping Analysis Results
              </h1>
              {analysisData.report_name && (
                <Badge variant="outline" className="text-sm">
                  {analysisData.report_name}
                </Badge>
              )}
            </div>
            <div className="flex items-center space-x-4">
              <Button onClick={exportToCSV} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="shipments">Detailed Shipping Report</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="orphans">
              Orphans
              {orphanedData.length > 0 && (
                <Badge variant="destructive" className="ml-2 text-xs">
                  {orphanedData.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
          </TabsContent>

          {/* Detailed Shipping Report Tab */}
          <TabsContent value="shipments" className="space-y-6">
            {/* Filters */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Shipping Report</CardTitle>
                    <CardDescription>
                      Detailed breakdown of {filteredData.length} shipments
                    </CardDescription>
                  </div>
                  <div className="flex items-center space-x-4">
                    <ResultFilter value={resultFilter} onChange={setResultFilter} />
                    <Button onClick={exportToCSV} variant="outline" size="sm">
                      <Download className="w-4 h-4 mr-2" />
                      Export
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <Input
                      placeholder="Search shipments..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="max-w-sm"
                    />
                  </div>
                  <Select value={selectedService} onValueChange={setSelectedService}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Filter by service" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Services</SelectItem>
                      {availableServices.map((service) => (
                        <SelectItem key={service} value={service}>
                          {service}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Shipments Table */}
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          <button
                            onClick={() => handleSort('trackingId')}
                            className="flex items-center space-x-1 font-semibold"
                          >
                            <span>Tracking ID</span>
                            <ArrowUpDown className="h-4 w-4" />
                          </button>
                        </TableHead>
                        <TableHead>Route</TableHead>
                        <TableHead>
                          <button
                            onClick={() => handleSort('service')}
                            className="flex items-center space-x-1 font-semibold"
                          >
                            <span>Service</span>
                            <ArrowUpDown className="h-4 w-4" />
                          </button>
                        </TableHead>
                        <TableHead>
                          <button
                            onClick={() => handleSort('weight')}
                            className="flex items-center space-x-1 font-semibold"
                          >
                            <span>Weight</span>
                            <ArrowUpDown className="h-4 w-4" />
                          </button>
                        </TableHead>
                        <TableHead className="text-right">
                          <button
                            onClick={() => handleSort('currentRate')}
                            className="flex items-center space-x-1 font-semibold ml-auto"
                          >
                            <span>Current Rate</span>
                            <ArrowUpDown className="h-4 w-4" />
                          </button>
                        </TableHead>
                        <TableHead className="text-right">
                          <button
                            onClick={() => handleSort('newRate')}
                            className="flex items-center space-x-1 font-semibold ml-auto"
                          >
                            <span>Recommended Rate</span>
                            <ArrowUpDown className="h-4 w-4" />
                          </button>
                        </TableHead>
                        <TableHead className="text-right">
                          <button
                            onClick={() => handleSort('savings')}
                            className="flex items-center space-x-1 font-semibold ml-auto"
                          >
                            <span>Savings</span>
                            <ArrowUpDown className="h-4 w-4" />
                          </button>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredData.map((item) => (
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
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Service Performance */}
              <Card>
                <CardHeader>
                  <CardTitle>Service Performance</CardTitle>
                  <CardDescription>Savings analysis by service type</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {serviceStats.slice(0, 5).map((service, index) => (
                      <div key={service.service} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div>
                          <div className="font-medium">{service.service}</div>
                          <div className="text-sm text-muted-foreground">{service.count} shipments</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-green-600">{formatCurrency(service.totalSavings)}</div>
                          <div className="text-sm text-muted-foreground">{formatPercentage(service.savingsPercent)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Top States by Volume */}
              <Card>
                <CardHeader>
                  <CardTitle>Top States by Volume</CardTitle>
                  <CardDescription>Destination states with highest shipping volume</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={stateDistribution.slice(0, 8)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="state" />
                      <YAxis />
                      <Tooltip formatter={(value, name) => [
                        name === 'shipments' ? `${value} shipments` : formatCurrency(value as number),
                        name === 'shipments' ? 'Shipments' : 'Total Volume'
                      ]} />
                      <Bar dataKey="shipments" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Orphans Tab */}
          <TabsContent value="orphans" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-orange-500" />
                  Orphaned Shipments
                  <Badge variant="destructive">{orphanedData.length}</Badge>
                </CardTitle>
                <CardDescription>
                  Shipments that could not be processed due to missing or invalid data
                </CardDescription>
              </CardHeader>
              <CardContent>
                {orphanedData.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Orphaned Shipments</h3>
                    <p className="text-gray-500">All shipments were processed successfully!</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tracking ID</TableHead>
                          <TableHead>Route</TableHead>
                          <TableHead>Weight</TableHead>
                          <TableHead>Service</TableHead>
                          <TableHead>Missing Fields</TableHead>
                          <TableHead>Error Type</TableHead>
                          <TableHead>Error Details</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orphanedData.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="font-medium">{row.trackingId}</TableCell>
                            <TableCell>
                              {row.originZip || <span className="text-muted-foreground italic">Missing</span>} → {row.destinationZip || <span className="text-muted-foreground italic">Missing</span>}
                            </TableCell>
                            <TableCell>
                              {row.weight > 0 ? `${row.weight} lbs` : <span className="text-muted-foreground italic">Missing</span>}
                            </TableCell>
                            <TableCell>
                              {row.service || <span className="text-muted-foreground italic">Missing</span>}
                            </TableCell>
                            <TableCell>
                              {row.missingFields && row.missingFields.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {row.missingFields.map((field: string, idx: number) => (
                                    <Badge key={idx} variant="outline" className="text-xs text-orange-600 border-orange-300">
                                      {field}
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="destructive">{row.errorType}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="max-w-xs truncate text-muted-foreground" title={row.error}>
                                {row.error}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                     </TableBody>
                   </Table>
                 </div>
               )}
             </CardContent>
           </Card>
         </TabsContent>
       </Tabs>
     </div>
   </div>
 );
};

export default ClientResults;