import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui-lov/Card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Download, DollarSign, Package, TruckIcon, AlertCircle, Filter, CheckCircle2, XCircle, Calendar, Zap, Target, TrendingUp, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui-lov/Button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn, formatCurrency, formatPercentage, getSavingsColor } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  processNormalViewData, 
  formatShipmentData, 
  generateExportData,
  ProcessedShipmentData 
} from '@/utils/dataProcessing';

interface ResultsSectionProps {
  analysisResults: any;
  reportId?: string;
}

export const ResultsSection: React.FC<ResultsSectionProps> = ({
  analysisResults,
  reportId
}) => {
  const [shipmentData, setShipmentData] = useState<ProcessedShipmentData[]>([]);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [resultFilter, setResultFilter] = useState<'all' | 'wins' | 'losses'>('all');
  const [sortConfig, setSortConfig] = useState<{key: string, direction: 'asc' | 'desc'} | null>(null);
  const [availableServices, setAvailableServices] = useState<string[]>([]);
  const [selectedService, setSelectedService] = useState<string>('all');

  useEffect(() => {
    if (analysisResults) {
      // Process the analysis results
      const recommendations = analysisResults.recommendations || analysisResults;
      
      let processedShipmentData: ProcessedShipmentData[] = [];
      
      if (Array.isArray(recommendations)) {
        processedShipmentData = formatShipmentData(recommendations);
      } else {
        const processedData = processNormalViewData(recommendations);
        processedShipmentData = formatShipmentData(processedData.recommendations || []);
      }
      
      setShipmentData(processedShipmentData);
      
      // Initialize service data
      const services = [...new Set(processedShipmentData.map(item => item.service).filter(Boolean))] as string[];
      setAvailableServices(services);
    }
  }, [analysisResults]);

  useEffect(() => {
    // Apply filters
    let filtered = [...shipmentData];

    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(item => 
        item.trackingId?.toLowerCase().includes(searchLower) ||
        item.service?.toLowerCase().includes(searchLower) ||
        item.originZip?.includes(searchTerm) ||
        item.destinationZip?.includes(searchTerm)
      );
    }

    // Result filter
    if (resultFilter === 'wins') {
      filtered = filtered.filter(item => (item.savings || 0) > 0);
    } else if (resultFilter === 'losses') {
      filtered = filtered.filter(item => (item.savings || 0) <= 0);
    }

    // Service filter
    if (selectedService !== 'all') {
      filtered = filtered.filter(item => item.service === selectedService);
    }

    // Sort
    if (sortConfig) {
      filtered.sort((a, b) => {
        const aValue = (a as any)[sortConfig.key];
        const bValue = (b as any)[sortConfig.key];
        
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    setFilteredData(filtered);
  }, [shipmentData, searchTerm, resultFilter, selectedService, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev?.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const exportToCSV = () => {
    const csvData = generateExportData(filteredData, () => ({ markedUpPrice: 0, margin: 0, marginPercent: 0 }));
    const csvContent = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `shipping_analysis_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Calculate summary stats
  const totalSavings = filteredData.reduce((sum, item) => sum + (item.savings || 0), 0);
  const totalShipments = filteredData.length;
  const winningShipments = filteredData.filter(item => (item.savings || 0) > 0).length;
  const averageSavings = totalShipments > 0 ? totalSavings / totalShipments : 0;

  // Prepare chart data
  const serviceData = availableServices.map(service => {
    const serviceShipments = filteredData.filter(item => item.service === service);
    const serviceSavings = serviceShipments.reduce((sum, item) => sum + (item.savings || 0), 0);
    return {
      service,
      savings: serviceSavings,
      count: serviceShipments.length
    };
  });

  const savingsDistribution = [
    { name: 'Wins', value: winningShipments, color: '#10b981' },
    { name: 'Losses/Break-even', value: totalShipments - winningShipments, color: '#ef4444' }
  ];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Savings</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(totalSavings)}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Shipments</p>
                <p className="text-2xl font-bold">{totalShipments}</p>
              </div>
              <Package className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Win Rate</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatPercentage(totalShipments > 0 ? (winningShipments / totalShipments) * 100 : 0)}
                </p>
              </div>
              <Target className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Savings</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(averageSavings)}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Savings by Service</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={serviceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="service" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(value as number)} />
                <Bar dataKey="savings" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Win/Loss Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={savingsDistribution}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {savingsDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Shipment Details</span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={exportToCSV}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <Input
              placeholder="Search tracking, service, or ZIP..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-xs"
            />
            
            <Select value={resultFilter} onValueChange={(value: 'all' | 'wins' | 'losses') => setResultFilter(value)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Results</SelectItem>
                <SelectItem value="wins">Wins Only</SelectItem>
                <SelectItem value="losses">Losses Only</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedService} onValueChange={setSelectedService}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Services</SelectItem>
                {availableServices.map(service => (
                  <SelectItem key={service} value={service}>{service}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Results Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted"
                    onClick={() => handleSort('trackingId')}
                  >
                    Tracking ID
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted"
                    onClick={() => handleSort('service')}
                  >
                    Service
                  </TableHead>
                  <TableHead>Origin → Destination</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted text-right"
                    onClick={() => handleSort('weight')}
                  >
                    Weight
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted text-right"
                    onClick={() => handleSort('currentCost')}
                  >
                    Current Cost
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted text-right"
                    onClick={() => handleSort('newRate')}
                  >
                    UPS Rate
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted text-right"
                    onClick={() => handleSort('savings')}
                  >
                    Savings
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((shipment) => (
                  <TableRow key={shipment.id}>
                    <TableCell className="font-mono text-sm">
                      {shipment.trackingId}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{shipment.service}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {shipment.originZip} → {shipment.destinationZip}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {shipment.weight} lbs
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(shipment.currentCost || 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(shipment.newRate || 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={cn(
                        "font-semibold",
                        getSavingsColor(shipment.savings || 0)
                      )}>
                        {shipment.savings && shipment.savings > 0 ? '+' : ''}
                        {formatCurrency(shipment.savings || 0)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredData.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No shipments match your current filters.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};