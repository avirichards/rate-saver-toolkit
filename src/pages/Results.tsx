
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { SummaryStats } from '@/components/ui-lov/SummaryStats';
import { DataTable } from '@/components/ui-lov/DataTable';
import { Button } from '@/components/ui-lov/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { BarChart, LineChart, ResponsiveContainer, XAxis, YAxis, Bar, Line, CartesianGrid, Tooltip, Legend, Cell } from 'recharts';
import { Share, Download, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { type ColumnDef } from '@tanstack/react-table';

// Mock data for the sample shipments
const sampleShipments = [
  { id: '1', trackingId: '1Z999AA10123456784', weight: 5.2, service: 'Ground', currentCost: 12.50, newCost: 10.15, savings: 2.35, savingsPct: 18.8 },
  { id: '2', trackingId: '1Z999AA10123456785', weight: 10.7, service: 'Express', currentCost: 25.75, newCost: 22.30, savings: 3.45, savingsPct: 13.4 },
  { id: '3', trackingId: '1Z999AA10123456786', weight: 2.3, service: 'Ground', currentCost: 8.99, newCost: 7.24, savings: 1.75, savingsPct: 19.5 },
  { id: '4', trackingId: '1Z999AA10123456787', weight: 15.5, service: 'Express', currentCost: 32.50, newCost: 28.75, savings: 3.75, savingsPct: 11.5 },
  { id: '5', trackingId: '1Z999AA10123456788', weight: 7.1, service: 'Ground', currentCost: 15.25, newCost: 12.80, savings: 2.45, savingsPct: 16.1 },
  { id: '6', trackingId: '1Z999AA10123456789', weight: 3.6, service: 'Ground', currentCost: 10.99, newCost: 8.75, savings: 2.24, savingsPct: 20.4 },
  { id: '7', trackingId: '1Z999AA10123456790', weight: 12.8, service: 'Express', currentCost: 28.99, newCost: 25.10, savings: 3.89, savingsPct: 13.4 },
  { id: '8', trackingId: '1Z999AA10123456791', weight: 4.2, service: 'Ground', currentCost: 11.50, newCost: 9.25, savings: 2.25, savingsPct: 19.6 },
  { id: '9', trackingId: '1Z999AA10123456792', weight: 9.3, service: 'Express', currentCost: 22.75, newCost: 19.90, savings: 2.85, savingsPct: 12.5 },
  { id: '10', trackingId: '1Z999AA10123456793', weight: 6.5, service: 'Ground', currentCost: 14.25, newCost: 11.90, savings: 2.35, savingsPct: 16.5 },
];

// Mock data for service breakdown
const serviceData = [
  { name: 'Ground', currentCost: 73.48, newCost: 59.09, savings: 14.39, shipments: 6 },
  { name: 'Express', currentCost: 109.99, newCost: 96.05, savings: 13.94, shipments: 4 },
];

// Mock data for weight vs. savings chart
const weightSavingsData = [
  { weight: '0-5', avgSavingsPct: 19.8 },
  { weight: '5-10', avgSavingsPct: 15.0 },
  { weight: '10-15', avgSavingsPct: 13.4 },
  { weight: '15+', avgSavingsPct: 11.5 },
];

// Table column definitions
const columns: ColumnDef<typeof sampleShipments[0]>[] = [
  {
    accessorKey: 'trackingId',
    header: 'Tracking ID',
  },
  {
    accessorKey: 'weight',
    header: 'Weight (lbs)',
    cell: ({ row }) => <div>{row.getValue('weight')} lbs</div>,
  },
  {
    accessorKey: 'service',
    header: 'Service',
  },
  {
    accessorKey: 'currentCost',
    header: 'Current Cost',
    cell: ({ row }) => <div>${row.getValue('currentCost').toFixed(2)}</div>,
  },
  {
    accessorKey: 'newCost',
    header: 'Optimized Cost',
    cell: ({ row }) => <div>${row.getValue('newCost').toFixed(2)}</div>,
  },
  {
    accessorKey: 'savings',
    header: 'Savings',
    cell: ({ row }) => (
      <div className="text-app-green-600 font-medium">
        ${row.getValue('savings').toFixed(2)}
      </div>
    ),
  },
  {
    accessorKey: 'savingsPct',
    header: 'Savings %',
    cell: ({ row }) => (
      <div className="text-app-green-600 font-medium">
        {row.getValue('savingsPct').toFixed(1)}%
      </div>
    ),
  },
];

const Results = () => {
  const navigate = useNavigate();
  
  // Calculate totals from sample data
  const totalCurrentCost = sampleShipments.reduce((sum, item) => sum + item.currentCost, 0);
  const totalNewCost = sampleShipments.reduce((sum, item) => sum + item.newCost, 0);
  const totalSavings = sampleShipments.reduce((sum, item) => sum + item.savings, 0);
  const savingsPercentage = (totalSavings / totalCurrentCost) * 100;
  
  const handleShare = () => {
    toast.success('Link copied to clipboard!');
  };
  
  const handleNewAnalysis = () => {
    navigate('/upload');
  };
  
  return (
    <AppLayout showProgress={true} backButtonUrl="/analysis">
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-semibold mb-2">Analysis Results</h1>
            <p className="text-muted-foreground">
              Review your potential shipping cost savings and optimization recommendations.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button 
              variant="outline" 
              iconLeft={<Share className="h-4 w-4" />}
              onClick={handleShare}
            >
              Share Report
            </Button>
            <Button 
              variant="outline" 
              iconLeft={<Download className="h-4 w-4" />}
              onClick={() => toast.success('Report downloaded!')}
            >
              Download PDF
            </Button>
            <Button 
              variant="primary"
              iconLeft={<Upload className="h-4 w-4" />}
              onClick={handleNewAnalysis}
            >
              New Analysis
            </Button>
          </div>
        </div>
        
        <SummaryStats 
          currentCost={totalCurrentCost}
          potentialCost={totalNewCost}
          savings={totalSavings}
          savingsPercentage={savingsPercentage}
          shipmentCount={sampleShipments.length}
        />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Savings by Service Type</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={serviceData} barSize={40}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value: number) => [`$${value.toFixed(2)}`, 'Amount']}
                    labelFormatter={(value) => `Service: ${value}`}
                  />
                  <Legend />
                  <Bar name="Current Cost" dataKey="currentCost" fill="#94a3b8" />
                  <Bar name="Optimized Cost" dataKey="newCost" fill="#0e8de9" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Weight vs. Savings %</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={weightSavingsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="weight" label={{ value: 'Weight Range (lbs)', position: 'insideBottom', offset: -5 }} />
                  <YAxis label={{ value: 'Avg. Savings %', angle: -90, position: 'insideLeft' }} />
                  <Tooltip 
                    formatter={(value: number) => [`${value.toFixed(1)}%`, 'Avg. Savings']}
                    labelFormatter={(value) => `Weight: ${value} lbs`}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="avgSavingsPct" 
                    stroke="#29ca8f" 
                    strokeWidth={2}
                    dot={{ r: 5 }}
                    activeDot={{ r: 8 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
        
        <DataTable 
          columns={columns} 
          data={sampleShipments}
          title="Shipment Details"
          pagination={true}
          exportData={true}
        />
        
        <Card>
          <CardHeader>
            <CardTitle>Optimization Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              <li className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-app-green-100 text-app-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                  1
                </div>
                <div>
                  <p className="font-medium">Negotiate Better Ground Rates</p>
                  <p className="text-sm text-muted-foreground">
                    Ground shipments show the highest percentage savings potential (average 18.2%). Consider negotiating a volume-based discount with your carrier.
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-app-green-100 text-app-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                  2
                </div>
                <div>
                  <p className="font-medium">Optimize Packaging for Lighter Shipments</p>
                  <p className="text-sm text-muted-foreground">
                    Smaller, lighter packages (under 5 lbs) show the highest savings potential. Review packaging materials to reduce weight where possible.
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-app-green-100 text-app-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                  3
                </div>
                <div>
                  <p className="font-medium">Consider Service Downgrades for Non-Urgent Shipments</p>
                  <p className="text-sm text-muted-foreground">
                    Express services have higher base costs. Evaluate which shipments truly require expedited delivery and downgrade when possible.
                  </p>
                </div>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Results;
