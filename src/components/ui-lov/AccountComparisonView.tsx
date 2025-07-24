import React, { useMemo, useState, useEffect } from 'react';
import { SummaryStats } from './SummaryStats';
import { Card, CardContent, CardHeader, CardTitle } from './Card';
import { formatCurrency } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

interface ShipmentRate {
  id: string;
  analysis_id: string;
  shipment_index: number;
  carrier_config_id: string;
  account_name: string;
  carrier_type: string;
  service_code: string;
  service_name: string;
  rate_amount: number;
  currency: string;
  transit_days?: number;
  is_negotiated: boolean;
  published_rate?: number;
  shipment_data: any;
}

interface ProcessedShipmentData {
  id: number;
  trackingId: string;
  currentRate: number;
  newRate: number;
  savings: number;
  service: string;
  weight: number;
  account?: string;
  accountName?: string;
}

interface AccountComparisonViewProps {
  shipmentRates: ShipmentRate[];
  shipmentData: ProcessedShipmentData[];
  onOptimizationChange?: (selections: Record<string, string>) => void;
}

export const AccountComparisonView: React.FC<AccountComparisonViewProps> = ({
  shipmentRates,
  shipmentData,
  onOptimizationChange
}) => {
  // State for tracking selected accounts per service
  const [selectedAccounts, setSelectedAccounts] = useState<Record<string, string>>({});
  
  // Get all unique accounts for dropdown options
  const availableAccounts = useMemo(() => {
    return [...new Set(shipmentRates.map(rate => rate.account_name))];
  }, [shipmentRates]);

  // Debug logging
  console.log('AccountComparisonView data:', {
    shipmentRatesCount: shipmentRates.length,
    shipmentDataCount: shipmentData.length,
    availableAccounts,
    sampleShipmentRate: shipmentRates[0],
    sampleShipmentData: shipmentData[0]
  });
  
  // Handle account selection for a service
  const handleAccountSelection = (serviceName: string, accountName: string) => {
    const newSelections = {
      ...selectedAccounts,
      [serviceName]: accountName
    };
    setSelectedAccounts(newSelections);
  };

  // Apply optimizations and notify parent
  const applyOptimizations = () => {
    if (onOptimizationChange) {
      onOptimizationChange(selectedAccounts);
    }
  };

  // Calculate KPI metrics from existing data
  const kpiMetrics = useMemo(() => {
    // Get unique accounts from shipment rates
    const uniqueAccounts = new Set(shipmentRates.map(rate => rate.account_name));
    const accountsCompared = uniqueAccounts.size;

    // Total shipments from shipment data
    const totalShipments = shipmentData.length;

    // Calculate total savings from shipment data
    const totalSavings = shipmentData.reduce((sum, shipment) => sum + (shipment.savings || 0), 0);

    // Calculate current cost (total of current rates)
    const currentCost = shipmentData.reduce((sum, shipment) => sum + (shipment.currentRate || 0), 0);

    // Find top performing account by calculating savings per account from rates
    const accountSavings: Record<string, number> = {};
    
    // Group rates by shipment and find best rate for each shipment
    const shipmentBestRates: Record<string, { account: string; rate: number; currentRate: number }> = {};
    
    shipmentRates.forEach(rate => {
      // Get tracking ID from the shipment data in the rate
      const trackingId = rate.shipment_data?.trackingId;
      if (!trackingId) return;
      
      const currentShipment = shipmentData.find(s => s.trackingId === trackingId);
      
      if (currentShipment) {
        if (!shipmentBestRates[trackingId] || rate.rate_amount < shipmentBestRates[trackingId].rate) {
          shipmentBestRates[trackingId] = {
            account: rate.account_name,
            rate: rate.rate_amount,
            currentRate: currentShipment.currentRate
          };
        }
      }
    });

    // Calculate savings per account
    Object.values(shipmentBestRates).forEach(({ account, rate, currentRate }) => {
      const savings = currentRate - rate;
      accountSavings[account] = (accountSavings[account] || 0) + savings;
    });

    // Find top performer
    const topPerformer = Object.entries(accountSavings).reduce((top, [account, savings]) => {
      return savings > top.savings ? { account, savings } : top;
    }, { account: 'N/A', savings: 0 });

    // Calculate savings percentage
    const savingsPercentage = currentCost > 0 ? (totalSavings / currentCost) * 100 : 0;

    return {
      accountsCompared,
      totalShipments,
      totalSavings,
      currentCost,
      savingsPercentage,
      topPerformer: topPerformer.account
    };
  }, [shipmentRates, shipmentData]);

  // Calculate account summary metrics
  const accountSummaries = useMemo(() => {
    const accounts: Record<string, {
      accountName: string;
      totalSpend: number;
      shipmentsQuoted: number;
      savingsData: { dollarSavings: number; percentSavings: number }[];
      wins: number;
      maxSavingsPercent: number;
    }> = {};

    // Group rates by account and calculate metrics
    shipmentRates.forEach(rate => {
      // Get tracking ID from the shipment data in the rate
      const trackingId = rate.shipment_data?.trackingId;
      if (!trackingId) return;
      
      const shipment = shipmentData.find(s => s.trackingId === trackingId);
      if (!shipment) return;

      if (!accounts[rate.account_name]) {
        accounts[rate.account_name] = {
          accountName: rate.account_name,
          totalSpend: 0,
          shipmentsQuoted: 0,
          savingsData: [],
          wins: 0,
          maxSavingsPercent: 0
        };
      }

      const account = accounts[rate.account_name];
      account.totalSpend += rate.rate_amount;
      account.shipmentsQuoted += 1;

      // Calculate savings for this shipment
      const dollarSavings = shipment.currentRate - rate.rate_amount;
      const percentSavings = shipment.currentRate > 0 ? (dollarSavings / shipment.currentRate) * 100 : 0;
      
      account.savingsData.push({ dollarSavings, percentSavings });
      
      // Check if this account won this shipment (is cheaper than current rate)
      if (rate.rate_amount < shipment.currentRate) {
        account.wins += 1;
      }

      // Track maximum savings percentage
      if (percentSavings > account.maxSavingsPercent) {
        account.maxSavingsPercent = percentSavings;
      }
    });

    // Calculate final metrics for each account
    return Object.values(accounts).map(account => {
      const avgCostPerShipment = account.totalSpend / account.shipmentsQuoted;
      const winRate = (account.wins / account.shipmentsQuoted) * 100;
      
      // Calculate average savings
      const avgDollarSavings = account.savingsData.reduce((sum, s) => sum + s.dollarSavings, 0) / account.savingsData.length;
      const avgPercentSavings = account.savingsData.reduce((sum, s) => sum + s.percentSavings, 0) / account.savingsData.length;
      
      // Calculate median savings
      const sortedDollarSavings = [...account.savingsData].map(s => s.dollarSavings).sort((a, b) => a - b);
      const sortedPercentSavings = [...account.savingsData].map(s => s.percentSavings).sort((a, b) => a - b);
      const medianDollarSavings = sortedDollarSavings[Math.floor(sortedDollarSavings.length / 2)] || 0;
      const medianPercentSavings = sortedPercentSavings[Math.floor(sortedPercentSavings.length / 2)] || 0;

      return {
        ...account,
        avgCostPerShipment,
        winRate,
        avgDollarSavings,
        avgPercentSavings,
        medianDollarSavings,
        medianPercentSavings,
        totalShipments: shipmentData.length
      };
    }).sort((a, b) => b.avgDollarSavings - a.avgDollarSavings); // Sort by average savings descending
  }, [shipmentRates, shipmentData]);

  // Calculate service breakdown by service type
  const serviceBreakdowns = useMemo(() => {
    // Get all unique services
    const services = [...new Set([
      ...shipmentRates.map(rate => rate.service_name || rate.service_code),
      ...shipmentData.map(shipment => shipment.service)
    ].filter(Boolean))];

    console.log('Service breakdown calculation:', { services });

    return services.map(serviceName => {
      // Get rates for this service
      const serviceRates = shipmentRates.filter(rate => 
        (rate.service_name === serviceName || rate.service_code === serviceName)
      );
      
      // Get shipment data for this service  
      const serviceShipments = shipmentData.filter(shipment => 
        shipment.service === serviceName
      );

      console.log(`Service ${serviceName}:`, {
        serviceRatesCount: serviceRates.length,
        serviceShipmentsCount: serviceShipments.length,
        sampleRate: serviceRates[0],
        sampleShipment: serviceShipments[0]
      });

      // Group by account for this service
      const accountPerformance = [...new Set(serviceRates.map(rate => rate.account_name))]
        .map(accountName => {
          const accountRates = serviceRates.filter(rate => rate.account_name === accountName);
          
          // Calculate metrics based on rates (simpler approach)
          const totalCost = accountRates.reduce((sum, rate) => sum + (rate.rate_amount || 0), 0);
          const avgCost = accountRates.length > 0 ? totalCost / accountRates.length : 0;
          
          // Calculate savings by comparing rates to current shipment costs
          let totalSavings = 0;
          let winCount = 0;
          
          accountRates.forEach(rate => {
            // Find the corresponding shipment data by tracking ID
            const trackingId = rate.shipment_data?.trackingId;
            const correspondingShipment = serviceShipments.find(shipment => 
              shipment.trackingId === trackingId
            );
            
            if (correspondingShipment) {
              const savings = correspondingShipment.currentRate - rate.rate_amount;
              totalSavings += savings;
              if (savings > 0) winCount++;
            }
          });
          
          const avgSavings = accountRates.length > 0 ? totalSavings / accountRates.length : 0;
          const winRate = accountRates.length > 0 ? (winCount / accountRates.length) * 100 : 0;

          return {
            accountName,
            shipmentCount: accountRates.length,
            totalCost,
            avgCost,
            totalSavings,
            avgSavings,
            winRate
          };
        })
        .filter(account => account.shipmentCount > 0)
        .sort((a, b) => b.avgSavings - a.avgSavings);

      return {
        serviceName,
        totalShipments: serviceRates.length,
        accounts: accountPerformance
      };
    }).filter(service => service.totalShipments > 0);
  }, [shipmentRates, shipmentData]);

  // Initialize selected accounts with best performing account for each service
  useEffect(() => {
    if (serviceBreakdowns.length > 0) {
      const initialSelections: Record<string, string> = {};
      serviceBreakdowns.forEach(service => {
        // Check if shipments in this service have been optimized (have account property)
        const serviceShipments = shipmentData.filter(s => s.service === service.serviceName);
        const optimizedShipments = serviceShipments.filter(s => s.account);
        
        if (optimizedShipments.length > 0) {
          // Use the most common optimized account for this service
          const accountCounts = optimizedShipments.reduce((acc, s) => {
            const account = s.account!;
            acc[account] = (acc[account] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
          
          const mostUsedAccount = Object.entries(accountCounts)
            .sort(([,a], [,b]) => b - a)[0]?.[0];
          
          if (mostUsedAccount) {
            initialSelections[service.serviceName] = mostUsedAccount;
          }
        } else if (service.accounts.length > 0) {
          // No optimization yet, use best performing account
          initialSelections[service.serviceName] = service.accounts[0].accountName;
        }
      });
      setSelectedAccounts(initialSelections);
    }
  }, [serviceBreakdowns, shipmentData]);

  // Calculate optimized metrics based on current selections
  const optimizedMetrics = useMemo(() => {
    if (Object.keys(selectedAccounts).length === 0) {
      return null; // No selections made yet
    }

    let totalOptimizedSavings = 0;
    let optimizedShipments = 0;

    serviceBreakdowns.forEach(service => {
      const selectedAccount = selectedAccounts[service.serviceName];
      if (selectedAccount) {
        const accountPerformance = service.accounts.find(acc => acc.accountName === selectedAccount);
        if (accountPerformance) {
          totalOptimizedSavings += accountPerformance.totalSavings;
          optimizedShipments += accountPerformance.shipmentCount;
        }
      }
    });

    return {
      totalOptimizedSavings,
      optimizedShipments,
      servicesOptimized: Object.keys(selectedAccounts).length
    };
  }, [selectedAccounts, serviceBreakdowns]);

  // Check if optimization has already been applied
  const hasOptimizationApplied = useMemo(() => {
    return shipmentData.some(shipment => shipment.account);
  }, [shipmentData]);

  return (
    <div className="space-y-6">
      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-5 lg:grid-cols-5 gap-4">
        <SummaryStats
          title="Accounts Compared"
          value={kpiMetrics.accountsCompared}
          color="blue"
        />
        <SummaryStats
          title="Total Shipments"
          value={kpiMetrics.totalShipments.toLocaleString()}
          color="green"
        />
        <SummaryStats
          title="Current Cost"
          value={formatCurrency(kpiMetrics.currentCost)}
          color="blue"
        />
        <SummaryStats
          title="Savings"
          value={`${formatCurrency(kpiMetrics.totalSavings)} (${Math.round(kpiMetrics.savingsPercentage)}%)`}
          color={kpiMetrics.totalSavings >= 0 ? "green" : "red"}
        />
        <SummaryStats
          title="Top Performer"
          value={kpiMetrics.topPerformer}
          color="purple"
        />
      </div>

      {/* Account Summary Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Account Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accountSummaries.map((account) => (
            <Card key={account.accountName} className="p-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">{account.accountName}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Spend:</span>
                  <span className="font-medium">{formatCurrency(account.totalSpend)}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avg Cost/Shipment:</span>
                  <span className="font-medium">{formatCurrency(account.avgCostPerShipment)}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avg Savings:</span>
                  <span className={`font-medium ${account.avgDollarSavings >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(account.avgDollarSavings)} ({account.avgPercentSavings.toFixed(1)}%)
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Median Savings:</span>
                  <span className={`font-medium ${account.medianDollarSavings >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(account.medianDollarSavings)} ({account.medianPercentSavings.toFixed(1)}%)
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Win Rate:</span>
                  <span className="font-medium">{account.winRate.toFixed(1)}%</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipments Quoted:</span>
                  <span className="font-medium">{account.shipmentsQuoted} / {account.totalShipments}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Max Savings:</span>
                  <span className="font-medium text-green-600">{account.maxSavingsPercent.toFixed(1)}%</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Optimization Summary - Only show if optimization hasn't been applied yet */}
      {optimizedMetrics && !hasOptimizationApplied && (
        <div className="border border-primary/20 bg-card text-card-foreground rounded-lg p-6 shadow-lg">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-xl font-bold text-foreground">Custom Optimization Strategy</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {optimizedMetrics.servicesOptimized} services optimized • {optimizedMetrics.optimizedShipments} shipments
              </p>
            </div>
            <Button 
              onClick={applyOptimizations} 
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold px-6 py-3"
              size="lg"
            >
              Apply Strategy
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
              <div className="text-3xl font-bold text-green-700 dark:text-green-400">{formatCurrency(optimizedMetrics.totalOptimizedSavings)}</div>
              <div className="text-sm font-medium text-green-600 dark:text-green-500 mt-1">Projected Savings</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
              <div className="text-3xl font-bold text-blue-700 dark:text-blue-400">{optimizedMetrics.optimizedShipments}</div>
              <div className="text-sm font-medium text-blue-600 dark:text-blue-500 mt-1">Shipments</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800">
              <div className="text-3xl font-bold text-purple-700 dark:text-purple-400">{optimizedMetrics.servicesOptimized}</div>
              <div className="text-sm font-medium text-purple-600 dark:text-purple-500 mt-1">Services Optimized</div>
            </div>
          </div>
        </div>
      )}

      {/* Service Type Breakdown Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Performance by Service Type</h3>
        <div className="grid grid-cols-1 gap-6">
          {serviceBreakdowns.map((service) => (
            <Card key={service.serviceName} className="p-4">
              <CardHeader className="pb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-base font-semibold">{service.serviceName}</CardTitle>
                    <p className="text-sm text-muted-foreground">{service.totalShipments} shipments analyzed</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <label className="text-xs text-muted-foreground">Use Account:</label>
                    <Select
                      value={selectedAccounts[service.serviceName] || ''}
                      onValueChange={(value) => handleAccountSelection(service.serviceName, value)}
                    >
                      <SelectTrigger className="w-40 h-8 text-xs bg-background border z-50">
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border z-50">
                        {availableAccounts.map((account) => (
                          <SelectItem key={account} value={account} className="text-xs">
                            {account}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {service.accounts.map((account) => (
                    <div 
                      key={account.accountName} 
                      className={`border rounded-lg p-3 transition-all cursor-pointer hover:shadow-md ${
                        selectedAccounts[service.serviceName] === account.accountName
                          ? 'bg-primary/10 border-primary/50 ring-2 ring-primary/30'
                          : 'bg-muted/20 hover:bg-muted/30'
                      }`}
                      onClick={() => handleAccountSelection(service.serviceName, account.accountName)}
                    >
                      <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                        {account.accountName}
                        {selectedAccounts[service.serviceName] === account.accountName && (
                          <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">Selected</span>
                        )}
                      </h4>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Shipments:</span>
                          <span className="font-medium">{account.shipmentCount}</span>
                        </div>
                        
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Avg Cost:</span>
                          <span className="font-medium">{formatCurrency(account.avgCost)}</span>
                        </div>
                        
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Avg Savings:</span>
                          <span className={`font-medium ${account.avgSavings >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(account.avgSavings)}
                          </span>
                        </div>
                        
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Win Rate:</span>
                          <span className="font-medium">{account.winRate.toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};