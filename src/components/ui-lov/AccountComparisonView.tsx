
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui-lov/Card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Search, AlertCircle } from 'lucide-react';
import { AccountPerformanceSummary } from './AccountPerformanceSummary';
import { ServiceLevelComparison } from './ServiceLevelComparison';
import { ShipmentLevelDrillDown } from './ShipmentLevelDrillDown';

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

interface AccountComparisonViewProps {
  analysisId: string | null;
}

type ViewMode = 'overview' | 'service' | 'shipment';

export const AccountComparisonView: React.FC<AccountComparisonViewProps> = ({ analysisId }) => {
  const [shipmentRates, setShipmentRates] = useState<ShipmentRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [selectedService, setSelectedService] = useState<string | undefined>();
  const [availableAccounts, setAvailableAccounts] = useState<string[]>([]);

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

      setShipmentRates(data);
      const accounts = Array.from(new Set(data.map(rate => rate.account_name))).sort();
      setAvailableAccounts(accounts);

      console.log('✅ AccountComparisonView: Data processed successfully:', {
        shipmentsCount: new Set(data.map(r => r.shipment_index)).size,
        accountsCount: accounts.length,
        totalRates: data.length
      });

    } catch (error) {
      console.error('❌ AccountComparisonView: Error in loadShipmentRates:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate account performance metrics
  const calculateAccountPerformances = () => {
    const accountMap = new Map();
    const shipmentMap = new Map();

    // Group rates by shipment and calculate best rates
    shipmentRates.forEach(rate => {
      const shipmentKey = rate.shipment_index;
      if (!shipmentMap.has(shipmentKey)) {
        shipmentMap.set(shipmentKey, []);
      }
      shipmentMap.get(shipmentKey).push(rate);
    });

    // Calculate performance for each account
    availableAccounts.forEach(accountName => {
      const accountRates = shipmentRates.filter(rate => rate.account_name === accountName);
      let wins = 0;
      let totalSavings = 0;
      let totalTransitDays = 0;
      let transitCount = 0;

      shipmentMap.forEach(shipmentRates => {
        const accountRate = shipmentRates.find(r => r.account_name === accountName);
        if (accountRate) {
          const bestRate = Math.min(...shipmentRates.map(r => r.rate_amount));
          const worstRate = Math.max(...shipmentRates.map(r => r.rate_amount));
          
          if (accountRate.rate_amount === bestRate) {
            wins++;
          }
          totalSavings += worstRate - accountRate.rate_amount;
          
          if (accountRate.transit_days) {
            totalTransitDays += accountRate.transit_days;
            transitCount++;
          }
        }
      });

      accountMap.set(accountName, {
        accountName,
        totalShipments: accountRates.length,
        totalSavings,
        averageRate: accountRates.reduce((sum, r) => sum + r.rate_amount, 0) / accountRates.length,
        winRate: (wins / shipmentMap.size) * 100,
        averageTransitDays: transitCount > 0 ? totalTransitDays / transitCount : 0,
        serviceCount: new Set(accountRates.map(r => r.service_name || r.service_code)).size
      });
    });

    return Array.from(accountMap.values());
  };

  // Calculate service performance metrics
  const calculateServicePerformances = () => {
    const serviceMap = new Map();
    
    shipmentRates.forEach(rate => {
      const serviceName = rate.service_name || rate.service_code;
      if (!serviceMap.has(serviceName)) {
        serviceMap.set(serviceName, {
          serviceName,
          serviceCode: rate.service_code,
          accounts: new Map()
        });
      }
      
      const service = serviceMap.get(serviceName);
      if (!service.accounts.has(rate.account_name)) {
        service.accounts.set(rate.account_name, {
          accountName: rate.account_name,
          rates: [],
          totalSavings: 0,
          wins: 0
        });
      }
      
      service.accounts.get(rate.account_name).rates.push(rate);
    });

    // Calculate metrics for each service
    return Array.from(serviceMap.values()).map(service => ({
      serviceName: service.serviceName,
      serviceCode: service.serviceCode,
      accounts: Array.from(service.accounts.values()).map(account => {
        const rates = account.rates;
        const avgRate = rates.reduce((sum, r) => sum + r.rate_amount, 0) / rates.length;
        const avgTransit = rates.filter(r => r.transit_days).reduce((sum, r) => sum + r.transit_days!, 0) / rates.filter(r => r.transit_days).length || 0;
        
        // Calculate wins for this account in this service
        const shipmentGroups = new Map();
        rates.forEach(rate => {
          if (!shipmentGroups.has(rate.shipment_index)) {
            shipmentGroups.set(rate.shipment_index, []);
          }
          shipmentGroups.get(rate.shipment_index).push(rate);
        });
        
        let wins = 0;
        let totalSavings = 0;
        shipmentGroups.forEach(shipmentRates => {
          const bestRate = Math.min(...shipmentRates.map(r => r.rate_amount));
          const worstRate = Math.max(...shipmentRates.map(r => r.rate_amount));
          const accountRate = shipmentRates.find(r => r.account_name === account.accountName);
          
          if (accountRate && accountRate.rate_amount === bestRate) {
            wins++;
          }
          if (accountRate) {
            totalSavings += worstRate - accountRate.rate_amount;
          }
        });
        
        return {
          accountName: account.accountName,
          averageRate: avgRate,
          shipmentCount: rates.length,
          winRate: (wins / shipmentGroups.size) * 100,
          averageTransitDays: avgTransit,
          totalSavings
        };
      })
    }));
  };

  // Calculate shipment details
  const calculateShipmentDetails = () => {
    const shipmentMap = new Map();
    
    shipmentRates.forEach(rate => {
      if (!shipmentMap.has(rate.shipment_index)) {
        shipmentMap.set(rate.shipment_index, {
          shipmentIndex: rate.shipment_index,
          shipmentData: rate.shipment_data,
          rates: []
        });
      }
      shipmentMap.get(rate.shipment_index).rates.push(rate);
    });

    return Array.from(shipmentMap.values()).map(shipment => {
      const sortedRates = shipment.rates.sort((a, b) => a.rate_amount - b.rate_amount);
      const bestRate = sortedRates[0];
      const worstRate = sortedRates[sortedRates.length - 1];
      
      return {
        shipmentIndex: shipment.shipmentIndex,
        shipmentData: shipment.shipmentData,
        rates: sortedRates.map(rate => ({
          accountName: rate.account_name,
          serviceCode: rate.service_code,
          serviceName: rate.service_name || rate.service_code,
          rateAmount: rate.rate_amount,
          transitDays: rate.transit_days || 0,
          isNegotiated: rate.is_negotiated,
          isBest: rate.id === bestRate.id
        })),
        bestRate: bestRate.rate_amount,
        potentialSavings: worstRate.rate_amount - bestRate.rate_amount
      };
    });
  };

  // Filter data based on current filters
  const applyFilters = (data: any[]) => {
    let filtered = data;

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(item => 
        JSON.stringify(item).toLowerCase().includes(searchLower)
      );
    }

    if (selectedAccount !== 'all') {
      filtered = filtered.filter(item => 
        JSON.stringify(item).includes(selectedAccount)
      );
    }

    return filtered;
  };

  const handleServiceSelect = (serviceName: string) => {
    setSelectedService(serviceName);
    setViewMode('shipment');
  };

  const handleBackToServices = () => {
    setSelectedService(undefined);
    setViewMode('service');
  };

  const handleBackToOverview = () => {
    setViewMode('overview');
  };

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

  const accountPerformances = calculateAccountPerformances();
  const servicePerformances = calculateServicePerformances();
  const shipmentDetails = calculateShipmentDetails();

  return (
    <div className="space-y-6">
      {/* Search and Filter Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search accounts, services, or shipments..."
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
          </div>
        </CardContent>
      </Card>

      {/* Dynamic Content Based on View Mode */}
      {viewMode === 'overview' && (
        <div className="space-y-6">
          <AccountPerformanceSummary accountPerformances={applyFilters(accountPerformances)} />
          <div className="flex justify-center">
            <button
              onClick={() => setViewMode('service')}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              Drill Down to Services
            </button>
          </div>
        </div>
      )}

      {viewMode === 'service' && (
        <div className="space-y-6">
          <div className="flex justify-center">
            <button
              onClick={handleBackToOverview}
              className="px-4 py-2 border border-primary text-primary rounded-lg hover:bg-primary/10 transition-colors"
            >
              Back to Overview
            </button>
          </div>
          <ServiceLevelComparison 
            servicePerformances={applyFilters(servicePerformances)}
            onServiceSelect={handleServiceSelect}
          />
        </div>
      )}

      {viewMode === 'shipment' && (
        <ShipmentLevelDrillDown 
          shipments={applyFilters(shipmentDetails)}
          selectedService={selectedService}
          onBack={handleBackToServices}
        />
      )}
    </div>
  );
};
