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
  const [dataPeriodDays, setDataPeriodDays] = useState<number>(7);

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
    // If no services are selected, show all data to avoid empty state
    let filtered = selectedServices.length === 0 ? shipmentData : 
      shipmentData.filter(item => selectedServices.includes(item.service));

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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Data Period Snapshot */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Input
                      type="number"
                      value={dataPeriodDays}
                      onChange={(e) => setDataPeriodDays(parseInt(e.target.value) || 7)}
                      className="w-16 h-6 text-sm"
                      min="1"
                      max="365"
                    />
                    Day Snapshot
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">{filteredStats.totalShipments} Total Shipments</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm">Current Cost</span>
                    <span className="font-semibold">${filteredStats.totalCurrentCost.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Ship Pro Cost</span>
                    <span className="font-semibold">${(filteredStats.totalCurrentCost - filteredStats.totalSavings).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Savings ($)</span>
                    <span className="font-semibold text-green-600">${filteredStats.totalSavings.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Savings (%)</span>
                    <span className="font-semibold text-green-600">{filteredStats.averageSavingsPercent.toFixed(2)}%</span>
                  </div>
                  <div className="pt-2 border-t">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Annualized Savings</span>
                      <span className="font-semibold text-green-600">
                        ${((filteredStats.totalSavings * 365) / dataPeriodDays).toFixed(0)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Charts */}
              <div className="lg:col-span-2 grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Shipment Volume by Service Type</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={serviceChartData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            outerRadius={70}
                            fill="#8884d8"
                            dataKey="value"
                            label={({ name, value }) => `${name} ${value}`}
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
                    <CardTitle className="text-base">Service Type Cost Comparison</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={serviceCostData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="service" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="currentCost" fill="#ef4444" name="Avg Current Cost" />
                          <Bar dataKey="newCost" fill="#22c55e" name="Avg SP Cost" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Service Types Table */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Current Service Types</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2 font-medium">Service Type</th>
                        <th className="text-right p-2 font-medium">Shipment Count</th>
                        <th className="text-right p-2 font-medium">Volume %</th>
                        <th className="text-right p-2 font-medium">Avg Weight</th>
                        <th className="text-right p-2 font-medium">Avg Current Cost</th>
                        <th className="text-right p-2 font-medium">Avg SP Cost</th>
                        <th className="text-right p-2 font-medium">Avg Savings ($)</th>
                        <th className="text-right p-2 font-medium">Avg Savings (%)</th>
                        <th className="text-center p-2 font-medium">Filter</th>
                      </tr>
                    </thead>
                    <tbody>
                      {serviceCostData.map((service, index) => {
                        const avgCurrentCost = service.currentCost / service.shipments;
                        const avgNewCost = service.newCost / service.shipments;
                        const avgSavings = service.savings / service.shipments;
                        const avgSavingsPercent = avgCurrentCost > 0 ? (avgSavings / avgCurrentCost) * 100 : 0;
                        const avgWeight = filteredData
                          .filter(item => item.service === service.service)
                          .reduce((sum, item) => sum + item.weight, 0) / service.shipments;
                        const volumePercent = (service.shipments / filteredStats.totalShipments) * 100;
                        
                        return (
                          <tr key={service.service} className="border-b hover:bg-muted/50">
                            <td className="p-2">{service.service}</td>
                            <td className="p-2 text-right">{service.shipments}</td>
                            <td className="p-2 text-right">{volumePercent.toFixed(1)}%</td>
                            <td className="p-2 text-right">{avgWeight.toFixed(2)}</td>
                            <td className="p-2 text-right">${avgCurrentCost.toFixed(2)}</td>
                            <td className="p-2 text-right">${avgNewCost.toFixed(2)}</td>
                            <td className="p-2 text-right text-green-600">${avgSavings.toFixed(2)}</td>
                            <td className="p-2 text-right text-green-600">{avgSavingsPercent.toFixed(2)}%</td>
                            <td className="p-2 text-center">
                              <Checkbox
                                checked={selectedServices.includes(service.service)}
                                onCheckedChange={() => toggleService(service.service)}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Rate Comparison by Weight */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Rate Comparison by Weight</CardTitle>
                <p className="text-sm text-muted-foreground">Compare average shipping costs by package weight</p>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={weightRangeData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Area dataKey="avgCurrentRate" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} name="Avg Current Cost" />
                      <Area dataKey="avgNewRate" stackId="2" stroke="#22c55e" fill="#22c55e" fillOpacity={0.6} name="Avg SP Cost" />
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
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2 font-medium min-w-[120px]">Order / Tracking</th>
                        <th className="text-left p-2 font-medium">Shipper Zip</th>
                        <th className="text-left p-2 font-medium">Recipient Zip</th>
                        <th className="text-right p-2 font-medium">Weight</th>
                        <th className="text-right p-2 font-medium">Length</th>
                        <th className="text-right p-2 font-medium">Width</th>
                        <th className="text-right p-2 font-medium">Height</th>
                        <th className="text-left p-2 font-medium">Current Service Type</th>
                        <th className="text-right p-2 font-medium">Current Cost</th>
                        <th className="text-right p-2 font-medium">SP Cost</th>
                        <th className="text-left p-2 font-medium">SP Service Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredData.map((row, index) => {
                        const isWin = row.savings > 0;
                        const isLoss = row.savings < 0;
                        const rowClass = isWin ? "bg-green-50" : isLoss ? "bg-red-50" : "";
                        
                        return (
                          <tr key={index} className={cn("border-b hover:bg-muted/50", rowClass)}>
                            <td className="p-2">{row.trackingId}</td>
                            <td className="p-2">{row.originZip}</td>
                            <td className="p-2">{row.destinationZip}</td>
                            <td className="p-2 text-right">{row.weight.toFixed(2)}</td>
                            <td className="p-2 text-right">-</td>
                            <td className="p-2 text-right">-</td>
                            <td className="p-2 text-right">-</td>
                            <td className="p-2">{row.service}</td>
                            <td className={cn("p-2 text-right font-medium", 
                              isWin ? "text-red-600" : isLoss ? "text-red-600" : ""
                            )}>
                              ${row.currentRate.toFixed(2)}
                            </td>
                            <td className={cn("p-2 text-right font-medium", 
                              isWin ? "text-green-600" : isLoss ? "text-green-600" : ""
                            )}>
                              ${row.newRate.toFixed(2)}
                            </td>
                            <td className="p-2">UPS® Ground</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                
                {filteredData.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No shipments match the current filters.
                  </div>
                )}
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