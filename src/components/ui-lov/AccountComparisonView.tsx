import React, { useMemo, useState, useEffect, useRef } from 'react';
import { SummaryStats } from './SummaryStats';
import { Card, CardContent, CardHeader, CardTitle } from './Card';
import { formatCurrency } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { mapServiceToServiceCode } from '@/utils/serviceMapping';

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
  carrier?: string;
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
  
  // Ref to track if user has made manual selections
  const hasUserSelections = useRef(false);
  const isInitialized = useRef(false);
  
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
    hasUserSelections.current = true; // Mark that user has made selections
    const newSelections = {
      ...selectedAccounts,
      [serviceName]: accountName
    };
    setSelectedAccounts(newSelections);
    
    // Auto-apply optimization immediately
    if (onOptimizationChange) {
      onOptimizationChange(newSelections);
    }
  };

  // Handle selecting an account for all services
  const handleSelectAccountForAll = (accountName: string) => {
    hasUserSelections.current = true; // Mark that user has made selections
    const newSelections: Record<string, string> = {};
    serviceBreakdowns.forEach(service => {
      // Only set if this account has quotes for this service
      const hasAccountForService = service.accounts.some(acc => acc.accountName === accountName);
      if (hasAccountForService) {
        newSelections[service.serviceName] = accountName;
      } else {
        // Keep existing selection if account doesn't support this service
        newSelections[service.serviceName] = selectedAccounts[service.serviceName] || service.accounts[0]?.accountName;
      }
    });
    setSelectedAccounts(newSelections);
    
    // Auto-apply optimization immediately
    if (onOptimizationChange) {
      onOptimizationChange(newSelections);
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

      // Calculate total savings
      const totalSavings = account.savingsData.reduce((sum, s) => sum + s.dollarSavings, 0);
      const totalSavingsPercent = account.savingsData.length > 0 
        ? (totalSavings / account.savingsData.reduce((sum, s, i) => sum + (account.totalSpend / account.savingsData.length + s.dollarSavings), 0)) * 100 
        : 0;

      return {
        ...account,
        avgCostPerShipment,
        winRate,
        avgDollarSavings,
        avgPercentSavings,
        medianDollarSavings,
        medianPercentSavings,
        totalSavings,
        totalSavingsPercent,
        totalShipments: shipmentData.length
      };
    }).sort((a, b) => b.avgDollarSavings - a.avgDollarSavings); // Sort by average savings descending
  }, [shipmentRates, shipmentData]);

  // Group by Ship Pros service type and calculate metrics for each service
  const serviceBreakdowns = useMemo(() => {
    console.log('🔄 Calculating service breakdowns...');
    
    const breakdowns: Record<string, {
      serviceName: string;
      originalService: string;
      totalShipments: number;
      accounts: Array<{
        accountName: string;
        shipmentCount: number;
        totalCost: number;
        avgCost: number;
        totalSavings: number;
        avgSavings: number;
        winRate: number;
      }>;
    }> = {};

    // Group by Ship Pros services from rates, showing mapping from original
    const serviceGroups = new Map<string, { rates: any[], originalServices: Set<string> }>();
    
    shipmentRates.forEach(rate => {
      const shipProsService = rate.service_name;
      if (!shipProsService) return;
      
      if (!serviceGroups.has(shipProsService)) {
        serviceGroups.set(shipProsService, { rates: [], originalServices: new Set() });
      }
      
      const group = serviceGroups.get(shipProsService)!;
      group.rates.push(rate);
      
      // Find the original service from shipment data
      const originalShipment = shipmentData.find(s => 
        s.trackingId === rate.shipment_data?.trackingId
      );
      if (originalShipment?.service) {
        group.originalServices.add(originalShipment.service);
      }
    });

    // Also include services from shipment data that don't have rates yet
    shipmentData.forEach(shipment => {
      if (!shipment.service) return;
      
      // Use service mapping to determine what Ship Pros service this would map to
      const mapping = mapServiceToServiceCode(shipment.service);
      const shipProsService = mapping.serviceName;
      
      if (!serviceGroups.has(shipProsService)) {
        serviceGroups.set(shipProsService, { rates: [], originalServices: new Set() });
      }
      
      serviceGroups.get(shipProsService)!.originalServices.add(shipment.service);
    });

    serviceGroups.forEach((group, shipProsService) => {
      const { rates, originalServices } = group;
      const originalServicesList = Array.from(originalServices);
      const displayOriginal = originalServicesList.length > 0 ? originalServicesList.join(', ') : shipProsService;
      
      console.log(`📊 Ship Pros Service: ${shipProsService}, Original: ${displayOriginal}, Rates: ${rates.length}`);

      if (rates.length > 0) {
        // Group rates by account
        const accountGroups = rates.reduce((groups, rate) => {
          const accountName = rate.account_name || 'Unknown';
          if (!groups[accountName]) {
            groups[accountName] = [];
          }
          groups[accountName].push(rate);
          return groups;
        }, {} as Record<string, typeof rates>);

        // Calculate metrics for each account
        const accounts = Object.entries(accountGroups).map(([accountName, accountRates]: [string, any[]]) => {
          const totalCost = accountRates.reduce((sum, rate) => sum + (rate.rate_amount || 0), 0);
          
          // Find corresponding shipment data to calculate savings
          const shipmentSavings = accountRates.map(rate => {
            const shipment = shipmentData.find(s => 
              s.trackingId === rate.shipment_data?.trackingId
            );
            return shipment?.savings || 0;
          });
          
          const totalSavings = shipmentSavings.reduce((sum, savings) => sum + savings, 0);
          const avgSavings = shipmentSavings.length > 0 ? totalSavings / shipmentSavings.length : 0;
          const avgCost = accountRates.length > 0 ? totalCost / accountRates.length : 0;
          
          // Calculate win rate (percentage of times this account had the lowest rate)
          const wins = accountRates.filter(rate => {
            const trackingId = rate.shipment_data?.trackingId;
            if (!trackingId) return false;
            
            const allRatesForShipment = rates.filter(r => 
              r.shipment_data?.trackingId === trackingId
            );
            
            if (allRatesForShipment.length <= 1) return true;
            
            const minCost = Math.min(...allRatesForShipment.map(r => r.rate_amount || Infinity));
            return (rate.rate_amount || Infinity) === minCost;
          }).length;
          
          const winRate = accountRates.length > 0 ? (wins / accountRates.length) * 100 : 0;

          return {
            accountName,
            shipmentCount: accountRates.length,
            totalCost,
            avgCost,
            totalSavings,
            avgSavings,
            winRate
          };
        });

        breakdowns[shipProsService] = {
          serviceName: shipProsService,
          originalService: displayOriginal,
          totalShipments: rates.length,
          accounts: accounts.sort((a, b) => b.avgSavings - a.avgSavings)
        };
      } else {
        // Handle services with shipment data but no rates
        const serviceShipments = shipmentData.filter(shipment => {
          const mapping = mapServiceToServiceCode(shipment.service || '');
          return mapping.serviceName === shipProsService;
        });

        if (serviceShipments.length > 0) {
          const accountGroups = serviceShipments.reduce((groups, shipment) => {
            let accountName = shipment.accountName || shipment.account;
            
            if (!accountName && shipment.trackingId) {
              const matchingRate = shipmentRates.find(rate => 
                rate.shipment_data?.trackingId === shipment.trackingId
              );
              if (matchingRate) {
                accountName = matchingRate.account_name;
              }
            }
            
            if (!accountName) {
              accountName = 'Unknown Account';
            }
            
            if (!groups[accountName]) {
              groups[accountName] = [];
            }
            groups[accountName].push(shipment);
            return groups;
          }, {} as Record<string, typeof serviceShipments>);

          const accounts = Object.entries(accountGroups).map(([accountName, shipments]) => {
            const totalCost = shipments.reduce((sum, shipment) => sum + (shipment.currentRate || 0), 0);
            const totalSavings = shipments.reduce((sum, shipment) => sum + (shipment.savings || 0), 0);
            const avgSavings = shipments.length > 0 ? totalSavings / shipments.length : 0;
            const avgCost = shipments.length > 0 ? totalCost / shipments.length : 0;
            
            return {
              accountName,
              shipmentCount: shipments.length,
              totalCost,
              avgCost,
              totalSavings,
              avgSavings,
              winRate: 100
            };
          });

          breakdowns[shipProsService] = {
            serviceName: shipProsService,
            originalService: displayOriginal,
            totalShipments: serviceShipments.length,
            accounts
          };
        }
      }
    });

    console.log('📊 Final service breakdowns:', Object.keys(breakdowns));
    return Object.values(breakdowns).filter(service => service.totalShipments > 0);
  }, [shipmentRates, shipmentData]);

  // Initialize selected accounts with best performing account for each service
  useEffect(() => {
    // Only initialize if we haven't initialized yet and user hasn't made selections
    if (serviceBreakdowns.length > 0 && !isInitialized.current && !hasUserSelections.current) {
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
      isInitialized.current = true;
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

  // Check if an account is selected for all available services
  const isAccountSelectedForAll = (accountName: string) => {
    const servicesWithAccount = serviceBreakdowns.filter(service => 
      service.accounts.some(acc => acc.accountName === accountName)
    );
    
    return servicesWithAccount.every(service => 
      selectedAccounts[service.serviceName] === accountName
    ) && servicesWithAccount.length > 0;
  };

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
            <Card 
              key={account.accountName} 
              className={`p-4 cursor-pointer transition-all hover:shadow-lg ${
                isAccountSelectedForAll(account.accountName)
                  ? 'bg-primary/10 border-primary/50 ring-2 ring-primary/30'
                  : 'hover:bg-muted/30'
              }`}
              onClick={() => handleSelectAccountForAll(account.accountName)}
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  {account.accountName}
                  {isAccountSelectedForAll(account.accountName) && (
                    <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">Selected for All</span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <TooltipProvider>
                  <div className="flex justify-between">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-muted-foreground cursor-help">Total Spend:</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Total amount spent across all shipments with this carrier account</p>
                      </TooltipContent>
                    </Tooltip>
                    <span className="font-medium">{formatCurrency(account.totalSpend)}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-muted-foreground cursor-help">Total Savings:</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Total savings compared to current rates across all shipments</p>
                      </TooltipContent>
                    </Tooltip>
                    <span className={`font-medium ${account.totalSavings >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(account.totalSavings)} ({account.totalSavingsPercent.toFixed(1)}%)
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-muted-foreground cursor-help">Avg Savings:</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Average savings per shipment compared to current rates</p>
                      </TooltipContent>
                    </Tooltip>
                    <span className={`font-medium ${account.avgDollarSavings >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(account.avgDollarSavings)} ({account.avgPercentSavings.toFixed(1)}%)
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-muted-foreground cursor-help">Median Savings:</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Middle value of savings when all shipment savings are ordered from least to greatest</p>
                      </TooltipContent>
                    </Tooltip>
                    <span className={`font-medium ${account.medianDollarSavings >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(account.medianDollarSavings)} ({account.medianPercentSavings.toFixed(1)}%)
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-muted-foreground cursor-help">Avg Cost/Shipment:</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Average shipping cost per shipment with this carrier account</p>
                      </TooltipContent>
                    </Tooltip>
                    <span className="font-medium">{formatCurrency(account.avgCostPerShipment)}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-muted-foreground cursor-help">Win Rate:</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Percentage of shipments where this account offers lower rates than current carrier</p>
                      </TooltipContent>
                    </Tooltip>
                    <span className="font-medium">{account.winRate.toFixed(1)}%</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-muted-foreground cursor-help">Shipments Quoted:</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Number of shipments this account provided quotes for out of total shipments</p>
                      </TooltipContent>
                    </Tooltip>
                    <span className="font-medium">{account.shipmentsQuoted} / {account.totalShipments}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-muted-foreground cursor-help">Max Savings:</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Highest percentage savings achieved on a single shipment with this account</p>
                      </TooltipContent>
                    </Tooltip>
                    <span className="font-medium text-green-600">{account.maxSavingsPercent.toFixed(1)}%</span>
                  </div>
                </TooltipProvider>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>


      {/* Service Type Breakdown Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Performance by Service Type</h3>
        <div className="grid grid-cols-1 gap-6">
          {serviceBreakdowns.map((service) => (
            <Card key={service.serviceName} className="p-4">
              <CardHeader className="pb-4">
                 <div className="flex justify-between items-start">
                   <div>
                     <CardTitle className="text-base font-semibold">
                       {service.originalService !== service.serviceName ? (
                         <>
                           <span className="text-muted-foreground">{service.originalService}</span>
                           <span className="mx-2">➡︎</span>
                           <span>{service.serviceName}</span>
                         </>
                       ) : (
                         service.serviceName
                       )}
                     </CardTitle>
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
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {service.accounts.map((account) => (
                    <div 
                      key={account.accountName} 
                      className={`border rounded-lg p-2 transition-all cursor-pointer hover:shadow-md ${
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