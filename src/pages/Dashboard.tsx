
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
    recentAnalyses: [],
    monthlyTrends: [],
    serviceTypes: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch shipping analyses for the user
      const { data: analyses, error } = await supabase
        .from('shipping_analyses')
        .select('*')
        .eq('user_id', user!.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error fetching analyses:', error);
        return;
      }

      // Process the data for dashboard metrics
      const totalShipments = analyses?.reduce((sum, analysis) => sum + (analysis.total_shipments || 0), 0) || 0;
      const totalSavings = analyses?.reduce((sum, analysis) => sum + (analysis.total_savings || 0), 0) || 0;
      
      // Calculate average cost from recent analyses
      const totalAnalysesWithData = analyses?.filter(a => Array.isArray(a.original_data) && a.original_data.length > 0) || [];
      const totalCost = totalAnalysesWithData.reduce((sum, analysis) => {
        const originalData = Array.isArray(analysis.original_data) ? analysis.original_data : [];
        return sum + originalData.reduce((costSum: number, shipment: any) => costSum + (shipment.currentCost || 0), 0);
      }, 0);
      const averageCost = totalShipments > 0 ? totalCost / totalShipments : 0;

      // Generate monthly trends from the last 6 analyses
      const monthlyTrends = analyses?.slice(0, 6).reverse().map((analysis, index) => {
        const date = new Date(analysis.created_at);
        const monthName = date.toLocaleDateString('en-US', { month: 'short' });
        const originalData = Array.isArray(analysis.original_data) ? analysis.original_data : [];
        const spend = originalData.reduce((sum: number, shipment: any) => sum + (shipment.currentCost || 0), 0);
        
        return {
          name: monthName,
          shipments: analysis.total_shipments || 0,
          spend: spend,
          savings: analysis.total_savings || 0
        };
      }) || [];

      // Generate service type data from the most recent analysis
      const recentAnalysis = analyses?.[0];
      let serviceTypes: any[] = [];
      if (recentAnalysis?.original_data && Array.isArray(recentAnalysis.original_data)) {
        const serviceCounts = new Map();
        recentAnalysis.original_data.forEach((shipment: any) => {
          const service = shipment.bestRate?.service || shipment.currentService || 'Unknown';
          serviceCounts.set(service, (serviceCounts.get(service) || 0) + 1);
        });
        
        const totalShipmentsInAnalysis = recentAnalysis.total_shipments || 1;
        serviceTypes = Array.from(serviceCounts.entries()).map(([name, shipments]) => ({
          name,
          shipments,
          percentage: Math.round((shipments / totalShipmentsInAnalysis) * 100)
        }));
      }

      setDashboardData({
        totalShipments,
        averageCost,
        totalSavings,
        recentAnalyses: analyses || [],
        monthlyTrends,
        serviceTypes
      });
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
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
            value={loading ? "..." : dashboardData.totalShipments.toString()}
            description="Across all analyses"
            trend="up"
            icon={<Package />}
            color="blue"
          />
          
          <SummaryStats
            title="Average Cost"
            value={loading ? "..." : `$${dashboardData.averageCost.toFixed(2)}`}
            description="Per shipment"
            trend={dashboardData.averageCost > 0 ? "up" : "down"}
            icon={<DollarSign />}
            color="green"
          />
          
          <SummaryStats
            title="Total Savings"
            value={loading ? "..." : `$${dashboardData.totalSavings.toFixed(0)}`}
            description="Potential with UPS rates"
            trend={dashboardData.totalSavings > 0 ? "up" : "down"}
            icon={<BarChart4 />}
            color={dashboardData.totalSavings > 0 ? "green" : "amber"}
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
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Shipments by Service Type</CardTitle>
              <CardDescription>Distribution across service levels</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="flex flex-wrap gap-2">
                  {dashboardData.serviceTypes.map((service, index) => (
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
                  <BarChart data={dashboardData.serviceTypes}>
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
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p>Loading recent analyses...</p>
                </div>
              ) : dashboardData.recentAnalyses.length > 0 ? (
                <ul className="space-y-4">
                  {dashboardData.recentAnalyses.slice(0, 3).map((analysis, index) => (
                    <li key={analysis.id} className="flex items-center justify-between border-b pb-4 last:border-b-0">
                      <div>
                        <p className="font-medium">{analysis.file_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {analysis.total_shipments} shipments analyzed • {new Date(analysis.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        iconRight={<ArrowRight className="ml-1 h-4 w-4" />}
                        onClick={() => navigate(`/reports/${analysis.id}`)}
                      >
                        View
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No analyses yet</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => navigate('/upload')}
                    className="mt-2"
                  >
                    Start your first analysis
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
