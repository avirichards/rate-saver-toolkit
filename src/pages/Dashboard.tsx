
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { SummaryStats } from '@/components/ui-lov/SummaryStats';
import { Button } from '@/components/ui-lov/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ArrowUpRight, Package, TruckIcon, DollarSign, BarChart4, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState({
    totalShipments: 0,
    averageCost: 0,
    totalSavings: 0,
    monthlyTrends: [],
    serviceTypeData: [],
    recentAnalyses: []
  });
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      // Fetch shipping analyses for the user
      const { data: analyses, error: analysesError } = await supabase
        .from('shipping_analyses')
        .select(`
          id,
          report_name,
          file_name,
          total_shipments,
          total_savings,
          created_at,
          processed_shipments,
          status
        `)
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (analysesError) throw analysesError;

      let totalShipments = 0;
      let totalCost = 0;
      let totalSavings = 0;
      const monthlyData = {};
      const serviceTypeMap = {};

      analyses?.forEach(analysis => {
        const shipmentCount = Number(analysis.total_shipments) || 0;
        const savingsAmount = Number(analysis.total_savings) || 0;
        
        totalShipments += shipmentCount;
        totalSavings += savingsAmount;

        // Process monthly trends
        const month = new Date(analysis.created_at).toLocaleDateString('en-US', { month: 'short' });
        if (!monthlyData[month]) {
          monthlyData[month] = { shipments: 0, spend: 0, savings: 0 };
        }
        monthlyData[month].shipments += shipmentCount;
        monthlyData[month].savings += savingsAmount;

        // Process service type distribution
        if (Array.isArray(analysis.processed_shipments)) {
          analysis.processed_shipments.forEach((shipment: any) => {
            const service = shipment.customer_service || 'Unknown';
            if (!serviceTypeMap[service]) {
              serviceTypeMap[service] = 0;
            }
            serviceTypeMap[service]++;
            
            // Add to total cost calculation
            if (shipment.customer_cost) {
              const cost = Number(shipment.customer_cost) || 0;
              totalCost += cost;
              monthlyData[month].spend += cost;
            }
          });
        }
      });

      // Convert monthly data to array
      const monthlyTrendsData = Object.entries(monthlyData)
        .map(([month, data]: [string, any]) => ({ name: month, ...data }))
        .slice(-6); // Last 6 months

      // Convert service type data to array with percentages
      const serviceTypeData = Object.entries(serviceTypeMap)
        .map(([name, shipments]: [string, number]) => ({
          name,
          shipments,
          percentage: totalShipments > 0 ? Math.round((shipments / totalShipments) * 100) : 0
        }))
        .sort((a, b) => b.shipments - a.shipments)
        .slice(0, 5); // Top 5 service types

      const averageCost = totalShipments > 0 ? totalCost / totalShipments : 0;

      setDashboardData({
        totalShipments,
        averageCost,
        totalSavings,
        monthlyTrends: monthlyTrendsData,
        serviceTypeData,
        recentAnalyses: analyses?.slice(0, 3) || []
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleStartNewAnalysis = () => {
    navigate('/upload');
  };
  
  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold">Dashboard</h1>
              <p className="text-muted-foreground mt-2">
                Overview of your shipping analytics and performance
              </p>
            </div>
            <Button 
              variant="primary"
              onClick={handleStartNewAnalysis}
              className="mt-4 sm:mt-0"
              iconRight={<ArrowRight className="ml-1 h-4 w-4" />}
            >
              Start New Analysis
            </Button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <SummaryStats
            title="Total Shipments"
            value={loading ? "..." : dashboardData.totalShipments.toLocaleString()}
            description={dashboardData.totalShipments > 0 ? "Across all analyses" : "No shipments analyzed yet"}
            icon={<Package />}
            color="blue"
          />
          
          <SummaryStats
            title="Average Cost"
            value={loading ? "..." : `$${dashboardData.averageCost.toFixed(2)}`}
            description={dashboardData.averageCost > 0 ? "Per shipment" : "No cost data available"}
            icon={<DollarSign />}
            color="green"
          />
          
          <SummaryStats
            title="Total Savings"
            value={loading ? "..." : `$${dashboardData.totalSavings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            description={dashboardData.totalSavings > 0 ? "From rate optimizations" : "No savings calculated yet"}
            icon={<BarChart4 />}
            color="amber"
          />
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Shipping Trends</CardTitle>
              <CardDescription>Showing data for the past 6 months</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-muted-foreground">Loading...</p>
                  </div>
                ) : dashboardData.monthlyTrends.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dashboardData.monthlyTrends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip formatter={(value, name) => [
                        name === 'spend' || name === 'savings' ? `$${value}` : value,
                        name === 'spend' ? 'Total Spend' : name === 'savings' ? 'Total Savings' : 'Shipment Count'
                      ]} />
                      <Line type="monotone" name="Shipments" dataKey="shipments" stroke="#8884d8" activeDot={{ r: 8 }} />
                      <Line type="monotone" name="Spend" dataKey="spend" stroke="#82ca9d" />
                      <Line type="monotone" name="Savings" dataKey="savings" stroke="#ffc658" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-muted-foreground">No data available</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Shipments by Service Type</CardTitle>
              <CardDescription>Distribution across service levels</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-muted-foreground">Loading...</p>
                </div>
              ) : dashboardData.serviceTypeData.length > 0 ? (
                <>
                  <div className="mb-4">
                    <div className="flex flex-wrap gap-2">
                      {dashboardData.serviceTypeData.map((service, index) => (
                        <div key={service.name} className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                          <div 
                            className="w-4 h-4 rounded-full" 
                            style={{ backgroundColor: ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1'][index] }}
                          />
                          <span className="font-medium text-sm">{service.name}</span>
                          <span className="text-muted-foreground text-sm">({service.shipments})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dashboardData.serviceTypeData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip formatter={(value, name) => [
                          name === 'percentage' ? `${value}%` : value,
                          name === 'percentage' ? 'Percentage' : 'Shipment Count'
                        ]} />
                        <Bar name="Shipments" dataKey="shipments" fill="#8884d8" />
                        <Bar name="Percentage" dataKey="percentage" fill="#82ca9d" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-muted-foreground">No service data available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Recent Analyses</CardTitle>
              <CardDescription>Your most recent shipping analyses</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-muted-foreground">Loading...</p>
                </div>
              ) : dashboardData.recentAnalyses.length > 0 ? (
                <ul className="space-y-4">
                  {dashboardData.recentAnalyses.map((analysis, index) => (
                    <li key={analysis.id} className={`flex items-center justify-between ${index < dashboardData.recentAnalyses.length - 1 ? 'border-b pb-4' : ''}`}>
                      <div>
                        <p className="font-medium">{analysis.report_name || analysis.file_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {analysis.total_shipments || 0} shipments analyzed • {new Date(analysis.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        iconRight={<ArrowRight className="ml-1 h-4 w-4" />}
                        onClick={() => navigate(`/results/${analysis.id}`)}
                      >
                        View
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex flex-col items-center justify-center h-32 text-center">
                  <p className="text-muted-foreground mb-2">No analyses yet</p>
                  <Button variant="outline" size="sm" onClick={handleStartNewAnalysis}>
                    Start Your First Analysis
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Frequently used tools and features</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4">
                <Button
                  onClick={handleStartNewAnalysis}
                  variant="primary"
                  className="justify-start"
                  iconLeft={<Package className="mr-2 h-4 w-4" />}
                >
                  Upload New Shipping Data
                </Button>
                
                <Button
                  onClick={() => navigate('/reports')}
                  variant="outline"
                  className="justify-start"
                  iconLeft={<BarChart4 className="mr-2 h-4 w-4" />}
                >
                  View All Reports
                </Button>
                
                <Button
                  onClick={() => navigate('/settings')}
                  variant="outline"
                  className="justify-start"
                  iconLeft={<TruckIcon className="mr-2 h-4 w-4" />}
                >
                  Carrier Rate Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
