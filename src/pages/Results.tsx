
import React, { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { SummaryStats } from '@/components/ui-lov/SummaryStats';
import { DataTable } from '@/components/ui-lov/DataTable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Download, DollarSign, Package, TruckIcon, ArrowDownRight } from 'lucide-react';
import { Button } from '@/components/ui-lov/Button';

// Sample data for the Shipment Analysis
const shipmentData = [
  { id: 1, trackingId: '1Z999AA10123456784', originZip: '90210', destinationZip: '10001', weight: 5.25, service: 'UPS Ground', currentRate: 24.50, newRate: 22.35, savings: 2.15, savingsPercent: 8.8 },
  { id: 2, trackingId: '7901234567891', originZip: '60606', destinationZip: '20001', weight: 10.0, service: 'FedEx Express', currentRate: 45.30, newRate: 40.77, savings: 4.53, savingsPercent: 10.0 },
  { id: 3, trackingId: '1Z999AA10123456785', originZip: '33101', destinationZip: '98101', weight: 2.0, service: 'UPS Next Day Air', currentRate: 65.40, newRate: 58.86, savings: 6.54, savingsPercent: 10.0 },
  { id: 4, trackingId: '7901234567892', originZip: '77002', destinationZip: '94105', weight: 15.5, service: 'FedEx Ground', currentRate: 38.75, newRate: 34.10, savings: 4.65, savingsPercent: 12.0 },
  { id: 5, trackingId: '1Z999AA10123456786', originZip: '02108', destinationZip: '90001', weight: 8.75, service: 'UPS 3 Day Select', currentRate: 35.20, newRate: 33.44, savings: 1.76, savingsPercent: 5.0 },
  { id: 6, trackingId: '7901234567893', originZip: '80202', destinationZip: '48226', weight: 12.25, service: 'FedEx 2Day', currentRate: 52.60, newRate: 47.34, savings: 5.26, savingsPercent: 10.0 },
  { id: 7, trackingId: '1Z999AA10123456787', originZip: '20001', destinationZip: '60606', weight: 6.0, service: 'UPS Ground', currentRate: 28.90, newRate: 26.01, savings: 2.89, savingsPercent: 10.0 },
  { id: 8, trackingId: '7901234567894', originZip: '85001', destinationZip: '32801', weight: 3.5, service: 'FedEx Priority Overnight', currentRate: 78.25, newRate: 70.43, savings: 7.82, savingsPercent: 10.0 },
];

// Chart data
const serviceChartData = [
  { name: 'UPS Ground', value: 2 },
  { name: 'FedEx Express', value: 1 },
  { name: 'UPS Next Day Air', value: 1 },
  { name: 'FedEx Ground', value: 1 },
  { name: 'UPS 3 Day Select', value: 1 },
  { name: 'FedEx 2Day', value: 1 },
  { name: 'FedEx Priority Overnight', value: 1 },
];

const weightRangeData = [
  { name: '0-5 lbs', shipments: 2, avgSavings: 4.35 },
  { name: '5-10 lbs', shipments: 3, avgSavings: 2.27 },
  { name: '10-15 lbs', shipments: 2, avgSavings: 4.90 },
  { name: '15+ lbs', shipments: 1, avgSavings: 4.65 },
];

const zoneChartData = [
  { name: 'Zone 2', shipments: 1, avgSavings: 2.15 },
  { name: 'Zone 3', shipments: 2, avgSavings: 3.33 },
  { name: 'Zone 4', shipments: 2, avgSavings: 4.96 },
  { name: 'Zone 5', shipments: 1, avgSavings: 5.26 },
  { name: 'Zone 8', shipments: 2, avgSavings: 7.18 },
];

// Define the columns for the DataTable
const columns = [
  { accessorKey: 'trackingId', header: 'Tracking ID' },
  { accessorKey: 'originZip', header: 'Origin' },
  { accessorKey: 'destinationZip', header: 'Destination' },
  { accessorKey: 'weight', header: 'Weight (lbs)' },
  { accessorKey: 'service', header: 'Service' },
  { 
    accessorKey: 'currentRate', 
    header: 'Current Rate',
    cell: ({ cell }) => `$${cell.getValue().toFixed(2)}` 
  },
  { 
    accessorKey: 'newRate', 
    header: 'New Rate',
    cell: ({ cell }) => `$${cell.getValue().toFixed(2)}` 
  },
  { 
    accessorKey: 'savings', 
    header: 'Savings',
    cell: ({ cell }) => `$${cell.getValue().toFixed(2)}` 
  },
  { 
    accessorKey: 'savingsPercent', 
    header: 'Savings %',
    cell: ({ cell }) => `${cell.getValue()}%` 
  },
];

// Colors for the pie chart
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FCCDE5'];

const Results = () => {
  const [activeTab, setActiveTab] = useState('overview');
  
  // Calculate the total current cost and total savings
  const totalCurrentCost = shipmentData.reduce((sum, item) => sum + item.currentRate, 0);
  const totalSavings = shipmentData.reduce((sum, item) => sum + item.savings, 0);
  const savingsPercentage = (totalSavings / totalCurrentCost) * 100;
  
  // Calculate the total number of shipments
  const totalShipments = shipmentData.length;
  
  // Helper function to safely format numbers
  const safeToFixed = (value: any, decimals: number = 2): string => {
    if (typeof value === 'number') {
      return value.toFixed(decimals);
    }
    return String(value);
  };
  
  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-semibold">Analysis Results</h1>
              <p className="text-muted-foreground mt-2">
                Review your potential savings and optimization opportunities
              </p>
            </div>
            <Button 
              variant="outline" 
              iconLeft={<Download className="w-4 h-4 mr-2" />}
            >
              Export Report
            </Button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <SummaryStats
            title="Total Savings"
            value={`$${safeToFixed(totalSavings)}`}
            icon={<DollarSign />}
            color="green"
          />
          
          <SummaryStats
            title="Current Spend"
            value={`$${safeToFixed(totalCurrentCost)}`}
            icon={<DollarSign />}
            color="blue"
          />
          
          <SummaryStats
            title="Average Savings"
            value={`${safeToFixed(savingsPercentage, 1)}%`}
            description="Of current shipping costs"
            trend="down"
            icon={<ArrowDownRight />}
            color="amber"
          />
          
          <SummaryStats
            title="Total Shipments"
            value={totalShipments.toString()}
            description="Analyzed in this report"
            icon={<Package />}
            color="purple"
          />
        </div>
        
        <Tabs defaultValue="overview" className="mb-8" onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="by-service">By Service</TabsTrigger>
            <TabsTrigger value="by-weight">By Weight</TabsTrigger>
            <TabsTrigger value="by-zone">By Zone</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Service Distribution</CardTitle>
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
                        <Tooltip formatter={(value) => [`${value} shipments`, 'Count']} />
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
                        <Tooltip formatter={(value, name) => [
                          name === 'avgSavings' ? `$${safeToFixed(value)}` : `${value} shipments`,
                          name === 'avgSavings' ? 'Avg. Savings' : 'Shipments'
                        ]} />
                        <Bar name="Shipments" dataKey="shipments" fill="#8884d8" />
                        <Bar name="Avg. Savings" dataKey="avgSavings" fill="#82ca9d" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="by-service">
            {/* Service-specific content */}
            <Card>
              <CardHeader>
                <CardTitle>Savings by Service Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={shipmentData.reduce((acc, cur) => {
                      const serviceEntry = acc.find(item => item.name === cur.service);
                      if (serviceEntry) {
                        serviceEntry.shipments += 1;
                        serviceEntry.savings += cur.savings;
                      } else {
                        acc.push({
                          name: cur.service,
                          shipments: 1,
                          savings: cur.savings,
                          avgSavings: cur.savings
                        });
                      }
                      return acc;
                    }, [] as any[]).map(item => ({
                      ...item,
                      avgSavings: item.savings / item.shipments
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar name="Average Savings" dataKey="avgSavings" fill="#82ca9d" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="by-weight">
            {/* Weight-specific content */}
            <Card>
              <CardHeader>
                <CardTitle>Savings by Weight Range</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weightRangeData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar name="Shipments" dataKey="shipments" fill="#8884d8" />
                      <Bar name="Avg. Savings" dataKey="avgSavings" fill="#82ca9d" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="by-zone">
            {/* Zone-specific content */}
            <Card>
              <CardHeader>
                <CardTitle>Savings by Zone</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={zoneChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar name="Shipments" dataKey="shipments" fill="#8884d8" />
                      <Bar name="Avg. Savings" dataKey="avgSavings" fill="#82ca9d" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        
        <DataTable 
          columns={columns} 
          data={shipmentData} 
          title="Shipment Details"
          searchable={true}
          pagination={true}
          exportData={true}
          className="mb-8"
        />
      </div>
    </DashboardLayout>
  );
};

export default Results;
