import React, { useState, useEffect } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { Download, DollarSign, Package, TruckIcon, ArrowDownRight, AlertCircle, Filter, CheckCircle2, XCircle, Calendar, Zap, Target, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui-lov/Button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';

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
  const [serviceFilters, setServiceFilters] = useState<Record<string, boolean>>({});
  const [availableServices, setAvailableServices] = useState<string[]>([]);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [savingsFilter, setSavingsFilter] = useState<string>('all');
  const [weightFilter, setWeightFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dataPeriodDays, setDataPeriodDays] = useState<number>(7);
  const [showAllServices, setShowAllServices] = useState(true);

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
          
          const services = [...new Set(formattedData.map(item => item.service).filter(Boolean))] as string[];
          setAvailableServices(services);
          
          // Initialize service filters - all enabled by default
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
    
    const services = [...new Set(formattedData.map(item => item.service).filter(Boolean))] as string[];
    setAvailableServices(services);
    
    // Initialize service filters
    const initialFilters: Record<string, boolean> = {};
    services.forEach(service => {
      initialFilters[service] = true;
    });
    setServiceFilters(initialFilters);
    
    setLoading(false);
  };

  // New filtering logic
  useEffect(() => {
    let filtered = shipmentData;

    // Apply service filters only if not showing all services
    if (!showAllServices) {
      const enabledServices = Object.entries(serviceFilters)
        .filter(([_, enabled]) => enabled)
        .map(([service, _]) => service);
      
      if (enabledServices.length > 0) {
        filtered = filtered.filter(item => enabledServices.includes(item.service));
      }
    }

    // Apply other filters
    if (savingsFilter !== 'all') {
      if (savingsFilter === 'wins') {
        filtered = filtered.filter(item => item.savings > 0);
      } else if (savingsFilter === 'losses') {
        filtered = filtered.filter(item => item.savings < 0);
      }
    }

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

    if (searchTerm) {
      filtered = filtered.filter(item => 
        item.trackingId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.originZip.includes(searchTerm) ||
        item.destinationZip.includes(searchTerm)
      );
    }

    setFilteredData(filtered);
  }, [shipmentData, serviceFilters, showAllServices, savingsFilter, weightFilter, searchTerm]);

  // Toggle individual service
  const toggleService = (service: string) => {
    setServiceFilters(prev => ({
      ...prev,
      [service]: !prev[service]
    }));
  };

  // Toggle all services
  const toggleAllServices = (enabled: boolean) => {
    setShowAllServices(enabled);
    if (!enabled) {
      // When switching to selective mode, enable all services initially
      const allEnabled: Record<string, boolean> = {};
      availableServices.forEach(service => {
        allEnabled[service] = true;
      });
      setServiceFilters(allEnabled);
    }
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
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF7C7C'];

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
                    <p className="text-sm text-muted-foreground">Annualized Savings</p>
                    <p className="text-2xl font-bold text-purple-600">
                      ${((filteredStats.totalSavings * 365) / dataPeriodDays).toFixed(0)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="shipments" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Shipment Data ({filteredStats.totalShipments})
            </TabsTrigger>
            <TabsTrigger value="orphans" className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Orphans ({orphanedData.length})
            </TabsTrigger>
          </TabsList>
          
          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Service Filter Controls */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Service Type Filters
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Switch
                      id="show-all-services"
                      checked={showAllServices}
                      onCheckedChange={toggleAllServices}
                    />
                    <label htmlFor="show-all-services" className="text-sm font-medium">
                      Show All Service Types
                    </label>
                  </div>
                  
                  {!showAllServices && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4 border-t">
                      {availableServices.map((service) => (
                        <div key={service} className="flex items-center space-x-2">
                          <Checkbox
                            id={service}
                            checked={serviceFilters[service] || false}
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
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Data Period Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={dataPeriodDays}
                    onChange={(e) => setDataPeriodDays(parseInt(e.target.value) || 7)}
                    className="w-20 h-8 text-base font-bold"
                    min="1"
                    max="365"
                  />
                  Day Analysis Period
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Adjust the time period to see projected annual savings
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Current Cost</p>
                    <p className="text-xl font-bold">${filteredStats.totalCurrentCost.toFixed(2)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Ship Pro Cost</p>
                    <p className="text-xl font-bold">${(filteredStats.totalCurrentCost - filteredStats.totalSavings).toFixed(2)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Period Savings</p>
                    <p className="text-xl font-bold text-green-600">${filteredStats.totalSavings.toFixed(2)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Annual Projection</p>
                    <p className="text-xl font-bold text-green-600">
                      ${((filteredStats.totalSavings * 365) / dataPeriodDays).toFixed(0)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

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
          
          {/* Shipment Data Tab */}
          <TabsContent value="shipments" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Detailed Shipment Analysis</CardTitle>
                <div className="flex flex-wrap gap-4 mt-4">
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
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-3 font-medium">Order / Tracking</th>
                        <th className="text-left p-3 font-medium">Shipper Zip</th>
                        <th className="text-left p-3 font-medium">Recipient Zip</th>
                        <th className="text-right p-3 font-medium">Weight</th>
                        <th className="text-right p-3 font-medium">Length</th>
                        <th className="text-right p-3 font-medium">Width</th>
                        <th className="text-right p-3 font-medium">Height</th>
                        <th className="text-left p-3 font-medium">Current Service Type</th>
                        <th className="text-right p-3 font-medium">Current Cost</th>
                        <th className="text-right p-3 font-medium">SP Cost</th>
                        <th className="text-left p-3 font-medium">SP Service Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredData.map((row, index) => {
                        const isWin = row.savings > 0;
                        const isLoss = row.savings < 0;
                        
                        return (
                          <tr 
                            key={index} 
                            className={cn(
                              "border-b hover:bg-muted/30 transition-colors",
                              isWin && "bg-green-50 hover:bg-green-100",
                              isLoss && "bg-red-50 hover:bg-red-100"
                            )}
                          >
                            <td className="p-3 font-medium">{row.trackingId}</td>
                            <td className="p-3">{row.originZip}</td>
                            <td className="p-3">{row.destinationZip}</td>
                            <td className="p-3 text-right">{row.weight.toFixed(2)}</td>
                            <td className="p-3 text-right">-</td>
                            <td className="p-3 text-right">-</td>
                            <td className="p-3 text-right">-</td>
                            <td className="p-3">{row.service}</td>
                            <td className="p-3 text-right font-medium">
                              ${row.currentRate.toFixed(2)}
                            </td>
                            <td className={cn(
                              "p-3 text-right font-medium",
                              isWin && "text-green-700",
                              isLoss && "text-red-700"
                            )}>
                              ${row.newRate.toFixed(2)}
                            </td>
                            <td className="p-3">UPS® Ground</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                
                {filteredData.length === 0 && (
                  <div className="text-center py-12">
                    <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No Shipments Found</h3>
                    <p className="text-muted-foreground">Try adjusting your filters to see more results.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Orphans Tab */}
          <TabsContent value="orphans" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Orphaned Shipments</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Shipments that encountered errors during processing
                </p>
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
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left p-3 font-medium">Tracking ID</th>
                          <th className="text-left p-3 font-medium">Origin Zip</th>
                          <th className="text-left p-3 font-medium">Destination Zip</th>
                          <th className="text-right p-3 font-medium">Weight</th>
                          <th className="text-left p-3 font-medium">Service Type</th>
                          <th className="text-left p-3 font-medium">Error Type</th>
                          <th className="text-left p-3 font-medium">Error Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orphanedData.map((row, index) => (
                          <tr key={index} className="border-b hover:bg-muted/30">
                            <td className="p-3 font-medium">{row.trackingId}</td>
                            <td className="p-3">{row.originZip}</td>
                            <td className="p-3">{row.destinationZip}</td>
                            <td className="p-3 text-right">{row.weight.toFixed(1)}</td>
                            <td className="p-3">{row.service}</td>
                            <td className="p-3">
                              <Badge variant="destructive">{row.errorType}</Badge>
                            </td>
                            <td className="p-3">
                              <div className="max-w-xs truncate text-muted-foreground" title={row.error}>
                                {row.error}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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