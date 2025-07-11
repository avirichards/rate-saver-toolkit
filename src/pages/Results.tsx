import React, { useState, useEffect } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui-lov/Card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { Download, DollarSign, Package, TruckIcon, ArrowDownRight, AlertCircle, Filter, CheckCircle2, XCircle, Calendar, Zap, Target, TrendingUp, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui-lov/Button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface AnalysisData {
  totalCurrentCost: number;
  totalPotentialSavings: number;
  recommendations: any[];
  savingsPercentage: number;
  totalShipments: number;
  analyzedShipments: number;
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

const Results = () => {
  const location = useLocation();
  const params = useParams();
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [shipmentData, setShipmentData] = useState<any[]>([]);
  const [orphanedData, setOrphanedData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [resultFilter, setResultFilter] = useState<'all' | 'wins' | 'losses'>('all');
  const [sortConfig, setSortConfig] = useState<{key: string, direction: 'asc' | 'desc'} | null>(null);
  const [availableServices, setAvailableServices] = useState<string[]>([]);
  const [serviceFilters, setServiceFilters] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const loadAnalysisData = async () => {
      try {
        const state = location.state as { analysisComplete?: boolean; analysisData?: AnalysisData } | null;
        
        if (state?.analysisComplete && state.analysisData) {
          console.log('Using analysis data from navigation:', state.analysisData);
          setAnalysisData(state.analysisData);
          
          const formattedData = state.analysisData.recommendations.map((rec: any, index: number) => ({
            id: index + 1,
            trackingId: rec.shipment.trackingId || `Shipment-${index + 1}`,
            originZip: rec.shipment.originZip,
            destinationZip: rec.shipment.destZip,
            weight: parseFloat(rec.shipment.weight || '0'),
            service: rec.originalService || rec.shipment.service,
            currentRate: rec.currentCost,
            newRate: rec.recommendedCost,
            savings: rec.savings,
            savingsPercent: rec.currentCost > 0 ? (rec.savings / rec.currentCost) * 100 : 0
          }));
          
          setShipmentData(formattedData);
          
          const orphanedShipments = state.analysisData.recommendations
            .filter((rec: any) => rec.status === 'error' || rec.error)
            .map((rec: any, index: number) => ({
              id: index + 1,
              trackingId: rec.shipment?.trackingId || `Error-${index + 1}`,
              originZip: rec.shipment?.originZip || '',
              destinationZip: rec.shipment?.destZip || '',
              weight: parseFloat(rec.shipment?.weight || '0'),
              service: rec.shipment?.service || '',
              error: rec.error || 'Processing failed',
              errorType: rec.errorType || 'Unknown'
            }));
          
          setOrphanedData(orphanedShipments);
          
          // Initialize service data
          const services = [...new Set(formattedData.map(item => item.service).filter(Boolean))] as string[];
          setAvailableServices(services);
          const initialFilters: Record<string, boolean> = {};
          services.forEach(service => {
            initialFilters[service] = true;
          });
          setServiceFilters(initialFilters);
          
          setLoading(false);
        } else if (params.id) {
          await loadFromDatabase(params.id);
        } else {
          await loadMostRecentAnalysis();
        }
      } catch (error) {
        console.error('Error loading analysis data:', error);
        toast.error('Failed to load analysis results');
        setLoading(false);
      }
    };

    loadAnalysisData();
  }, [location, params.id]);

  const loadFromDatabase = async (analysisId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Please log in to view results');
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('shipping_analyses')
      .select('*')
      .eq('id', analysisId)
      .eq('user_id', user.id)
      .single();

    if (error || !data) {
      toast.error('Analysis not found');
      setLoading(false);
      return;
    }

    processAnalysisFromDatabase(data);
  };

  const loadMostRecentAnalysis = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Please log in to view results');
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('shipping_analyses')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Database error:', error);
      toast.error('Failed to load analysis results');
      setLoading(false);
      return;
    }

    if (!data) {
      toast.error('No analysis results found. Please run an analysis first.');
      setLoading(false);
      return;
    }

    console.log('Raw database data:', data);
  };

  const processAnalysisFromDatabase = (data: any) => {
    const savings = data.savings_analysis || {};
    const recommendations = data.recommendations || [];
    const originalData = data.original_data || [];
    
    // Use original_data if recommendations is incomplete
    const dataToUse = recommendations.length > 0 ? recommendations : originalData;
    
    console.log('Processing analysis from database:', {
      recommendations: recommendations.length,
      originalData: originalData.length,
      dataToUse: dataToUse.length
    });
    
    const analysisInfo: AnalysisData = {
      totalCurrentCost: savings.totalCurrentCost || 0,
      totalPotentialSavings: data.total_savings || 0,
      recommendations: dataToUse,
      savingsPercentage: savings.savingsPercentage || 0,
      totalShipments: data.total_shipments || 0,
      analyzedShipments: dataToUse.length
    };

    setAnalysisData(analysisInfo);

    const formattedData = dataToUse.map((rec: any, index: number) => ({
      id: index + 1,
      trackingId: rec.shipment?.trackingId || `Shipment-${index + 1}`,
      originZip: rec.shipment?.originZip || '',
      destinationZip: rec.shipment?.destZip || '',
      weight: parseFloat(rec.shipment?.weight || '0'),
      service: rec.originalService || rec.shipment?.service || '',
      currentRate: rec.currentCost || 0,
      newRate: rec.recommendedCost || 0,
      savings: rec.savings || 0,
      savingsPercent: rec.currentCost > 0 ? (rec.savings / rec.currentCost) * 100 : 0
    }));

    setShipmentData(formattedData);
    
    const orphanedShipments = recommendations
      .filter((rec: any) => rec.status === 'error' || rec.error)
      .map((rec: any, index: number) => ({
        id: index + 1,
        trackingId: rec.shipment?.trackingId || `Error-${index + 1}`,
        originZip: rec.shipment?.originZip || '',
        destinationZip: rec.shipment?.destZip || '',
        weight: parseFloat(rec.shipment?.weight || '0'),
        service: rec.shipment?.service || '',
        error: rec.error || 'Processing failed',
        errorType: rec.errorType || 'Unknown'
      }));
    
    setOrphanedData(orphanedShipments);
    
    // Initialize service data
    const services = [...new Set(formattedData.map(item => item.service).filter(Boolean))] as string[];
    setAvailableServices(services);
    const initialFilters: Record<string, boolean> = {};
    services.forEach(service => {
      initialFilters[service] = true;
    });
    setServiceFilters(initialFilters);
    
    setLoading(false);
  };

  // New filtering and sorting logic
  useEffect(() => {
    let filtered = [...shipmentData];

    // Apply result filter (all/wins/losses)
    if (resultFilter === 'wins') {
      filtered = filtered.filter(item => item.savings > 0);
    } else if (resultFilter === 'losses') {
      filtered = filtered.filter(item => item.savings < 0);
    }

    // Apply service filters
    const enabledServices = Object.entries(serviceFilters)
      .filter(([_, enabled]) => enabled)
      .map(([service, _]) => service);
    
    if (enabledServices.length > 0 && enabledServices.length < availableServices.length) {
      filtered = filtered.filter(item => enabledServices.includes(item.service));
    }

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(item => 
        item.trackingId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.originZip.includes(searchTerm) ||
        item.destinationZip.includes(searchTerm) ||
        item.service.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply sorting
    if (sortConfig) {
      filtered.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];
        
        // Handle numeric values
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
        }
        
        // Handle string values
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortConfig.direction === 'asc' 
            ? aValue.localeCompare(bValue) 
            : bValue.localeCompare(aValue);
        }
        
        return 0;
      });
    }

    setFilteredData(filtered);
  }, [shipmentData, resultFilter, serviceFilters, availableServices.length, searchTerm, sortConfig]);

  // Handle column sorting
  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Service filter handlers
  const toggleService = (service: string) => {
    setServiceFilters(prev => ({
      ...prev,
      [service]: !prev[service]
    }));
  };

  const toggleAllServices = (enabled: boolean) => {
    const newFilters: Record<string, boolean> = {};
    availableServices.forEach(service => {
      newFilters[service] = enabled;
    });
    setServiceFilters(newFilters);
  };

  // Get filtered statistics
  const getFilteredStats = () => {
    const totalShipments = filteredData.length;
    const totalCurrentCost = filteredData.reduce((sum, item) => sum + item.currentRate, 0);
    const totalSavings = filteredData.reduce((sum, item) => sum + item.savings, 0);
    const averageSavingsPercent = totalCurrentCost > 0 ? (totalSavings / totalCurrentCost) * 100 : 0;
    
    return {
      totalShipments,
      totalCurrentCost,
      totalSavings,
      averageSavingsPercent
    };
  };

  // Chart data generators
  const generateServiceChartData = (data: any[]) => {
    const serviceCount = data.reduce((acc, item) => {
      const service = item.service || 'Unknown';
      acc[service] = (acc[service] || 0) + 1;
      return acc;
    }, {});
    
    return Object.entries(serviceCount).map(([name, value]) => ({ name, value }));
  };

  const generateServiceCostData = (data: any[]) => {
    const serviceStats = data.reduce((acc, item) => {
      const service = item.service || 'Unknown';
      if (!acc[service]) {
        acc[service] = { 
          totalCurrent: 0, 
          totalNew: 0, 
          shipments: 0,
          totalSavings: 0
        };
      }
      acc[service].totalCurrent += item.currentRate;
      acc[service].totalNew += item.newRate;
      acc[service].shipments += 1;
      acc[service].totalSavings += item.savings;
      return acc;
    }, {});
    
    return Object.entries(serviceStats).map(([name, stats]: [string, any]) => ({
      service: name,
      currentCost: stats.totalCurrent,
      newCost: stats.totalNew,
      savings: stats.totalSavings,
      shipments: stats.shipments
    }));
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto p-6">
          <div className="text-center animate-fade-in">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-muted rounded w-1/3 mx-auto"></div>
              <div className="h-4 bg-muted rounded w-1/2 mx-auto"></div>
            </div>
            <p className="text-lg mt-4">Loading analysis results...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!analysisData || shipmentData.length === 0) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto p-6">
          <div className="text-center">
            <AlertCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-2xl font-semibold mb-2">No Analysis Results Found</h2>
            <p className="text-muted-foreground">Please run an analysis first to see results here.</p>
            <Button className="mt-4" onClick={() => window.location.href = '/upload'}>
              Start New Analysis
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const filteredStats = getFilteredStats();
  const serviceChartData = generateServiceChartData(filteredData);
  const serviceCostData = generateServiceCostData(filteredData);
  const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF7C7C'];

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto p-6 animate-fade-in">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Analysis Results
              </h1>
              <p className="text-muted-foreground mt-2">
                Comprehensive shipping analysis for {analysisData.totalShipments} shipments
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export Report
              </Button>
              <Button size="sm">
                <Target className="h-4 w-4 mr-2" />
                View Action Items
              </Button>
            </div>
          </div>

          {/* Quick Stats Header */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Package className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total Shipments</p>
                    <p className="text-2xl font-bold">{filteredStats.totalShipments}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-green-500">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <DollarSign className="h-8 w-8 text-green-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Potential Savings</p>
                    <p className="text-2xl font-bold text-green-600">${filteredStats.totalSavings.toFixed(0)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-orange-500">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-8 w-8 text-orange-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Savings Percentage</p>
                    <p className="text-2xl font-bold text-orange-600">{filteredStats.averageSavingsPercent.toFixed(1)}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-purple-500">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Calendar className="h-8 w-8 text-purple-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Current Costs</p>
                    <p className="text-2xl font-bold text-purple-600">
                      ${filteredStats.totalCurrentCost.toFixed(0)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="shipment-data">Shipment Data</TabsTrigger>
            <TabsTrigger value="orphaned-data">Orphaned Data ({orphanedData.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Service Type Filter for Overview */}
            <Card>
              <CardHeader>
                <CardTitle>Service Type Filters</CardTitle>
                <CardDescription>Filter results by service type</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant={Object.values(serviceFilters).every(enabled => enabled) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleAllServices(true)}
                  >
                    All Services
                  </Button>
                  <Button
                    variant={Object.values(serviceFilters).every(enabled => !enabled) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleAllServices(false)}
                  >
                    Clear All
                  </Button>
                  {availableServices.map((service) => (
                    <Button
                      key={service}
                      variant={serviceFilters[service] ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleService(service)}
                    >
                      {service} ({shipmentData.filter(item => item.service === service).length})
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Analysis Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="border-l-4 border-l-purple-500">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-purple-100 rounded-full">
                      <TruckIcon className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Analyzed Shipments</p>
                      <p className="text-2xl font-bold">{filteredStats.totalShipments}</p>
                      <p className="text-xs text-muted-foreground">of {analysisData.totalShipments} total</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-l-4 border-l-red-500">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-red-100 rounded-full">
                      <ArrowDownRight className="h-6 w-6 text-red-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Current Total Cost</p>
                      <p className="text-2xl font-bold">${filteredStats.totalCurrentCost.toFixed(0)}</p>
                      <p className="text-xs text-muted-foreground">based on analysis</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-l-4 border-l-emerald-500">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-emerald-100 rounded-full">
                      <Zap className="h-6 w-6 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Savings</p>
                      <p className="text-2xl font-bold text-emerald-600">${filteredStats.totalSavings.toFixed(0)}</p>
                      <p className="text-xs text-muted-foreground">{filteredStats.averageSavingsPercent.toFixed(1)}% reduction</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Service Volume Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={serviceChartData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, value, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        >
                          {serviceChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Cost Comparison by Service</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={serviceCostData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="service" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="currentCost" fill="#ef4444" name="Current Cost" />
                        <Bar dataKey="newCost" fill="#22c55e" name="Ship Pro Cost" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="shipment-data" className="space-y-6">
            {/* Filter Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <Input
                  placeholder="Search tracking ID, ZIP codes, or service..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full sm:w-auto"
                />
                <ResultFilter value={resultFilter} onChange={setResultFilter} />
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Showing {filteredData.length} of {shipmentData.length} shipments
                </span>
              </div>
            </div>

            {/* Service Type Filter */}
            <Card>
              <CardHeader>
                <CardTitle>Filter by Service Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={Object.values(serviceFilters).every(enabled => enabled) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleAllServices(true)}
                  >
                    All
                  </Button>
                  {availableServices.map((service) => (
                    <Button
                      key={service}
                      variant={serviceFilters[service] ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleService(service)}
                    >
                      {service}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Data Table */}
            <Card className="bg-background">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-background">
                      <TableRow className="border-b border-border/50">
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50 transition-colors text-foreground"
                          onClick={() => handleSort('trackingId')}
                        >
                          <div className="flex items-center gap-2">
                            Tracking ID
                            <ArrowUpDown className="h-4 w-4" />
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50 transition-colors text-foreground"
                          onClick={() => handleSort('originZip')}
                        >
                          <div className="flex items-center gap-2">
                            Origin
                            <ArrowUpDown className="h-4 w-4" />
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50 transition-colors text-foreground"
                          onClick={() => handleSort('destinationZip')}
                        >
                          <div className="flex items-center gap-2">
                            Destination
                            <ArrowUpDown className="h-4 w-4" />
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50 transition-colors text-foreground"
                          onClick={() => handleSort('weight')}
                        >
                          <div className="flex items-center gap-2">
                            Weight (lbs)
                            <ArrowUpDown className="h-4 w-4" />
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50 transition-colors text-foreground"
                          onClick={() => handleSort('service')}
                        >
                          <div className="flex items-center gap-2">
                            Service
                            <ArrowUpDown className="h-4 w-4" />
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50 transition-colors text-right text-foreground"
                          onClick={() => handleSort('currentRate')}
                        >
                          <div className="flex items-center justify-end gap-2">
                            Current Rate
                            <ArrowUpDown className="h-4 w-4" />
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50 transition-colors text-right text-foreground"
                          onClick={() => handleSort('newRate')}
                        >
                          <div className="flex items-center justify-end gap-2">
                            UPS Rate
                            <ArrowUpDown className="h-4 w-4" />
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50 transition-colors text-right text-foreground"
                          onClick={() => handleSort('savings')}
                        >
                          <div className="flex items-center justify-end gap-2">
                            Savings
                            <ArrowUpDown className="h-4 w-4" />
                          </div>
                        </TableHead>
                        <TableHead className="text-right text-foreground">
                          Savings %
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="bg-background">
                      {filteredData.map((item) => (
                        <TableRow 
                          key={item.id} 
                          className="hover:bg-muted/30 border-b border-border/30"
                        >
                          <TableCell className="font-medium text-foreground">
                            {item.trackingId}
                          </TableCell>
                          <TableCell className="text-foreground">
                            {item.originZip}
                          </TableCell>
                          <TableCell className="text-foreground">
                            {item.destinationZip}
                          </TableCell>
                          <TableCell className="text-foreground">
                            {item.weight.toFixed(1)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {item.service}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium text-foreground">
                            ${item.currentRate.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-medium text-foreground">
                            ${item.newRate.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className={cn(
                              "flex items-center justify-end gap-1 font-medium",
                              item.savings > 0 ? "text-green-600" : item.savings < 0 ? "text-red-600" : "text-muted-foreground"
                            )}>
                              {item.savings > 0 ? (
                                <CheckCircle2 className="h-4 w-4" />
                              ) : item.savings < 0 ? (
                                <XCircle className="h-4 w-4" />
                              ) : null}
                              ${Math.abs(item.savings).toFixed(2)}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={cn(
                              "font-medium",
                              item.savings > 0 ? "text-green-600" : item.savings < 0 ? "text-red-600" : "text-muted-foreground"
                            )}>
                              {item.savingsPercent.toFixed(1)}%
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="orphaned-data" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Orphaned Shipments</CardTitle>
                <CardDescription>
                  Shipments that encountered errors during processing
                </CardDescription>
              </CardHeader>
              <CardContent>
                {orphanedData.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
                    <h3 className="text-xl font-medium mb-2">Perfect Processing!</h3>
                    <p className="text-muted-foreground">
                      All shipments were successfully analyzed with no errors.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow className="border-b border-border">
                          <TableHead className="text-foreground">Tracking ID</TableHead>
                          <TableHead className="text-foreground">Origin Zip</TableHead>
                          <TableHead className="text-foreground">Destination Zip</TableHead>
                          <TableHead className="text-right text-foreground">Weight</TableHead>
                          <TableHead className="text-foreground">Service Type</TableHead>
                          <TableHead className="text-foreground">Error Type</TableHead>
                          <TableHead className="text-foreground">Error Details</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orphanedData.map((row, index) => (
                          <TableRow key={index} className="border-b border-border hover:bg-muted/50">
                            <TableCell className="font-medium text-foreground">{row.trackingId}</TableCell>
                            <TableCell className="text-foreground">{row.originZip}</TableCell>
                            <TableCell className="text-foreground">{row.destinationZip}</TableCell>
                            <TableCell className="text-right text-foreground">{row.weight.toFixed(1)}</TableCell>
                            <TableCell className="text-foreground">{row.service}</TableCell>
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
    </DashboardLayout>
  );
};

export default Results;