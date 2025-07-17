import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency, formatPercentage } from '@/lib/utils';
import { TruckIcon, Package, Target, TrendingUp, BarChart3, CheckCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface ServiceTypeAssignment {
  serviceType: string;
  assignedCarrierId: string;
  assignedCarrierName: string;
  assignedAccountName: string;
  averageRate: number;
  estimatedSavings: number;
  affectedShipments: number;
}

interface CarrierPerformance {
  carrierId: string;
  carrierName: string;
  accountName: string;
  serviceTypes: string[];
  totalShipments: number;
  totalSavings: number;
  averageRate: number;
  competitiveWins: number;
}

interface ServiceTypeResultsViewProps {
  assignments: ServiceTypeAssignment[];
  analysisResults: any[];
  onExport?: () => void;
}

export function ServiceTypeResultsView({ 
  assignments, 
  analysisResults,
  onExport 
}: ServiceTypeResultsViewProps) {
  const [carrierPerformance, setCarrierPerformance] = useState<CarrierPerformance[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    calculateCarrierPerformance();
    prepareChartData();
  }, [assignments, analysisResults]);

  const calculateCarrierPerformance = () => {
    const carrierMap: Record<string, CarrierPerformance> = {};

    assignments.forEach(assignment => {
      const key = `${assignment.assignedCarrierId}-${assignment.assignedAccountName}`;
      
      if (!carrierMap[key]) {
        carrierMap[key] = {
          carrierId: assignment.assignedCarrierId,
          carrierName: assignment.assignedCarrierName,
          accountName: assignment.assignedAccountName,
          serviceTypes: [],
          totalShipments: 0,
          totalSavings: 0,
          averageRate: 0,
          competitiveWins: 0
        };
      }

      carrierMap[key].serviceTypes.push(assignment.serviceType);
      carrierMap[key].totalShipments += assignment.affectedShipments;
      carrierMap[key].totalSavings += assignment.estimatedSavings;
      carrierMap[key].competitiveWins += 1;
    });

    // Calculate average rates
    Object.values(carrierMap).forEach(carrier => {
      const relevantAssignments = assignments.filter(a => 
        a.assignedCarrierId === carrier.carrierId && 
        a.assignedAccountName === carrier.accountName
      );
      
      if (relevantAssignments.length > 0) {
        carrier.averageRate = relevantAssignments.reduce((sum, a) => 
          sum + (a.averageRate * a.affectedShipments), 0
        ) / carrier.totalShipments;
      }
    });

    const performance = Object.values(carrierMap).sort((a, b) => b.totalSavings - a.totalSavings);
    setCarrierPerformance(performance);
  };

  const prepareChartData = () => {
    const data = assignments.map(assignment => ({
      serviceType: assignment.serviceType,
      estimatedSavings: assignment.estimatedSavings,
      affectedShipments: assignment.affectedShipments,
      averageRate: assignment.averageRate,
      carrier: assignment.assignedAccountName
    })).sort((a, b) => b.estimatedSavings - a.estimatedSavings);

    setChartData(data);
  };

  const totalSavings = assignments.reduce((sum, a) => sum + a.estimatedSavings, 0);
  const totalShipments = assignments.reduce((sum, a) => sum + a.affectedShipments, 0);
  const uniqueCarriers = new Set(assignments.map(a => a.assignedAccountName)).size;

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#f97316', '#06b6d4'];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Target className="h-4 w-4 text-blue-600" />
              <div className="text-2xl font-bold">{assignments.length}</div>
            </div>
            <p className="text-xs text-muted-foreground">Service Types</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <div className="text-2xl font-bold">{formatCurrency(totalSavings)}</div>
            </div>
            <p className="text-xs text-muted-foreground">Total Est. Savings</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Package className="h-4 w-4 text-orange-600" />
              <div className="text-2xl font-bold">{totalShipments}</div>
            </div>
            <p className="text-xs text-muted-foreground">Total Shipments</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <TruckIcon className="h-4 w-4 text-purple-600" />
              <div className="text-2xl font-bold">{uniqueCarriers}</div>
            </div>
            <p className="text-xs text-muted-foreground">Carrier Accounts</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="assignments" className="w-full">
        <TabsList>
          <TabsTrigger value="assignments">Service Assignments</TabsTrigger>
          <TabsTrigger value="carriers">Carrier Performance</TabsTrigger>
          <TabsTrigger value="charts">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="assignments">
          <Card>
            <CardHeader>
              <CardTitle>Service Type Assignments</CardTitle>
              <p className="text-sm text-muted-foreground">
                Optimal carrier assignments by service type for operational efficiency
              </p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service Type</TableHead>
                    <TableHead>Assigned Account</TableHead>
                    <TableHead>Avg Rate</TableHead>
                    <TableHead>Shipments</TableHead>
                    <TableHead>Est. Savings</TableHead>
                    <TableHead>Impact</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.map((assignment) => (
                    <TableRow key={assignment.serviceType}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4" />
                          <span className="font-medium">{assignment.serviceType}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <TruckIcon className="h-4 w-4" />
                          <span>{assignment.assignedAccountName}</span>
                          <Badge variant="outline" className="text-xs">
                            {assignment.assignedCarrierName}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(assignment.averageRate)}
                      </TableCell>
                      <TableCell>{assignment.affectedShipments}</TableCell>
                      <TableCell className="font-medium text-green-600">
                        {formatCurrency(assignment.estimatedSavings)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="default" className="flex items-center gap-1 w-fit">
                          <CheckCircle className="h-3 w-3" />
                          Optimal
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="carriers">
          <Card>
            <CardHeader>
              <CardTitle>Carrier Account Performance</CardTitle>
              <p className="text-sm text-muted-foreground">
                Overall performance by carrier account across all assigned service types
              </p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Carrier Account</TableHead>
                    <TableHead>Service Types</TableHead>
                    <TableHead>Total Shipments</TableHead>
                    <TableHead>Avg Rate</TableHead>
                    <TableHead>Total Savings</TableHead>
                    <TableHead>Competitive Wins</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {carrierPerformance.map((carrier) => (
                    <TableRow key={`${carrier.carrierId}-${carrier.accountName}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <TruckIcon className="h-4 w-4" />
                          <div>
                            <div className="font-medium">{carrier.accountName}</div>
                            <div className="text-xs text-muted-foreground">{carrier.carrierName}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {carrier.serviceTypes.map((serviceType) => (
                            <Badge key={serviceType} variant="secondary" className="text-xs">
                              {serviceType}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>{carrier.totalShipments}</TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(carrier.averageRate)}
                      </TableCell>
                      <TableCell className="font-medium text-green-600">
                        {formatCurrency(carrier.totalSavings)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="default">{carrier.competitiveWins}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="charts">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Savings by Service Type
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="serviceType" 
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: any, name: string) => [
                        name === 'estimatedSavings' ? formatCurrency(value) : value,
                        name === 'estimatedSavings' ? 'Est. Savings' : name
                      ]}
                    />
                    <Bar dataKey="estimatedSavings" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Carrier Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={carrierPerformance}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ accountName, totalSavings }) => 
                        `${accountName}: ${formatCurrency(totalSavings)}`
                      }
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="totalSavings"
                    >
                      {carrierPerformance.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: any) => [formatCurrency(value), 'Total Savings']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}