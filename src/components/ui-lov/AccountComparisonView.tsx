import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/utils';
import { Search, TrendingDown, TrendingUp, AlertCircle, Trophy, Target, BarChart3, ChevronDown, ChevronRight } from 'lucide-react';

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

interface AccountPerformance {
  accountName: string;
  totalShipments: number;
  winCount: number;
  winRate: number;
  totalSavingsOpportunity: number;
  averageRate: number;
  averageSavings: number;
  bestServices: string[];
}

interface ServicePerformance {
  serviceName: string;
  serviceCode: string;
  accountPerformance: {
    accountName: string;
    averageRate: number;
    shipmentCount: number;
    winCount: number;
  }[];
  bestAccount: string;
  worstAccount: string;
  rateSpread: number;
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
  const [accountPerformance, setAccountPerformance] = useState<AccountPerformance[]>([]);
  const [servicePerformance, setServicePerformance] = useState<ServicePerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [selectedService, setSelectedService] = useState<string>('all');
  const [availableAccounts, setAvailableAccounts] = useState<string[]>([]);
  const [availableServices, setAvailableServices] = useState<string[]>([]);
  const [expandedService, setExpandedService] = useState<string | null>(null);

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

      // Create grouped shipment rates
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

      // Calculate account performance metrics
      const accountMetrics = calculateAccountPerformance(processedRates, Array.from(accounts));
      const serviceMetrics = calculateServicePerformance(data);

      setShipmentRates(processedRates);
      setAccountPerformance(accountMetrics);
      setServicePerformance(serviceMetrics);
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

  const calculateAccountPerformance = (shipments: GroupedShipmentRates[], accounts: string[]): AccountPerformance[] => {
    return accounts.map(accountName => {
      const accountRates = shipments.map(shipment => 
        shipment.rates.find(rate => rate.account_name === accountName)
      ).filter(Boolean) as ShipmentRate[];

      const wins = shipments.filter(shipment => 
        shipment.bestRate?.account_name === accountName
      ).length;

      const totalSavings = shipments.reduce((sum, shipment) => {
        const accountRate = shipment.rates.find(rate => rate.account_name === accountName);
        if (accountRate && shipment.bestRate && accountRate.id !== shipment.bestRate.id) {
          return sum + (accountRate.rate_amount - shipment.bestRate.rate_amount);
        }
        return sum;
      }, 0);

      const averageRate = accountRates.length > 0 
        ? accountRates.reduce((sum, rate) => sum + rate.rate_amount, 0) / accountRates.length 
        : 0;

      const serviceWins = new Map<string, number>();
      shipments.forEach(shipment => {
        if (shipment.bestRate?.account_name === accountName) {
          const serviceName = shipment.bestRate.service_name || shipment.bestRate.service_code;
          serviceWins.set(serviceName, (serviceWins.get(serviceName) || 0) + 1);
        }
      });

      const bestServices = Array.from(serviceWins.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([service]) => service);

      return {
        accountName,
        totalShipments: accountRates.length,
        winCount: wins,
        winRate: accountRates.length > 0 ? (wins / shipments.length) * 100 : 0,
        totalSavingsOpportunity: Math.abs(totalSavings),
        averageRate,
        averageSavings: accountRates.length > 0 ? totalSavings / accountRates.length : 0,
        bestServices
      };
    }).sort((a, b) => b.winRate - a.winRate);
  };

  const calculateServicePerformance = (rates: ShipmentRate[]): ServicePerformance[] => {
    const serviceGroups = new Map<string, ShipmentRate[]>();
    
    rates.forEach(rate => {
      const serviceKey = `${rate.service_name || rate.service_code}-${rate.service_code}`;
      if (!serviceGroups.has(serviceKey)) {
        serviceGroups.set(serviceKey, []);
      }
      serviceGroups.get(serviceKey)!.push(rate);
    });

    return Array.from(serviceGroups.entries()).map(([serviceKey, serviceRates]) => {
      const [serviceName, serviceCode] = serviceKey.split('-');
      
      // Group by account
      const accountGroups = new Map<string, ShipmentRate[]>();
      serviceRates.forEach(rate => {
        if (!accountGroups.has(rate.account_name)) {
          accountGroups.set(rate.account_name, []);
        }
        accountGroups.get(rate.account_name)!.push(rate);
      });

      const accountPerformance = Array.from(accountGroups.entries()).map(([accountName, accountRates]) => {
        const averageRate = accountRates.reduce((sum, rate) => sum + rate.rate_amount, 0) / accountRates.length;
        
        // Calculate wins for this service type
        const shipmentGroups = new Map<number, ShipmentRate[]>();
        accountRates.forEach(rate => {
          if (!shipmentGroups.has(rate.shipment_index)) {
            shipmentGroups.set(rate.shipment_index, []);
          }
        });

        // Find rates for the same shipments from all accounts
        const winCount = accountRates.filter(rate => {
          const sameShipmentRates = serviceRates.filter(r => r.shipment_index === rate.shipment_index);
          const lowestRate = Math.min(...sameShipmentRates.map(r => r.rate_amount));
          return rate.rate_amount === lowestRate;
        }).length;

        return {
          accountName,
          averageRate,
          shipmentCount: accountRates.length,
          winCount
        };
      }).sort((a, b) => a.averageRate - b.averageRate);

      const allRates = accountPerformance.map(ap => ap.averageRate);
      const bestAccount = accountPerformance[0]?.accountName || '';
      const worstAccount = accountPerformance[accountPerformance.length - 1]?.accountName || '';
      const rateSpread = Math.max(...allRates) - Math.min(...allRates);

      return {
        serviceName: serviceName || serviceCode,
        serviceCode,
        accountPerformance,
        bestAccount,
        worstAccount,
        rateSpread
      };
    }).sort((a, b) => b.rateSpread - a.rateSpread);
  };

