
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { Button } from '@/components/ui-lov/Button';
import { SummaryStats } from '@/components/ui-lov/SummaryStats';
import { DataTable } from '@/components/ui-lov/DataTable';
import { BarChart, LineChart, ResponsiveContainer, XAxis, YAxis, Bar, Line, CartesianGrid, Tooltip, Legend, Cell } from 'recharts';
import { Share, Download, Upload } from 'lucide-react';
import { toast } from 'sonner';
import type { ColumnDef } from '@tanstack/react-table';

// Mock data for the sample shipments
const sampleShipments = [
  {
    id: 1,
    trackingId: 'UPS123456789',
    originZip: '90210',
    destinationZip: '10001',
    weight: 5.2,
    service: 'UPS Ground',
    currentRate: 24.50,
    newRate: 19.75,
    savings: 4.75,
    savingsPercent: 19.38
  },
  {
    id: 2,
    trackingId: 'FDX987654321',
    originZip: '60606',
    destinationZip: '20001',
    weight: 10.0,
    service: 'FedEx Express',
    currentRate: 45.30,
    newRate: 38.99,
    savings: 6.31,
    savingsPercent: 13.93
  },
  {
    id: 3,
    trackingId: 'UPS567891234',
    originZip: '75001',
    destinationZip: '33101',
    weight: 2.1,
    service: 'UPS 2nd Day Air',
    currentRate: 18.25,
    newRate: 15.50,
    savings: 2.75,
    savingsPercent: 15.07
  },
  {
    id: 4,
    trackingId: 'FDX654789123',
    originZip: '98101',
    destinationZip: '48226',
    weight: 8.7,
    service: 'FedEx Ground',
    currentRate: 32.15,
    newRate: 27.85,
    savings: 4.30,
    savingsPercent: 13.37
  },
  {
    id: 5,
    trackingId: 'UPS987123654',
    originZip: '30301',
    destinationZip: '02108',
    weight: 15.3,
    service: 'UPS Next Day Air',
    currentRate: 78.90,
    newRate: 68.45,
    savings: 10.45,
    savingsPercent: 13.24
  }
];

// Calculate summary statistics from the sample data
const totalCurrentCost = sampleShipments.reduce((acc, item) => acc + (item.currentRate as number), 0);
const totalNewCost = sampleShipments.reduce((acc, item) => acc + (item.newRate as number), 0);
const totalSavings = sampleShipments.reduce((acc, item) => acc + (item.savings as number), 0);
const savingsPercentage = (totalSavings / totalCurrentCost) * 100;

// Calculate service type stats for the chart
const serviceTypesRaw = sampleShipments.reduce((acc, item) => {
  const service = item.service as string;
  if (!acc[service]) {
    acc[service] = {
      service,
      count: 0,
      currentCost: 0,
      newCost: 0,
      savings: 0
    };
  }
  acc[service].count += 1;
  acc[service].currentCost += item.currentRate as number;
  acc[service].newCost += item.newRate as number;
  acc[service].savings += item.savings as number;
  return acc;
}, {} as Record<string, { service: string, count: number, currentCost: number, newCost: number, savings: number }>);

const serviceStats = Object.values(serviceTypesRaw);

// Column definitions for the data table
const columns: ColumnDef<typeof sampleShipments[0]>[] = [
  {
    header: 'Tracking ID',
    accessorKey: 'trackingId',
  },
  {
    header: 'Service',
    accessorKey: 'service',
  },
  {
    header: 'Weight (lbs)',
    accessorKey: 'weight',
    cell: ({ row }) => <div className="text-right">{(row.getValue('weight') as number).toFixed(1)}</div>,
  },
  {
    header: 'Current Rate ($)',
    accessorKey: 'currentRate',
    cell: ({ row }) => <div className="text-right">{(row.getValue('currentRate') as number).toFixed(2)}</div>,
  },
  {
    header: 'New Rate ($)',
    accessorKey: 'newRate',
    cell: ({ row }) => <div className="text-right">{(row.getValue('newRate') as number).toFixed(2)}</div>,
  },
  {
    header: 'Savings ($)',
    accessorKey: 'savings',
    cell: ({ row }) => (
      <div className="text-right font-medium text-green-600">
        ${(row.getValue('savings') as number).toFixed(2)}
      </div>
    ),
  },
  {
    header: 'Savings (%)',
    accessorKey: 'savingsPercent',
    cell: ({ row }) => (
      <div className="text-right font-medium">
        {(row.getValue('savingsPercent') as number).toFixed(2)}%
      </div>
    ),
  },
];

// Chart colors
const CHART_COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444'];

const Results = () => {
  const navigate = useNavigate();
  
  const handleShareResults = () => {
    toast.success("Results link copied to clipboard!");
  };
  
  const handleExportResults = () => {
    toast.success("Results exported successfully!");
  };
  
  const handleStartNewAnalysis = () => {
    navigate('/upload');
  };
  
  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-1">Analysis Results</h1>
            <p className="text-muted-foreground">Review your shipping cost optimization analysis</p>
          </div>
          <div className="flex items-center gap-2 mt-4 md:mt-0">
            <Button 
              variant="outline" 
              iconLeft={<Share className="h-4 w-4" />}
              onClick={handleShareResults}
            >
              Share
            </Button>
            <Button 
              variant="outline" 
              iconLeft={<Download className="h-4 w-4" />}
              onClick={handleExportResults}
            >
              Export
            </Button>
            <Button 
              variant="primary" 
              iconLeft={<Upload className="h-4 w-4" />}
              onClick={handleStartNewAnalysis}
            >
              New Analysis
            </Button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <SummaryStats 
            title="Current Cost"
            value={`$${totalCurrentCost.toFixed(2)}`}
            icon={<span className="text-lg">💰</span>}
            color="blue"
          />
          <SummaryStats 
            title="Optimized Cost"
            value={`$${totalNewCost.toFixed(2)}`}
            icon={<span className="text-lg">📉</span>}
            color="indigo"
          />
          <SummaryStats 
            title="Total Savings"
            value={`$${totalSavings.toFixed(2)}`}
            description={`${savingsPercentage.toFixed(2)}% reduction`}
            icon={<span className="text-lg">💵</span>}
            trend="down"
            color="green"
          />
          <SummaryStats 
            title="Shipments Analyzed"
            value={sampleShipments.length.toString()}
            description="100% processed"
            icon={<span className="text-lg">📦</span>}
            color="amber"
          />
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle>Savings by Service Type</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={serviceStats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="service" />
                  <YAxis />
                  <Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`} />
                  <Legend />
                  <Bar dataKey="savings" fill="#10b981" name="Savings ($)">
                    {serviceStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Cost Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={serviceStats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="service" />
                  <YAxis />
                  <Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`} />
                  <Legend />
                  <Bar dataKey="currentCost" fill="#3b82f6" name="Current Cost ($)" />
                  <Bar dataKey="newCost" fill="#10b981" name="New Cost ($)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Detailed Shipment Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable 
              columns={columns} 
              data={sampleShipments} 
              searchable={true}
              pagination={true}
              exportData={true}
            />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Results;
