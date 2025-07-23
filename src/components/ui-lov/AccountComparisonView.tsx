import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui-lov/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { TruckIcon, DollarSign, Package, Trophy } from 'lucide-react';

interface AccountComparisonViewProps {
  analysisId: string;
  analysisData?: any;
}

interface ShipmentWithRates {
  index: number;
  trackingId: string;
  originZip: string;
  destinationZip: string;
  service: string;
  weight: number;
  rates: Array<{
    accountName: string;
    carrierType: string;
    serviceCode: string;
    rateAmount: number;
    isNegotiated: boolean;
  }>;
  currentRate?: number;
  accountUsed?: string;
  lowestRate?: number;
  lowestRateAccount?: string;
  savings?: number;
}

export function AccountComparisonView({ analysisId, analysisData }: AccountComparisonViewProps) {
  const { toast } = useToast();
  
  // Filter states
  const [selectedServices, setSelectedServices] = useState<string[]>(['Ground', '2-Day']);
  const [selectedWeightBands, setSelectedWeightBands] = useState<string[]>(['0-10', '11-50']);
  const [defaultAccount, setDefaultAccount] = useState<string>('');

  // Get shipment data with rates
  const shipmentsWithRates = useMemo<ShipmentWithRates[]>(() => {
    if (!analysisData?.processed_shipments || !analysisData?.shipment_rates) {
      return [];
    }

    return analysisData.processed_shipments.map((shipment: any, index: number) => {
      // Get all rates for this shipment
      const shipmentRates = analysisData.shipment_rates.filter(
        (rate: any) => rate.shipment_index === index
      );

      // Find lowest rate
      const lowestRate = Math.min(...shipmentRates.map((r: any) => r.rate_amount));
      const lowestRateAccount = shipmentRates.find((r: any) => r.rate_amount === lowestRate)?.account_name;

      return {
        index,
        trackingId: shipment.trackingId || `Ship-${index + 1}`,
        originZip: shipment.originZip,
        destinationZip: shipment.destinationZip,
        service: shipment.service,
        weight: shipment.weight,
        rates: shipmentRates.map((rate: any) => ({
          accountName: rate.account_name,
          carrierType: rate.carrier_type,
          serviceCode: rate.service_code,
          rateAmount: rate.rate_amount,
          isNegotiated: rate.is_negotiated
        })),
        currentRate: shipment.currentRate,
        accountUsed: shipment.accountUsed || lowestRateAccount,
        lowestRate,
        lowestRateAccount,
        savings: shipment.currentRate ? shipment.currentRate - lowestRate : 0
      };
    });
  }, [analysisData]);

  // Get unique accounts
  const accounts = useMemo(() => {
    const accountSet = new Set<string>();
    shipmentsWithRates.forEach(shipment => {
      shipment.rates.forEach(rate => accountSet.add(rate.accountName));
    });
    return Array.from(accountSet);
  }, [shipmentsWithRates]);

  // Apply filters
  const filteredShipments = useMemo(() => {
    return shipmentsWithRates.filter(shipment => {
      // Service filter
      const serviceMatch = selectedServices.length === 0 || 
        selectedServices.some(service => 
          shipment.service.toLowerCase().includes(service.toLowerCase())
        );

      // Weight filter
      const weightMatch = selectedWeightBands.length === 0 ||
        selectedWeightBands.some(band => {
          if (band === '0-10') return shipment.weight <= 10;
          if (band === '11-50') return shipment.weight > 10 && shipment.weight <= 50;
          if (band === '50+') return shipment.weight > 50;
          return false;
        });

      return serviceMatch && weightMatch;
    });
  }, [shipmentsWithRates, selectedServices, selectedWeightBands]);

  // Calculate KPIs
  const kpis = useMemo(() => {
    const accountsCompared = accounts.length;
    const totalShipments = filteredShipments.length;
    const totalSavings = filteredShipments.reduce((sum, ship) => sum + (ship.savings || 0), 0);
    
    // Find top performer by win rate
    const accountWins = accounts.map(account => {
      const wins = filteredShipments.filter(ship => ship.accountUsed === account).length;
      return { account, wins, winRate: totalShipments > 0 ? (wins / totalShipments) * 100 : 0 };
    });
    const topPerformer = accountWins.reduce((max, current) => 
      current.winRate > max.winRate ? current : max, 
      { account: '', winRate: 0 }
    );

    return {
      accountsCompared,
      totalShipments,
      totalSavings,
      topPerformer: topPerformer.account
    };
  }, [accounts, filteredShipments]);

  // Calculate chart data
  const winRateData = useMemo(() => {
    return accounts.map(account => {
      const wins = filteredShipments.filter(ship => ship.accountUsed === account).length;
      const winRate = filteredShipments.length > 0 ? (wins / filteredShipments.length) * 100 : 0;
      return { account, winRate: Math.round(winRate) };
    });
  }, [accounts, filteredShipments]);

  const avgSavingsData = useMemo(() => {
    return accounts.map(account => {
      const accountShipments = filteredShipments.filter(ship => ship.accountUsed === account);
      const avgSavings = accountShipments.length > 0 
        ? accountShipments.reduce((sum, ship) => sum + (ship.savings || 0), 0) / accountShipments.length
        : 0;
      return { account, avgSavings: Math.round(avgSavings * 100) / 100 };
    });
  }, [accounts, filteredShipments]);

  // Handle account selection change
  const handleAccountChange = useCallback(async (shipmentIndex: number, accountName: string) => {
    try {
      // Update local data immediately for responsiveness
      const updatedShipments = analysisData.processed_shipments.map((shipment: any, idx: number) => 
        idx === shipmentIndex ? { ...shipment, accountUsed: accountName } : shipment
      );

      // Update database
      const { error } = await supabase
        .from('shipping_analyses')
        .update({
          processed_shipments: updatedShipments,
          updated_at: new Date().toISOString()
        })
        .eq('id', analysisId);

      if (error) throw error;

      // Update parent data if possible
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('analysisDataUpdated', {
          detail: { analysisId, updatedShipments }
        }));
      }

      toast({
        title: "Account Updated",
        description: `Shipment ${shipmentIndex + 1} now uses ${accountName}`,
      });
    } catch (error) {
      console.error('Error updating account:', error);
      toast({
        title: "Update Failed",
        description: "Failed to save account selection",
        variant: "destructive"
      });
    }
  }, [analysisId, analysisData, toast]);

  // Bulk actions
  const handleBulkSelect = useCallback(async (accountName: string) => {
    try {
      const updatedShipments = analysisData.processed_shipments.map((shipment: any) => ({
        ...shipment,
        accountUsed: accountName
      }));

      const { error } = await supabase
        .from('shipping_analyses')
        .update({
          processed_shipments: updatedShipments,
          updated_at: new Date().toISOString()
        })
        .eq('id', analysisId);

      if (error) throw error;

      window.dispatchEvent(new CustomEvent('analysisDataUpdated', {
        detail: { analysisId, updatedShipments }
      }));

      toast({
        title: "Bulk Update Complete",
        description: `All shipments now use ${accountName}`,
      });
    } catch (error) {
      console.error('Error with bulk update:', error);
      toast({
        title: "Bulk Update Failed",
        description: "Failed to update all shipments",
        variant: "destructive"
      });
    }
  }, [analysisId, analysisData, toast]);

  const handleClearSelections = useCallback(async () => {
    try {
      const updatedShipments = analysisData.processed_shipments.map((shipment: any) => ({
        ...shipment,
        accountUsed: undefined
      }));

      const { error } = await supabase
        .from('shipping_analyses')
        .update({
          processed_shipments: updatedShipments,
          updated_at: new Date().toISOString()
        })
        .eq('id', analysisId);

      if (error) throw error;

      window.dispatchEvent(new CustomEvent('analysisDataUpdated', {
        detail: { analysisId, updatedShipments }
      }));

      toast({
        title: "Selections Cleared",
        description: "All account selections have been cleared",
      });
    } catch (error) {
      console.error('Error clearing selections:', error);
      toast({
        title: "Clear Failed",
        description: "Failed to clear selections",
        variant: "destructive"
      });
    }
  }, [analysisId, analysisData, toast]);

  const serviceTypes = ['Ground', '2-Day', 'Overnight'];
  const weightBands = ['0-10', '11-50', '50+'];

  return (
    <div className="space-y-6">
      {/* KPI Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Accounts Compared</CardTitle>
            <TruckIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.accountsCompared}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Shipments</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.totalShipments}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Savings</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${kpis.totalSavings.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Performer</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.topPerformer || 'N/A'}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Slicers */}
      <Card>
        <CardHeader>
          <CardTitle>Filters & Slicers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm font-medium mb-2 block">Service Types:</Label>
            <div className="flex flex-wrap gap-2">
              {serviceTypes.map(service => (
                <Badge
                  key={service}
                  variant={selectedServices.includes(service) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => {
                    setSelectedServices(prev => 
                      prev.includes(service) 
                        ? prev.filter(s => s !== service)
                        : [...prev, service]
                    );
                  }}
                >
                  {selectedServices.includes(service) ? '✓ ' : ''}{service}
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium mb-2 block">Weight Bands:</Label>
            <div className="flex flex-wrap gap-2">
              {weightBands.map(band => (
                <Badge
                  key={band}
                  variant={selectedWeightBands.includes(band) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => {
                    setSelectedWeightBands(prev => 
                      prev.includes(band) 
                        ? prev.filter(b => b !== band)
                        : [...prev, band]
                    );
                  }}
                >
                  {selectedWeightBands.includes(band) ? '✓ ' : ''}{band} lbs
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Win Rate by Account</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={winRateData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="account" />
                <YAxis />
                <Tooltip formatter={(value) => [`${value}%`, 'Win Rate']} />
                <Bar dataKey="winRate" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Average Savings by Account</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={avgSavingsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="account" />
                <YAxis />
                <Tooltip formatter={(value) => [`$${value}`, 'Avg Savings']} />
                <Bar dataKey="avgSavings" fill="hsl(var(--chart-2))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <Label className="text-sm font-medium">Default Account:</Label>
              <Select value={defaultAccount} onValueChange={setDefaultAccount}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map(account => (
                    <SelectItem key={account} value={account}>{account}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => defaultAccount && handleBulkSelect(defaultAccount)}
                disabled={!defaultAccount}
              >
                Select All {defaultAccount} Wins
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={handleClearSelections}
              >
                Clear All Selections
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Shipment Comparison Grid */}
      <Card>
        <CardHeader>
          <CardTitle>Shipment Comparison Grid</CardTitle>
          <CardDescription>
            Showing {filteredShipments.length} shipments. Lowest rates are highlighted.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead>Tracking ID</TableHead>
                  <TableHead>Origin→Dest</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Current</TableHead>
                  {accounts.map(account => (
                    <TableHead key={account}>{account}</TableHead>
                  ))}
                  <TableHead>Winner</TableHead>
                  <TableHead>Savings</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredShipments.map((shipment) => (
                  <TableRow key={shipment.index}>
                    <TableCell className="font-mono text-sm">
                      {shipment.trackingId}
                    </TableCell>
                    <TableCell className="text-sm">
                      {shipment.originZip}→{shipment.destinationZip}
                    </TableCell>
                    <TableCell>{shipment.service}</TableCell>
                    <TableCell>
                      {shipment.currentRate ? `$${shipment.currentRate.toFixed(2)}` : '—'}
                    </TableCell>
                    {accounts.map(account => {
                      const rate = shipment.rates.find(r => r.accountName === account);
                      const isLowest = rate && rate.rateAmount === shipment.lowestRate;
                      return (
                        <TableCell 
                          key={account}
                          className={isLowest ? 'bg-green-50 font-semibold' : ''}
                        >
                          {rate ? `$${rate.rateAmount.toFixed(2)}` : '—'}
                        </TableCell>
                      );
                    })}
                    <TableCell>
                      <RadioGroup
                        value={shipment.accountUsed || ''}
                        onValueChange={(value) => handleAccountChange(shipment.index, value)}
                      >
                        <div className="flex flex-col gap-1">
                          {accounts.filter(account => 
                            shipment.rates.some(r => r.accountName === account)
                          ).map(account => (
                            <div key={account} className="flex items-center space-x-2">
                              <RadioGroupItem value={account} id={`${shipment.index}-${account}`} />
                              <Label 
                                htmlFor={`${shipment.index}-${account}`}
                                className="text-xs cursor-pointer"
                              >
                                {account}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </RadioGroup>
                    </TableCell>
                    <TableCell>
                      {shipment.savings ? `$${shipment.savings.toFixed(2)}` : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}