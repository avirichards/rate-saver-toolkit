import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/utils';
import { Search, TrendingDown, TrendingUp, AlertCircle } from 'lucide-react';

interface ShipmentRate {
  id: string;
  shipment_index: number;
  account_name: string;
  carrier_type: string;
  service_code: string;
  service_name: string | null;
  rate_amount: number;
  currency: string;
  transit_days: number | null;
  is_negotiated: boolean;
  published_rate: number | null;
  shipment_data: any;
}

interface GroupedShipmentRates {
  shipment_index: number;
  shipment_data: any;
  rates: ShipmentRate[];
  bestRate: ShipmentRate | null;
  potentialSavings: number;
  highestRate: number;
}

interface AccountComparisonViewProps {
  analysisId: string | null;
}

export const AccountComparisonView: React.FC<AccountComparisonViewProps> = ({ analysisId }) => {
  const [shipmentRates, setShipmentRates] = useState<GroupedShipmentRates[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [selectedService, setSelectedService] = useState<string>('all');
  const [availableAccounts, setAvailableAccounts] = useState<string[]>([]);
  const [availableServices, setAvailableServices] = useState<string[]>([]);

  useEffect(() => {
    if (analysisId) {
      console.log('🔍 AccountComparisonView: Loading data for analysis ID:', analysisId);
      loadShipmentRates();
    } else {
      console.warn('⚠️ AccountComparisonView: No analysis ID provided');
    }
  }, [analysisId]);

  const loadShipmentRates = async () => {
    if (!analysisId) {
      console.warn('⚠️ AccountComparisonView: Cannot load rates - no analysis ID');
      return;
    }

    try {
      setLoading(true);
      console.log('📊 AccountComparisonView: Fetching rates for analysis:', analysisId);
      
      const { data, error } = await supabase
        .from('shipment_rates')
        .select('*')
        .eq('analysis_id', analysisId)
        .order('shipment_index', { ascending: true })
        .order('rate_amount', { ascending: true });

      if (error) {
        console.error('❌ AccountComparisonView: Error loading shipment rates:', error);
        return;
      }

      console.log('📊 AccountComparisonView: Raw data received:', {
        analysisId,
        recordCount: data?.length || 0,
        sampleData: data?.slice(0, 3)
      });

      if (!data || data.length === 0) {
        console.log('📊 AccountComparisonView: No shipment rates found for analysis:', analysisId);
        setShipmentRates([]);
        return;
      }

      // Group rates by shipment index
      const groupedRates: { [key: number]: ShipmentRate[] } = {};
      const accounts = new Set<string>();
      const services = new Set<string>();

      data.forEach((rate: any) => {
        const shipmentIndex = rate.shipment_index;
        if (!groupedRates[shipmentIndex]) {
          groupedRates[shipmentIndex] = [];
        }
        groupedRates[shipmentIndex].push(rate);
        accounts.add(rate.account_name);
        if (rate.service_name) {
          services.add(rate.service_name);
        }
      });

      // Create grouped shipment rates with best rate calculation
      const processedRates: GroupedShipmentRates[] = Object.entries(groupedRates).map(([shipmentIndex, rates]) => {
        const sortedRates = rates.sort((a, b) => a.rate_amount - b.rate_amount);
        const bestRate = sortedRates[0];
        const highestRate = Math.max(...rates.map(r => r.rate_amount));
        const potentialSavings = highestRate - bestRate.rate_amount;

        return {
          shipment_index: parseInt(shipmentIndex),
          shipment_data: bestRate.shipment_data,
          rates: sortedRates,
          bestRate,
          potentialSavings,
          highestRate
        };
      });

      setShipmentRates(processedRates);
      setAvailableAccounts(Array.from(accounts).sort());
      setAvailableServices(Array.from(services).sort());

      console.log('✅ AccountComparisonView: Data processed successfully:', {
        shipmentsCount: processedRates.length,
        accountsCount: accounts.size,
        servicesCount: services.size,
        totalRates: data.length
      });

    } catch (error) {
      console.error('❌ AccountComparisonView: Error in loadShipmentRates:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter shipments based on search and filters
  const filteredShipments = shipmentRates.filter(shipment => {
    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        shipment.shipment_data?.shipFrom?.zipCode?.toLowerCase().includes(searchLower) ||
        shipment.shipment_data?.shipTo?.zipCode?.toLowerCase().includes(searchLower) ||
        shipment.rates.some(rate => 
          rate.account_name.toLowerCase().includes(searchLower) ||
          rate.service_name?.toLowerCase().includes(searchLower)
        );
      if (!matchesSearch) return false;
    }

    // Account filter
    if (selectedAccount !== 'all') {
      const hasAccount = shipment.rates.some(rate => rate.account_name === selectedAccount);
      if (!hasAccount) return false;
    }

    // Service filter
    if (selectedService !== 'all') {
      const hasService = shipment.rates.some(rate => rate.service_name === selectedService);
      if (!hasService) return false;
    }

    return true;
  });

  const totalSavingsOpportunity = filteredShipments.reduce((sum, shipment) => sum + shipment.potentialSavings, 0);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading account comparison data...</div>
        </CardContent>
      </Card>
    );
  }

  if (shipmentRates.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">No Account Comparison Data Available</h3>
            <p className="mb-2">
              {!analysisId 
                ? "No analysis ID provided for this view."
                : "This analysis doesn't have individual rate data from multiple accounts."
              }
            </p>
            <p className="text-sm">
              To see account comparison data, run a new analysis after the recent updates.
            </p>
            {analysisId && (
              <p className="text-xs mt-2 text-muted-foreground">
                Analysis ID: {analysisId}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-green-600" />
            Account Comparison Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-primary">{filteredShipments.length}</div>
              <div className="text-sm text-muted-foreground">Shipments Analyzed</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-green-600">{formatCurrency(totalSavingsOpportunity)}</div>
              <div className="text-sm text-muted-foreground">Total Savings Opportunity</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{availableAccounts.length}</div>
              <div className="text-sm text-muted-foreground">Carrier Accounts Compared</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by ZIP code, account, or service..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={selectedAccount} onValueChange={setSelectedAccount}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by Account" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Accounts</SelectItem>
                {availableAccounts.map(account => (
                  <SelectItem key={account} value={account}>{account}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedService} onValueChange={setSelectedService}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by Service" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Services</SelectItem>
                {availableServices.map(service => (
                  <SelectItem key={service} value={service}>{service}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Shipment Comparison Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Rate Comparison by Shipment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {filteredShipments.map((shipment) => (
              <div key={shipment.shipment_index} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="font-medium">Shipment #{shipment.shipment_index + 1}</h4>
                    <div className="text-sm text-muted-foreground">
                      {shipment.shipment_data?.shipFrom?.zipCode} → {shipment.shipment_data?.shipTo?.zipCode}
                      {shipment.shipment_data?.package?.weight && (
                        <span className="ml-2">• {shipment.shipment_data.package.weight} lbs</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">Potential Savings</div>
                    <div className="text-lg font-semibold text-green-600">
                      {formatCurrency(shipment.potentialSavings)}
                    </div>
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account Name</TableHead>
                      <TableHead>Service</TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead>Transit Days</TableHead>
                      <TableHead>Rate Type</TableHead>
                      <TableHead>Best Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shipment.rates.map((rate, index) => {
                      const isBest = rate.id === shipment.bestRate?.id;
                      return (
                        <TableRow key={rate.id} className={isBest ? 'bg-green-50' : ''}>
                          <TableCell className="font-medium">{rate.account_name}</TableCell>
                          <TableCell>{rate.service_name || rate.service_code}</TableCell>
                          <TableCell className={isBest ? 'text-green-600 font-semibold' : ''}>
                            {formatCurrency(rate.rate_amount)}
                          </TableCell>
                          <TableCell>{rate.transit_days || 'N/A'}</TableCell>
                          <TableCell>
                            <Badge variant={rate.is_negotiated ? 'default' : 'secondary'}>
                              {rate.is_negotiated ? 'Negotiated' : 'Published'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {isBest && (
                              <Badge variant="default" className="bg-green-600">
                                <TrendingDown className="h-3 w-3 mr-1" />
                                Best
                              </Badge>
                            )}
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
    </div>
  );
};