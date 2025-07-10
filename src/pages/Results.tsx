import React, { useState, useEffect } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { SummaryStats } from '@/components/ui-lov/SummaryStats';
import { DataTable } from '@/components/ui-lov/DataTable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Download, DollarSign, Package, TruckIcon, ArrowDownRight, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui-lov/Button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
  const [loading, setLoading] = useState(true);

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
    setLoading(false);
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
      '0-5 lbs': { shipments: 0, totalSavings: 0 },
      '5-10 lbs': { shipments: 0, totalSavings: 0 },
      '10-15 lbs': { shipments: 0, totalSavings: 0 },
      '15+ lbs': { shipments: 0, totalSavings: 0 }
    };
    
    data.forEach(item => {
      const weight = parseFloat(item.weight) || 0;
      const savings = item.savings || 0;
      
      if (weight <= 5) {
        ranges['0-5 lbs'].shipments++;
        ranges['0-5 lbs'].totalSavings += savings;
      } else if (weight <= 10) {
        ranges['5-10 lbs'].shipments++;
        ranges['5-10 lbs'].totalSavings += savings;
      } else if (weight <= 15) {
        ranges['10-15 lbs'].shipments++;
        ranges['10-15 lbs'].totalSavings += savings;
      } else {
        ranges['15+ lbs'].shipments++;
        ranges['15+ lbs'].totalSavings += savings;
      }
    });
    
    return Object.entries(ranges).map(([name, data]) => ({
      name,
      shipments: data.shipments,
      savings: data.totalSavings
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

  // Calculate summary statistics from actual data
  const totalShipments = analysisData.totalShipments;
  const totalCurrentCost = analysisData.totalCurrentCost;
  const totalSavings = analysisData.totalPotentialSavings;
  const averageSavingsPercent = analysisData.savingsPercentage;

  // Chart data
  const serviceChartData = generateServiceChartData(shipmentData);
  const weightRangeData = generateWeightRangeData(shipmentData);
  
  // Colors for charts
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF7C7C'];

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold mb-2">Analysis Results</h1>
          <p className="text-muted-foreground">
            Comprehensive shipping analysis showing potential savings and optimization opportunities for {totalShipments} shipments.
          </p>
        </div>

        {/* Summary Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Package className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalShipments}</p>
                  <p className="text-sm text-muted-foreground">Total Shipments</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-green-100 rounded-lg">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">${totalCurrentCost.toFixed(2)}</p>
                  <p className="text-sm text-muted-foreground">Current Cost</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <ArrowDownRight className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">${totalSavings.toFixed(2)}</p>
                  <p className="text-sm text-muted-foreground">Potential Savings</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <TruckIcon className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{averageSavingsPercent.toFixed(1)}%</p>
                  <p className="text-sm text-muted-foreground">Average Savings</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Detailed Analysis Tabs */}
        <Tabs defaultValue="detailed" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="detailed">Detailed Results</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="summary">Executive Summary</TabsTrigger>
          </TabsList>
          
          <TabsContent value="detailed" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Shipment Analysis Details</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Detailed breakdown of each shipment showing current vs. optimized rates
                </p>
              </CardHeader>
              <CardContent>
                <DataTable 
                  data={shipmentData}
                  columns={[
                    { key: 'trackingId', label: 'Tracking ID' },
                    { key: 'originZip', label: 'Origin' },
                    { key: 'destinationZip', label: 'Destination' },
                    { key: 'weight', label: 'Weight (lbs)' },
                    { key: 'service', label: 'Original Service' },
                    { key: 'currentRate', label: 'Current Rate', format: (value: number) => `$${value.toFixed(2)}` },
                    { key: 'newRate', label: 'New Rate', format: (value: number) => `$${value.toFixed(2)}` },
                    { key: 'savings', label: 'Savings', format: (value: number) => `$${value.toFixed(2)}` },
                    { key: 'savingsPercent', label: 'Savings %', format: (value: number) => `${value.toFixed(1)}%` }
                  ]}
                  title="Shipment Analysis"
                />
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="analytics" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Service Type Distribution</CardTitle>
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
                  <CardTitle>Savings by Weight Range</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={weightRangeData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="shipments" fill="#8884d8" name="Shipments" />
                        <Bar dataKey="savings" fill="#82ca9d" name="Total Savings" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="summary" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Package className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{totalShipments}</p>
                      <p className="text-sm text-muted-foreground">Total Shipments</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <DollarSign className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">${totalSavings.toFixed(2)}</p>
                      <p className="text-sm text-muted-foreground">Potential Savings</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-orange-100 rounded-lg">
                      <TruckIcon className="h-6 w-6 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{averageSavingsPercent.toFixed(1)}%</p>
                      <p className="text-sm text-muted-foreground">Average Savings</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Results;