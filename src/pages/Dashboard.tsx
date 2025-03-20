
import React from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { SummaryStats } from '@/components/ui-lov/SummaryStats';
import { Button } from '@/components/ui-lov/Button';
import { BarChart, LineChart, ResponsiveContainer, XAxis, YAxis, Bar, Line, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Plus, ArrowRight, TrendingUp, Package, DollarSign, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';

// Sample data for the dashboard
const recentAnalyses = [
  { id: 1, name: 'Q1 Shipping Analysis', date: '2023-04-01', savings: 1250.45, items: 450 },
  { id: 2, name: 'West Coast Distribution', date: '2023-03-15', savings: 876.20, items: 320 },
  { id: 3, name: 'East Region Audit', date: '2023-02-28', savings: 1543.75, items: 520 },
];

const monthlyData = [
  { name: 'Jan', shipped: 120, cost: 3200 },
  { name: 'Feb', shipped: 150, cost: 4100 },
  { name: 'Mar', shipped: 180, cost: 4800 },
  { name: 'Apr', shipped: 170, cost: 4600 },
  { name: 'May', shipped: 200, cost: 5200 },
  { name: 'Jun', shipped: 250, cost: 6100 },
];

const carrierData = [
  { name: 'UPS', shipments: 420, percentage: 42 },
  { name: 'FedEx', shipments: 380, percentage: 38 },
  { name: 'USPS', shipments: 150, percentage: 15 },
  { name: 'DHL', shipments: 50, percentage: 5 },
];

const Dashboard = () => {
  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-1">Dashboard</h1>
            <p className="text-muted-foreground">Overview of your shipping activities and savings</p>
          </div>
          <div className="mt-4 md:mt-0">
            <Link to="/upload">
              <Button 
                variant="primary" 
                iconLeft={<Plus className="h-4 w-4" />}
              >
                New Analysis
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <SummaryStats 
            title="Total Packages"
            value="1,250"
            description="+12% from last month"
            trend="up"
            icon={<Package className="h-8 w-8" />}
            color="blue"
          />
          <SummaryStats 
            title="Total Costs"
            value="$32,450"
            description="+5% from last month"
            trend="up"
            icon={<DollarSign className="h-8 w-8" />}
            color="green"
          />
          <SummaryStats 
            title="Potential Savings"
            value="$5,240"
            description="+18% optimization"
            trend="up"
            icon={<TrendingUp className="h-8 w-8" />}
            color="indigo"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Shipping Volume</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="shipped" fill="#3b82f6" name="Packages" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Shipping Costs Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="cost" stroke="#10b981" name="Cost ($)" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Recent Analyses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2">Analysis Name</th>
                      <th className="text-left py-3 px-2">Date</th>
                      <th className="text-right py-3 px-2">Items</th>
                      <th className="text-right py-3 px-2">Savings</th>
                      <th className="text-right py-3 px-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentAnalyses.map((analysis) => (
                      <tr key={analysis.id} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-2 font-medium">{analysis.name}</td>
                        <td className="py-3 px-2">{new Date(analysis.date).toLocaleDateString()}</td>
                        <td className="py-3 px-2 text-right">{analysis.items}</td>
                        <td className="py-3 px-2 text-right font-medium">${analysis.savings.toFixed(2)}</td>
                        <td className="py-3 px-2 text-right">
                          <Link to={`/reports/${analysis.id}`}>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              iconRight={<ArrowRight className="h-3 w-3" />}
                            >
                              View
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Carrier Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={carrierData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="shipments" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
