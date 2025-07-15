
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { SummaryStats } from '@/components/ui-lov/SummaryStats';
import { Button } from '@/components/ui-lov/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ArrowUpRight, Package, TruckIcon, DollarSign, BarChart4, ArrowRight } from 'lucide-react';

// Sample data for the charts
const monthlyTrendsData = [
  { name: 'Jan', shipments: 120, spend: 5400, savings: 620 },
  { name: 'Feb', shipments: 130, spend: 5800, savings: 680 },
  { name: 'Mar', shipments: 100, spend: 4500, savings: 520 },
  { name: 'Apr', shipments: 110, spend: 4900, savings: 580 },
  { name: 'May', shipments: 150, spend: 6700, savings: 780 },
  { name: 'Jun', shipments: 180, spend: 8000, savings: 920 },
];

const serviceTypeData = [
  { name: 'Ground', shipments: 380, percentage: 48 },
  { name: 'Express', shipments: 220, percentage: 28 },
  { name: 'Next Day', shipments: 100, percentage: 13 },
  { name: '2-Day', shipments: 80, percentage: 10 },
  { name: 'Intl', shipments: 10, percentage: 1 },
];

const Dashboard = () => {
  const navigate = useNavigate();
  
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
            value="790"
            description="Up 12% from last month"
            trend="up"
            icon={<Package />}
            color="blue"
          />
          
          <SummaryStats
            title="Average Cost"
            value="$24.35"
            description="Down 3.2% from last month"
            trend="down"
            icon={<DollarSign />}
            color="green"
          />
          
          <SummaryStats
            title="Potential Savings"
            value="$4,200"
            description="Based on current rates"
            trend="up"
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
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyTrendsData}>
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
                  {serviceTypeData.map((service, index) => (
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
                  <BarChart data={serviceTypeData}>
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
              <ul className="space-y-4">
                <li className="flex items-center justify-between border-b pb-4">
                  <div>
                    <p className="font-medium">June 2023 Analysis</p>
                    <p className="text-sm text-muted-foreground">180 shipments analyzed</p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    iconRight={<ArrowRight className="ml-1 h-4 w-4" />}
                    onClick={() => navigate('/reports/1')}
                  >
                    View
                  </Button>
                </li>
                <li className="flex items-center justify-between border-b pb-4">
                  <div>
                    <p className="font-medium">May 2023 Analysis</p>
                    <p className="text-sm text-muted-foreground">150 shipments analyzed</p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    iconRight={<ArrowRight className="ml-1 h-4 w-4" />}
                    onClick={() => navigate('/reports/2')}
                  >
                    View
                  </Button>
                </li>
                <li className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">April 2023 Analysis</p>
                    <p className="text-sm text-muted-foreground">110 shipments analyzed</p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    iconRight={<ArrowRight className="ml-1 h-4 w-4" />}
                    onClick={() => navigate('/reports/3')}
                  >
                    View
                  </Button>
                </li>
              </ul>
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
