import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { Button } from '@/components/ui-lov/Button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/lib/utils';
import { Download, Filter, Search, TrendingUp, TrendingDown, DollarSign, Package, Weight, MapPin } from 'lucide-react';

interface RateDetails {
  shipmentId: number;
  trackingId?: string;
  service: string;
  originZip: string;
  destZip: string;
  weight: number;
  currentCost?: number;
  rates: Array<{
    carrierId: string;
    carrierName: string;
    accountName: string;
    rate: number;
    serviceCode: string;
    serviceName: string;
    transitTime?: string;
    currency: string;
    hasNegotiatedRates?: boolean;
    rateType?: string;
    isBestRate?: boolean;
  }>;
}

interface DetailedRateTableProps {
  analysisResults: any[];
  onCarrierReassign?: (shipmentId: number, serviceType: string, newCarrierId: string) => void;
  allowReassignment?: boolean;
}

export function DetailedRateTable({ 
  analysisResults, 
  onCarrierReassign,
  allowReassignment = true 
}: DetailedRateTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [serviceFilter, setServiceFilter] = useState<string>('all');
  const [carrierFilter, setCarrierFilter] = useState<string>('all');
  const [weightFilter, setWeightFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'savings' | 'weight' | 'rate' | 'service'>('savings');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Process analysis results into detailed rate data
  const rateData: RateDetails[] = useMemo(() => {
    return analysisResults
      .filter(result => result.status === 'completed' && result.carrierResults)
      .map(result => {
        const rates: any[] = [];
        
        // Extract all rates from all carriers
        result.carrierResults?.forEach((carrierResult: any) => {
          if (carrierResult.success && carrierResult.rates) {
            carrierResult.rates.forEach((rate: any) => {
              rates.push({
                carrierId: carrierResult.carrierId,
                carrierName: rate.carrier || 'UPS',
                accountName: carrierResult.name || carrierResult.carrierName,
                rate: rate.totalCharges || rate.rate || 0,
                serviceCode: rate.serviceCode,
                serviceName: rate.serviceName || rate.service || result.originalService,
                transitTime: rate.transitTime || rate.deliveryTime,
                currency: rate.currency || 'USD',
                hasNegotiatedRates: rate.hasNegotiatedRates || rate.rateType === 'negotiated',
                rateType: rate.rateType || 'published',
                isBestRate: false
              });
            });
          }
        });

        // Mark best rate
        if (rates.length > 0) {
          const bestRate = rates.reduce((min, rate) => 
            rate.rate < min.rate ? rate : min
          );
          bestRate.isBestRate = true;
        }

        return {
          shipmentId: result.shipment.id,
          trackingId: result.shipment.trackingId,
          service: result.originalService || result.shipment.service,
          originZip: result.shipment.originZip,
          destZip: result.shipment.destZip,
          weight: parseFloat(result.shipment.weight) || 0,
          currentCost: result.currentCost,
          rates
        };
      });
  }, [analysisResults]);

  // Get filter options
  const serviceTypes = useMemo(() => 
    [...new Set(rateData.map(r => r.service))].filter(Boolean)
  , [rateData]);

  const carrierAccounts = useMemo(() => 
    [...new Set(rateData.flatMap(r => r.rates.map(rate => rate.accountName)))].filter(Boolean)
  , [rateData]);

  // Apply filters and sorting
  const filteredData = useMemo(() => {
    let filtered = rateData.filter(row => {
      const matchesSearch = !searchTerm || 
        row.trackingId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.originZip.includes(searchTerm) ||
        row.destZip.includes(searchTerm);
      
      const matchesService = serviceFilter === 'all' || row.service === serviceFilter;
      const matchesCarrier = carrierFilter === 'all' || 
        row.rates.some(rate => rate.accountName === carrierFilter);
      
      const matchesWeight = weightFilter === 'all' || 
        (weightFilter === 'light' && row.weight <= 5) ||
        (weightFilter === 'medium' && row.weight > 5 && row.weight <= 20) ||
        (weightFilter === 'heavy' && row.weight > 20);

      return matchesSearch && matchesService && matchesCarrier && matchesWeight;
    });

    // Sort data
    filtered.sort((a, b) => {
      let aValue: number | string = 0;
      let bValue: number | string = 0;

      switch (sortBy) {
        case 'savings':
          const aBestRate = a.rates.find(r => r.isBestRate)?.rate || 0;
          const bBestRate = b.rates.find(r => r.isBestRate)?.rate || 0;
          aValue = (a.currentCost || 0) - aBestRate;
          bValue = (b.currentCost || 0) - bBestRate;
          break;
        case 'weight':
          aValue = a.weight;
          bValue = b.weight;
          break;
        case 'rate':
          aValue = a.rates.find(r => r.isBestRate)?.rate || 0;
          bValue = b.rates.find(r => r.isBestRate)?.rate || 0;
          break;
        case 'service':
          aValue = a.service;
          bValue = b.service;
          break;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      return sortDirection === 'asc' 
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number);
    });

    return filtered;
  }, [rateData, searchTerm, serviceFilter, carrierFilter, weightFilter, sortBy, sortDirection]);

  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDirection('desc');
    }
  };

  const handleCarrierChange = (shipmentId: number, serviceType: string, newCarrierId: string) => {
    if (onCarrierReassign) {
      onCarrierReassign(shipmentId, serviceType, newCarrierId);
    }
  };

  const exportData = () => {
    // Prepare CSV data
    const csvRows = [
      ['Shipment ID', 'Tracking ID', 'Service', 'Origin', 'Destination', 'Weight', 'Current Cost', 'Account', 'Rate', 'Savings', 'Rate Type', 'Transit Time']
    ];

    filteredData.forEach(row => {
      row.rates.forEach(rate => {
        const savings = (row.currentCost || 0) - rate.rate;
        csvRows.push([
          row.shipmentId.toString(),
          row.trackingId || '',
          row.service,
          row.originZip,
          row.destZip,
          row.weight.toString(),
          (row.currentCost || 0).toString(),
          rate.accountName,
          rate.rate.toString(),
          savings.toString(),
          rate.rateType || 'published',
          rate.transitTime || ''
        ]);
      });
    });

    const csvContent = csvRows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'detailed-rates.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Filters and Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Detailed Rate Analysis
            </CardTitle>
            <Button onClick={exportData} variant="outline" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tracking, zips..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <Select value={serviceFilter} onValueChange={setServiceFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Service Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Services</SelectItem>
                {serviceTypes.map(service => (
                  <SelectItem key={service} value={service}>{service}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={carrierFilter} onValueChange={setCarrierFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Carrier Account" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Carriers</SelectItem>
                {carrierAccounts.map(account => (
                  <SelectItem key={account} value={account}>{account}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={weightFilter} onValueChange={setWeightFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Weight Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Weights</SelectItem>
                <SelectItem value="light">≤ 5 lbs</SelectItem>
                <SelectItem value="medium">6-20 lbs</SelectItem>
                <SelectItem value="heavy">&gt; 20 lbs</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="savings">Savings</SelectItem>
                <SelectItem value="weight">Weight</SelectItem>
                <SelectItem value="rate">Best Rate</SelectItem>
                <SelectItem value="service">Service</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="text-sm text-muted-foreground">
            Showing {filteredData.length} of {rateData.length} shipments
          </div>
        </CardContent>
      </Card>

      {/* Detailed Rate Table */}
      <div className="space-y-4">
        {filteredData.map((row) => (
          <Card key={row.shipmentId}>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Shipment #{row.shipmentId}</h3>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                    {row.trackingId && (
                      <span className="flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        {row.trackingId}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {row.originZip} → {row.destZip}
                    </span>
                    <span className="flex items-center gap-1">
                      <Weight className="h-3 w-3" />
                      {row.weight} lbs
                    </span>
                    <Badge variant="outline">{row.service}</Badge>
                  </div>
                </div>
                <div className="text-right">
                  {row.currentCost && (
                    <div className="text-sm text-muted-foreground">
                      Current: {formatCurrency(row.currentCost)}
                    </div>
                  )}
                  {row.rates.length > 0 && (
                    <div className="text-sm font-medium text-green-600">
                      Best: {formatCurrency(row.rates.find(r => r.isBestRate)?.rate || 0)}
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Rate</TableHead>
                    <TableHead>Savings</TableHead>
                    <TableHead>Rate Type</TableHead>
                    <TableHead>Transit</TableHead>
                    <TableHead>Status</TableHead>
                    {allowReassignment && <TableHead>Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {row.rates.map((rate, index) => {
                    const savings = (row.currentCost || 0) - rate.rate;
                    const savingsPercentage = row.currentCost ? ((savings / row.currentCost) * 100) : 0;
                    
                    return (
                      <TableRow key={index} className={rate.isBestRate ? 'bg-green-50' : ''}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{rate.accountName}</div>
                            <div className="text-xs text-muted-foreground">{rate.carrierName}</div>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(rate.rate)}
                        </TableCell>
                        <TableCell>
                          <div className={`flex items-center gap-1 ${savings > 0 ? 'text-green-600' : savings < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                            {savings > 0 ? <TrendingDown className="h-3 w-3" /> : savings < 0 ? <TrendingUp className="h-3 w-3" /> : <DollarSign className="h-3 w-3" />}
                            <span className="font-medium">{formatCurrency(Math.abs(savings))}</span>
                            {savingsPercentage !== 0 && (
                              <span className="text-xs">({savingsPercentage > 0 ? '-' : '+'}{Math.abs(savingsPercentage).toFixed(1)}%)</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={rate.hasNegotiatedRates ? 'default' : 'secondary'}>
                            {rate.rateType || 'Published'}
                          </Badge>
                        </TableCell>
                        <TableCell>{rate.transitTime || 'N/A'}</TableCell>
                        <TableCell>
                          {rate.isBestRate && (
                            <Badge variant="default" className="flex items-center gap-1">
                              <TrendingDown className="h-3 w-3" />
                              Best Rate
                            </Badge>
                          )}
                        </TableCell>
                        {allowReassignment && (
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCarrierChange(row.shipmentId, row.service, rate.carrierId)}
                              disabled={rate.isBestRate}
                            >
                              {rate.isBestRate ? 'Selected' : 'Select'}
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredData.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <Filter className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No shipments match your current filters.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}