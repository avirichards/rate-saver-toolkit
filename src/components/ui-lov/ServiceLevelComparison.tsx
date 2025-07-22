
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingDown, Package, Clock, DollarSign, BarChart3 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface ServicePerformance {
  serviceName: string;
  serviceCode: string;
  accounts: {
    accountName: string;
    averageRate: number;
    shipmentCount: number;
    winRate: number;
    averageTransitDays: number;
    totalSavings: number;
  }[];
}

interface ServiceLevelComparisonProps {
  servicePerformances: ServicePerformance[];
  onServiceSelect: (serviceName: string) => void;
}

export const ServiceLevelComparison: React.FC<ServiceLevelComparisonProps> = ({ 
  servicePerformances, 
  onServiceSelect 
}) => {
  const [selectedService, setSelectedService] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'winRate' | 'averageRate' | 'shipmentCount'>('winRate');

  const filteredServices = selectedService === 'all' 
    ? servicePerformances 
    : servicePerformances.filter(service => service.serviceName === selectedService);

  const sortAccounts = (accounts: ServicePerformance['accounts']) => {
    return [...accounts].sort((a, b) => {
      if (sortBy === 'averageRate') return a.averageRate - b.averageRate;
      if (sortBy === 'shipmentCount') return b.shipmentCount - a.shipmentCount;
      return b.winRate - a.winRate;
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            Service-Level Performance
          </CardTitle>
          <div className="flex gap-2">
            <Select value={selectedService} onValueChange={setSelectedService}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by Service" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Services</SelectItem>
                {servicePerformances.map(service => (
                  <SelectItem key={service.serviceName} value={service.serviceName}>
                    {service.serviceName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="winRate">Win Rate</SelectItem>
                <SelectItem value="averageRate">Average Rate</SelectItem>
                <SelectItem value="shipmentCount">Shipment Count</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {filteredServices.map((service) => (
            <div key={service.serviceName} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Package className="h-5 w-5 text-blue-600" />
                    {service.serviceName}
                  </h3>
                  <p className="text-sm text-muted-foreground">Service Code: {service.serviceCode}</p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => onServiceSelect(service.serviceName)}
                >
                  View Shipments
                </Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>
                      <div className="flex items-center gap-1">
                        <TrendingDown className="h-4 w-4" />
                        Win Rate
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-4 w-4" />
                        Avg Rate
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="flex items-center gap-1">
                        <Package className="h-4 w-4" />
                        Shipments
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        Transit
                      </div>
                    </TableHead>
                    <TableHead>Savings</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortAccounts(service.accounts).map((account, index) => {
                    const isBest = index === 0 && sortBy === 'winRate';
                    return (
                      <TableRow key={account.accountName} className={isBest ? 'bg-green-50' : ''}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {account.accountName}
                            {isBest && (
                              <Badge variant="default" className="bg-green-600">
                                <TrendingDown className="h-3 w-3 mr-1" />
                                Best
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <span className={isBest ? 'text-green-600 font-semibold' : ''}>
                              {account.winRate.toFixed(1)}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className={isBest ? 'text-green-600 font-semibold' : ''}>
                          {formatCurrency(account.averageRate)}
                        </TableCell>
                        <TableCell>{account.shipmentCount}</TableCell>
                        <TableCell>{account.averageTransitDays.toFixed(1)} days</TableCell>
                        <TableCell className="text-green-600 font-semibold">
                          {formatCurrency(account.totalSavings)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