  // Filter shipments based on search and filters
  const filteredShipments = shipmentRates.filter(shipment => {
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

    if (selectedAccount !== 'all') {
      const hasAccount = shipment.rates.some(rate => rate.account_name === selectedAccount);
      if (!hasAccount) return false;
    }

    if (selectedService !== 'all') {
      const hasService = shipment.rates.some(rate => rate.service_name === selectedService);
      if (!hasService) return false;
    }

    return true;
  });

  const totalSavingsOpportunity = filteredShipments.reduce((sum, shipment) => sum + shipment.potentialSavings, 0);
  const overallWinner = accountPerformance.length > 0 ? accountPerformance[0] : null;

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
      {/* Overall Winner & Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-600" />
              Overall Performance Leader
            </CardTitle>
          </CardHeader>
          <CardContent>
            {overallWinner && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold text-primary">{overallWinner.accountName}</h3>
                    <p className="text-muted-foreground">Best performing carrier account</p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-green-600">{overallWinner.winRate.toFixed(1)}%</div>
                    <div className="text-sm text-muted-foreground">Win Rate</div>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                  <div className="text-center">
                    <div className="text-lg font-semibold">{overallWinner.winCount}</div>
                    <div className="text-xs text-muted-foreground">Best Rates</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold">{formatCurrency(overallWinner.averageRate)}</div>
                    <div className="text-xs text-muted-foreground">Avg Rate</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold">{overallWinner.bestServices.length}</div>
                    <div className="text-xs text-muted-foreground">Top Services</div>
                  </div>
                </div>

                {overallWinner.bestServices.length > 0 && (
                  <div className="pt-2">
                    <div className="text-sm font-medium mb-2">Best performing services:</div>
                    <div className="flex flex-wrap gap-1">
                      {overallWinner.bestServices.map(service => (
                        <Badge key={service} variant="secondary" className="text-xs">
                          {service}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              Analysis Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-xl font-bold text-primary">{filteredShipments.length}</div>
                <div className="text-sm text-muted-foreground">Shipments Analyzed</div>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-xl font-bold text-green-600">{formatCurrency(totalSavingsOpportunity)}</div>
                <div className="text-sm text-muted-foreground">Total Opportunity</div>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-xl font-bold text-blue-600">{availableAccounts.length}</div>
                <div className="text-sm text-muted-foreground">Accounts Compared</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Account Performance Rankings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-green-600" />
            Account Performance Rankings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {accountPerformance.map((account, index) => (
              <div key={account.accountName} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                    {index + 1}
                  </div>
                  <div>
                    <h4 className="font-medium">{account.accountName}</h4>
                    <div className="text-sm text-muted-foreground">
                      {account.winCount} wins • {formatCurrency(account.averageRate)} avg rate
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold">{account.winRate.toFixed(1)}%</div>
                  <div className="text-sm text-muted-foreground">Win Rate</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Service Performance Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Service Type Performance Analysis</CardTitle>
          <p className="text-sm text-muted-foreground">
            Compare how each account performs across different service types
          </p>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="space-y-2">
            {servicePerformance.map((service, index) => (
              <AccordionItem key={`${service.serviceName}-${service.serviceCode}`} value={`service-${index}`}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex items-center gap-3">
                      <h4 className="font-medium">{service.serviceName}</h4>
                      <Badge variant="outline">{service.serviceCode}</Badge>
                    </div>
                    <div className="text-right text-sm">
                      <div className="font-medium text-green-600">{service.bestAccount}</div>
                      <div className="text-muted-foreground">Best: {formatCurrency(service.rateSpread)} spread</div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="pt-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Account</TableHead>
                          <TableHead>Average Rate</TableHead>
                          <TableHead>Shipments</TableHead>
                          <TableHead>Best Rates</TableHead>
                          <TableHead>Performance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {service.accountPerformance.map((account, accountIndex) => (
                          <TableRow key={account.accountName}>
                            <TableCell className="font-medium">{account.accountName}</TableCell>
                            <TableCell>{formatCurrency(account.averageRate)}</TableCell>
                            <TableCell>{account.shipmentCount}</TableCell>
                            <TableCell>{account.winCount}</TableCell>
                            <TableCell>
                              {accountIndex === 0 ? (
                                <Badge className="bg-green-600">
                                  <TrendingDown className="h-3 w-3 mr-1" />
                                  Best
                                </Badge>
                              ) : accountIndex === service.accountPerformance.length - 1 ? (
                                <Badge variant="destructive">
                                  <TrendingUp className="h-3 w-3 mr-1" />
                                  Highest
                                </Badge>
                              ) : (
                                <Badge variant="secondary">Competitive</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      {/* Search and Filters */}
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

      {/* Individual Shipment Details */}
      <Card>
        <CardHeader>
          <CardTitle>Individual Shipment Analysis</CardTitle>
          <p className="text-sm text-muted-foreground">
            Detailed rate comparison for each shipment ({filteredShipments.length} shipments)
          </p>
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
                        <TableRow key={rate.id} className={isBest ? 'bg-green-50 dark:bg-green-950' : ''}>
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