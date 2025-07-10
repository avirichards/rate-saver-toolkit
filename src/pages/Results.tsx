import React, { useState, useEffect } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { SummaryStats } from '@/components/ui-lov/SummaryStats';
import { DataTable } from '@/components/ui-lov/DataTable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { Download, DollarSign, Package, TruckIcon, ArrowDownRight, AlertCircle, Filter, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui-lov/Button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AnalysisData {
  totalCurrentCost: number;
  totalPotentialSavings: number;
  recommendations: any[];
  savingsPercentage: number;
  totalShipments: number;
  analyzedShipments: number;
}

const Results = () => {
  const location = useLocation();
  const params = useParams();
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [shipmentData, setShipmentData] = useState<any[]>([]);
  const [orphanedData, setOrphanedData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [availableServices, setAvailableServices] = useState<string[]>([]);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [savingsFilter, setSavingsFilter] = useState<string>('all');
  const [weightFilter, setWeightFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const loadAnalysisData = async () => {
      try {
        // Check if we have data from analysis navigation
        const state = location.state as { analysisComplete?: boolean; analysisData?: AnalysisData } | null;
        
        if (state?.analysisComplete && state.analysisData) {
          // Use data passed from analysis
          console.log('Using analysis data from navigation:', state.analysisData);
          setAnalysisData(state.analysisData);
          
          // Convert recommendations to shipment data format
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
          
          // Extract orphaned/error shipments
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
          
          // Extract available services
          const services = [...new Set(formattedData.map(item => item.service).filter(Boolean))] as string[];
          setAvailableServices(services);
          setSelectedServices(services);
          
          setLoading(false);
        } else if (params.id) {
          // Load from database using the ID
          await loadFromDatabase(params.id);
        } else {
          // Load most recent analysis
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

    processAnalysisFromDatabase(data);
  };

  const processAnalysisFromDatabase = (data: any) => {
    const savings = data.savings_analysis || {};
    const recommendations = data.recommendations || [];
    
    const analysisInfo: AnalysisData = {
      totalCurrentCost: savings.totalCurrentCost || 0,
      totalPotentialSavings: data.total_savings || 0,
      recommendations,
      savingsPercentage: savings.savingsPercentage || 0,
      totalShipments: data.total_shipments || 0,
      analyzedShipments: recommendations.length
    };

    setAnalysisData(analysisInfo);

    // Convert to display format
    const formattedData = recommendations.map((rec: any, index: number) => ({
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
    
    // Extract orphaned/error shipments from database
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
    
    // Extract available services
    const services = [...new Set(formattedData.map(item => item.service).filter(Boolean))] as string[];
    setAvailableServices(services);
    setSelectedServices(services);
    
    setLoading(false);
  };

  // Filter data based on selected services and other filters
  useEffect(() => {
    let filtered = shipmentData.filter(item => 
      selectedServices.includes(item.service)
    );

    // Apply savings filter
    if (savingsFilter !== 'all') {
      if (savingsFilter === 'wins') {
        filtered = filtered.filter(item => item.savings > 0);
      } else if (savingsFilter === 'losses') {
        filtered = filtered.filter(item => item.savings < 0);
      }
    }

    // Apply weight filter
    if (weightFilter !== 'all') {
      const ranges = {
        '0-5': [0, 5],
        '5-10': [5, 10],
        '10-15': [10, 15],
        '15+': [15, Infinity]
      };
      const [min, max] = ranges[weightFilter as keyof typeof ranges] || [0, Infinity];
      filtered = filtered.filter(item => item.weight >= min && item.weight < max);
    }

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(item => 
        item.trackingId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.originZip.includes(searchTerm) ||
        item.destinationZip.includes(searchTerm)
      );
    }

    setFilteredData(filtered);
  }, [shipmentData, selectedServices, savingsFilter, weightFilter, searchTerm]);

  // Service toggle handler
  const toggleService = (service: string) => {
    setSelectedServices(prev => 
      prev.includes(service) 
        ? prev.filter(s => s !== service)
        : [...prev, service]
    );
  };

  // Calculate filtered statistics
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

  // Dynamic chart data generation functions
  const generateServiceChartData = (data: any[]) => {
    const serviceCount = data.reduce((acc, item) => {
      const service = item.service || 'Unknown';
      acc[service] = (acc[service] || 0) + 1;
      return acc;
    }, {});
    
    return Object.entries(serviceCount).map(([name, value]) => ({ name, value }));
  };

  const generateWeightRangeData = (data: any[]) => {
    const ranges = {
      '0-5': { shipments: 0, totalSavings: 0, avgRate: 0 },
      '5-10': { shipments: 0, totalSavings: 0, avgRate: 0 },
      '10-15': { shipments: 0, totalSavings: 0, avgRate: 0 },
      '15+': { shipments: 0, totalSavings: 0, avgRate: 0 }
    };
    
    data.forEach(item => {
      const weight = parseFloat(item.weight) || 0;
      const savings = item.savings || 0;
      const rate = item.currentRate || 0;
      
      if (weight <= 5) {
        ranges['0-5'].shipments++;
        ranges['0-5'].totalSavings += savings;
        ranges['0-5'].avgRate += rate;
      } else if (weight <= 10) {
        ranges['5-10'].shipments++;
        ranges['5-10'].totalSavings += savings;
        ranges['5-10'].avgRate += rate;
      } else if (weight <= 15) {
        ranges['10-15'].shipments++;
        ranges['10-15'].totalSavings += savings;
        ranges['10-15'].avgRate += rate;
      } else {
        ranges['15+'].shipments++;
        ranges['15+'].totalSavings += savings;
        ranges['15+'].avgRate += rate;
      }
    });
    
    return Object.entries(ranges).map(([name, data]) => ({
      name: `${name} lbs`,
      shipments: data.shipments,
      savings: data.totalSavings,
      avgCurrentRate: data.shipments > 0 ? data.avgRate / data.shipments : 0,
      avgNewRate: data.shipments > 0 ? (data.avgRate - data.totalSavings) / data.shipments : 0
    }));
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
        <div className="max-w-6xl mx-auto p-6">
          <div className="text-center">
            <p className="text-lg">Loading analysis results...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!analysisData || shipmentData.length === 0) {
    return (
      <DashboardLayout>
        <div className="max-w-6xl mx-auto p-6">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Analysis Results Found</h2>
            <p className="text-muted-foreground">Please run an analysis first to see results here.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Get filtered statistics
  const filteredStats = getFilteredStats();
  
  // Chart data based on filtered data
  const serviceChartData = generateServiceChartData(filteredData);
  const weightRangeData = generateWeightRangeData(filteredData);
  const serviceCostData = generateServiceCostData(filteredData);
  
  // Colors for charts
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF7C7C'];

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold mb-2">Analysis Results</h1>
          <p className="text-muted-foreground">
            Comprehensive shipping analysis showing potential savings and optimization opportunities for {analysisData.totalShipments} shipments.
          </p>
        </div>
        
        {/* Analysis Tabs */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="shipments">Shipment Data</TabsTrigger>
            <TabsTrigger value="orphans">Orphans ({orphanedData.length})</TabsTrigger>
          </TabsList>
          
          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-6">
            {/* Summary Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Package className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{filteredStats.totalShipments}</p>
                      <p className="text-sm text-muted-foreground">Total Shipments</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-green-500/10 rounded-lg">
                      <DollarSign className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">${filteredStats.totalCurrentCost.toFixed(2)}</p>
                      <p className="text-sm text-muted-foreground">Current Cost</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-emerald-500/10 rounded-lg">
                      <ArrowDownRight className="h-6 w-6 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">${filteredStats.totalSavings.toFixed(2)}</p>
                      <p className="text-sm text-muted-foreground">Potential Savings</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-orange-500/10 rounded-lg">
                      <TruckIcon className="h-6 w-6 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{filteredStats.averageSavingsPercent.toFixed(1)}%</p>
                      <p className="text-sm text-muted-foreground">Average Savings</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Service Type Filters */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Service Type Filters</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Toggle service types to see how they affect your savings
                </p>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  {availableServices.map(service => (
                    <div key={service} className="flex items-center space-x-2">
                      <Checkbox
                        id={service}
                        checked={selectedServices.includes(service)}
                        onCheckedChange={() => toggleService(service)}
                      />
                      <label
                        htmlFor={service}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {service}
                      </label>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <Card>
                <CardHeader>
                  <CardTitle>Shipment Volume by Service Type</CardTitle>
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
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
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
                        <Bar dataKey="newCost" fill="#22c55e" name="Optimized Cost" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Rate Comparison by Weight Range</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={weightRangeData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Area dataKey="avgCurrentRate" stackId="1" stroke="#ef4444" fill="#ef4444" name="Current Rate" />
                      <Area dataKey="avgNewRate" stackId="2" stroke="#22c55e" fill="#22c55e" name="Optimized Rate" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Shipment Data Tab */}
          <TabsContent value="shipments" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Shipment Analysis Details</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Detailed breakdown of each shipment showing current vs. optimized rates
                </p>
                
                {/* Filters */}
                <div className="flex flex-wrap gap-4 mt-4">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    <span className="text-sm font-medium">Filters:</span>
                  </div>
                  
                  <Select value={savingsFilter} onValueChange={setSavingsFilter}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Savings" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Results</SelectItem>
                      <SelectItem value="wins">Wins Only</SelectItem>
                      <SelectItem value="losses">Losses Only</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Select value={weightFilter} onValueChange={setWeightFilter}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Weight" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Weights</SelectItem>
                      <SelectItem value="0-5">0-5 lbs</SelectItem>
                      <SelectItem value="5-10">5-10 lbs</SelectItem>
                      <SelectItem value="10-15">10-15 lbs</SelectItem>
                      <SelectItem value="15+">15+ lbs</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Input
                    placeholder="Search tracking ID or ZIP..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-[200px]"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <DataTable 
                  data={filteredData.map(item => ({
                    ...item,
                    isWin: item.savings > 0,
                    isLoss: item.savings < 0
                  }))}
                  columns={[
                    { 
                      accessorKey: 'trackingId', 
                      header: 'Order/Tracking ID'
                    },
                    { 
                      accessorKey: 'originZip', 
                      header: 'Shipper Zip'
                    },
                    { 
                      accessorKey: 'destinationZip', 
                      header: 'Recipient Zip'
                    },
                    { 
                      accessorKey: 'weight', 
                      header: 'Weight (lbs)',
                      cell: (info: any) => `${info.getValue().toFixed(1)}`
                    },
                    { 
                      accessorKey: 'service', 
                      header: 'Current Service Type'
                    },
                    { 
                      accessorKey: 'currentRate', 
                      header: 'Current Cost',
                      cell: (info: any) => `$${info.getValue().toFixed(2)}`
                    },
                    { 
                      accessorKey: 'newRate', 
                      header: 'SP Cost',
                      cell: (info: any) => `$${info.getValue().toFixed(2)}`
                    },
                    { 
                      accessorKey: 'savings', 
                      header: 'Savings',
                      cell: (info: any) => {
                        const value = info.getValue();
                        const isWin = value > 0;
                        return (
                          <div className={cn("flex items-center gap-1", 
                            isWin ? "text-green-600" : value < 0 ? "text-red-600" : "text-muted-foreground"
                          )}>
                            {isWin ? <CheckCircle2 className="h-3 w-3" /> : value < 0 ? <XCircle className="h-3 w-3" /> : null}
                            ${Math.abs(value).toFixed(2)}
                          </div>
                        );
                      }
                    },
                    { 
                      accessorKey: 'savingsPercent', 
                      header: 'Savings %',
                      cell: (info: any) => {
                        const value = info.getValue();
                        const isWin = value > 0;
                        return (
                          <span className={cn(
                            "font-medium",
                            isWin ? "text-green-600" : value < 0 ? "text-red-600" : "text-muted-foreground"
                          )}>
                            {value > 0 ? '+' : ''}{value.toFixed(1)}%
                          </span>
                        );
                      }
                    }
                  ]}
                  title="Shipment Analysis"
                  searchable={false}
                />
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Orphans Tab */}
          <TabsContent value="orphans" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Orphaned Shipments</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Shipments that encountered errors during processing or were skipped
                </p>
              </CardHeader>
              <CardContent>
                {orphanedData.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">All Shipments Processed Successfully</h3>
                    <p className="text-muted-foreground">
                      Great! All shipments were successfully analyzed with no errors or orphaned records.
                    </p>
                  </div>
                ) : (
                  <DataTable 
                    data={orphanedData}
                    columns={[
                      { 
                        accessorKey: 'trackingId', 
                        header: 'Tracking ID'
                      },
                      { 
                        accessorKey: 'originZip', 
                        header: 'Origin Zip'
                      },
                      { 
                        accessorKey: 'destinationZip', 
                        header: 'Destination Zip'
                      },
                      { 
                        accessorKey: 'weight', 
                        header: 'Weight (lbs)',
                        cell: (info: any) => `${info.getValue().toFixed(1)}`
                      },
                      { 
                        accessorKey: 'service', 
                        header: 'Service Type'
                      },
                      { 
                        accessorKey: 'errorType', 
                        header: 'Error Type',
                        cell: (info: any) => (
                          <Badge variant="destructive">
                            {info.getValue()}
                          </Badge>
                        )
                      },
                      { 
                        accessorKey: 'error', 
                        header: 'Error Details',
                        cell: (info: any) => (
                          <div className="max-w-xs truncate text-sm text-muted-foreground" title={info.getValue()}>
                            {info.getValue()}
                          </div>
                        )
                      }
                    ]}
                    title="Error Details"
                  />
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