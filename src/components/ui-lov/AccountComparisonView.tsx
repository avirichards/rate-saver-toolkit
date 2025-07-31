import React, { useMemo, useState, useEffect } from 'react';
import { SummaryStats } from './SummaryStats';
import { Card, CardContent, CardHeader, CardTitle } from './Card';
import { formatCurrency } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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
  ShipPros_cost: number;
  savings: number;
  customer_service: string;
  weight: number;
  account?: string;
  accountName?: string;
}

interface AccountComparisonViewProps {
  shipmentRates: ShipmentRate[];
  shipmentData: ProcessedShipmentData[];
  serviceMappings?: any[];
  onOptimizationChange?: (selections: Record<string, string>) => void;
}

export const AccountComparisonView: React.FC<AccountComparisonViewProps> = ({
  shipmentRates,
  shipmentData,
  serviceMappings = [],
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
    
    // Auto-apply optimization immediately
    if (onOptimizationChange) {
      onOptimizationChange(newSelections);
    }
  };

  // Handle selecting an account for all services
  const handleSelectAccountForAll = (accountName: string) => {
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

    // Find top performing account by calculating total cost per account (lowest total cost = best performer)
    const accountTotalCosts: Record<string, { totalCost: number; shipmentCount: number }> = {};
    
    // Now find the best rates per shipment per account to calculate true total costs
    const accountOptimalCosts: Record<string, number> = {};
    const processedShipments = new Set<string>();
    
    // Group rates by shipment first (using improved matching logic)
    const ratesByShipment: Record<string, ShipmentRate[]> = {};
    shipmentRates.forEach(rate => {
      // Try multiple ways to match rates with shipment data (same logic as account summaries)
      let shipment;
      
      // First try tracking ID match
      const trackingId = rate.shipment_data?.trackingId;
      if (trackingId) {
        shipment = shipmentData.find(s => s.trackingId === trackingId);
      }
      
      // If no match, try matching by the ID field in rate.shipment_data with shipment.id
      if (!shipment && rate.shipment_data?.id) {
        shipment = shipmentData.find(s => s.id === rate.shipment_data.id);
      }
      
      // If still no match, try matching by shipment index
      if (!shipment && typeof rate.shipment_index === 'number') {
        shipment = shipmentData[rate.shipment_index];
      }
      
      if (!shipment) return;
      
      const shipmentKey = shipment.trackingId || String(shipment.id);
      if (!shipmentKey) return;
      
      if (!ratesByShipment[shipmentKey]) {
        ratesByShipment[shipmentKey] = [];
      }
      ratesByShipment[shipmentKey].push(rate);
    });
    
    // For each shipment, find the best rate each account can offer
    Object.entries(ratesByShipment).forEach(([shipmentKey, rates]) => {
      // Group rates by account for this shipment
      const ratesByAccount: Record<string, number> = {};
      rates.forEach(rate => {
        if (!ratesByAccount[rate.account_name] || rate.rate_amount < ratesByAccount[rate.account_name]) {
          ratesByAccount[rate.account_name] = rate.rate_amount;
        }
      });
      
      // Add the best rate from each account to their total
      Object.entries(ratesByAccount).forEach(([accountName, bestRate]) => {
        accountOptimalCosts[accountName] = (accountOptimalCosts[accountName] || 0) + bestRate;
      });
      
      processedShipments.add(shipmentKey);
    });

    // Find top performer (account with lowest total optimal cost)
    const topPerformer = Object.entries(accountOptimalCosts).reduce((best, [account, totalCost]) => {
      return totalCost < best.totalCost ? { account, totalCost } : best;
    }, { account: 'N/A', totalCost: Infinity });

    console.log('🏆 Top Performer Calculation:', {
      accountOptimalCosts,
      topPerformer,
      processedShipments: processedShipments.size,
      totalShipments
    });

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
      shipmentsQuoted: Set<string>;
      savingsData: { dollarSavings: number; percentSavings: number }[];
      wins: number;
    }> = {};

    // Debug logging to understand the data structure
    console.log('🔍 Account Summary Debug:', {
      shipmentRatesCount: shipmentRates.length,
      shipmentDataCount: shipmentData.length,
      sampleRate: shipmentRates[0],
      sampleShipment: shipmentData[0]
    });

    // First, create a structure to track which shipments each account can quote
    const accountShipmentData: Record<string, Record<string, {
      rate: number;
      shipment: ProcessedShipmentData;
      dollarSavings: number;
      percentSavings: number;
    }>> = {};

    // Process each rate and only keep the best rate per account per shipment
    shipmentRates.forEach(rate => {
      // Try multiple ways to match rates with shipment data
      let shipment;
      
      // First try tracking ID match
      const trackingId = rate.shipment_data?.trackingId;
      if (trackingId) {
        shipment = shipmentData.find(s => s.trackingId === trackingId);
      }
      
      // If no match, try matching by the ID field in rate.shipment_data with shipment.id
      if (!shipment && rate.shipment_data?.id) {
        shipment = shipmentData.find(s => s.id === rate.shipment_data.id);
      }
      
      // If still no match, try matching by shipment index
      if (!shipment && typeof rate.shipment_index === 'number') {
        shipment = shipmentData[rate.shipment_index];
      }
      
      if (!shipment) {
        console.log('⚠️ No shipment found for rate:', {
          rateId: rate.id,
          trackingId: rate.shipment_data?.trackingId,
          shipmentDataId: rate.shipment_data?.id,
          shipmentIndex: rate.shipment_index,
          availableShipments: shipmentData.slice(0, 3).map(s => ({ id: s.id, trackingId: s.trackingId }))
        });
        return;
      }
      
      // Use a unique key that works for the matched shipment
      const shipmentKey = shipment.trackingId || String(shipment.id);
      
      if (!shipmentKey) {
        console.log('⚠️ Shipment has no valid key:', shipment);
        return;
      }

      if (!accountShipmentData[rate.account_name]) {
        accountShipmentData[rate.account_name] = {};
      }

      // Only use the best (lowest) rate for each shipment per account
      if (!accountShipmentData[rate.account_name][shipmentKey] || 
          rate.rate_amount < accountShipmentData[rate.account_name][shipmentKey].rate) {
        
        const dollarSavings = shipment.currentRate - rate.rate_amount;
        const percentSavings = shipment.currentRate > 0 ? (dollarSavings / shipment.currentRate) * 100 : 0;
        
        accountShipmentData[rate.account_name][shipmentKey] = {
          rate: rate.rate_amount,
          shipment,
          dollarSavings,
          percentSavings
        };
      }
    });

    console.log('📊 Account Shipment Data:', accountShipmentData);

    // Now calculate metrics based on the best rates
    Object.entries(accountShipmentData).forEach(([accountName, shipmentDataMap]) => {
      accounts[accountName] = {
        accountName,
        totalSpend: 0,
        shipmentsQuoted: new Set<string>(),
        savingsData: [],
        wins: 0
      };

      const account = accounts[accountName];
      
      Object.entries(shipmentDataMap).forEach(([trackingId, data]) => {
        account.totalSpend += data.rate;
        account.shipmentsQuoted.add(trackingId);
        account.savingsData.push({ 
          dollarSavings: data.dollarSavings, 
          percentSavings: data.percentSavings 
        });
        
        // Check if this account won this shipment (provides savings vs current rate)
        if (data.dollarSavings > 0) {
          account.wins += 1;
        }
      });

      console.log(`📋 ${accountName} Summary:`, {
        shipmentsQuoted: account.shipmentsQuoted.size,
        totalSpend: account.totalSpend,
        wins: account.wins
      });
    });

    // Calculate final metrics for each account
    return Object.values(accounts).map(account => {
      const shipmentsQuotedCount = account.shipmentsQuoted.size;
      const avgCostPerShipment = shipmentsQuotedCount > 0 ? account.totalSpend / shipmentsQuotedCount : 0;
      const winRate = shipmentsQuotedCount > 0 ? (account.wins / shipmentsQuotedCount) * 100 : 0;
      
      // Calculate average savings
      const avgDollarSavings = account.savingsData.length > 0 
        ? account.savingsData.reduce((sum, s) => sum + s.dollarSavings, 0) / account.savingsData.length 
        : 0;
      const avgPercentSavings = account.savingsData.length > 0 
        ? account.savingsData.reduce((sum, s) => sum + s.percentSavings, 0) / account.savingsData.length 
        : 0;
      
      // Calculate median savings (properly handle even-length arrays)
      const sortedDollarSavings = [...account.savingsData].map(s => s.dollarSavings).sort((a, b) => a - b);
      const sortedPercentSavings = [...account.savingsData].map(s => s.percentSavings).sort((a, b) => a - b);
      
      const medianDollarSavings = sortedDollarSavings.length > 0 
        ? sortedDollarSavings.length % 2 === 0
          ? (sortedDollarSavings[sortedDollarSavings.length / 2 - 1] + sortedDollarSavings[sortedDollarSavings.length / 2]) / 2
          : sortedDollarSavings[Math.floor(sortedDollarSavings.length / 2)]
        : 0;
      
      const medianPercentSavings = sortedPercentSavings.length > 0 
        ? sortedPercentSavings.length % 2 === 0
          ? (sortedPercentSavings[sortedPercentSavings.length / 2 - 1] + sortedPercentSavings[sortedPercentSavings.length / 2]) / 2
          : sortedPercentSavings[Math.floor(sortedPercentSavings.length / 2)]
        : 0;

      // Calculate total savings and percentage
      const totalSavings = account.savingsData.reduce((sum, s) => sum + s.dollarSavings, 0);
      
      // Calculate original total cost for shipments this account can quote
      // Original cost = account's total spend + total savings (what customer currently pays)
      const originalTotalCost = account.totalSpend + totalSavings;
      const totalSavingsPercent = originalTotalCost > 0 ? (totalSavings / originalTotalCost) * 100 : 0;

      return {
        ...account,
        shipmentsQuoted: shipmentsQuotedCount,
        avgCostPerShipment,
        winRate,
        avgDollarSavings,
        avgPercentSavings,
        medianDollarSavings,
        medianPercentSavings,
        totalSavings,
        totalSavingsPercent
      };
    }).sort((a, b) => {
      // Sort to match KPI summary order (top performer first, then by total spend)
      const topPerformer = kpiMetrics.topPerformer;
      if (a.accountName === topPerformer) return -1;
      if (b.accountName === topPerformer) return 1;
      // Then sort by total spend (descending) to match typical account importance
      return b.totalSpend - a.totalSpend;
    });
  }, [shipmentRates, shipmentData, kpiMetrics.topPerformer]);

  // Helper function to get UPS service mapping for a customer service
  const getUpsServiceForCustomerService = (customerService: string) => {
    const mapping = serviceMappings?.find(mapping => 
      mapping.original_service === customerService || 
      mapping.customer_service === customerService
    );
    return mapping?.standardized || mapping?.ShipPros_service || customerService;
  };

  // Calculate service breakdown by customer service type
  const serviceBreakdowns = useMemo(() => {
    // Get all unique customer services from shipment data
    const customerServices = [...new Set(shipmentData.map(shipment => shipment.customer_service))].filter(Boolean);

    console.log('Service breakdown calculation (customer services):', { customerServices, serviceMappings });

    return customerServices.map(customerService => {
      // Get UPS equivalent service for rate lookup
      const upsService = getUpsServiceForCustomerService(customerService);
      
      // Get shipment data for this customer service  
      const serviceShipments = shipmentData.filter(shipment => 
        shipment.customer_service === customerService
      );

      // Get rates for the UPS equivalent service (using improved matching logic)
      const serviceRates = shipmentRates.filter(rate => {
        // Check if any shipment with this customer service has rates using improved matching
        return serviceShipments.some(shipment => {
          // Try multiple matching strategies
          if (rate.shipment_data?.trackingId === shipment.trackingId) return true;
          if (rate.shipment_data?.id === shipment.id) return true;
          if (typeof rate.shipment_index === 'number' && shipmentData[rate.shipment_index]?.id === shipment.id) return true;
          return false;
        });
      });

      console.log(`Customer Service ${customerService} → UPS ${upsService}:`, {
        serviceRatesCount: serviceRates.length,
        serviceShipmentsCount: serviceShipments.length,
        sampleRate: serviceRates[0],
        sampleShipment: serviceShipments[0]
      });

      // Create deduplicated shipment data per account to prevent double counting
      const accountShipmentData: Record<string, Record<string, {
        rate: number;
        shipment: ProcessedShipmentData;
        dollarSavings: number;
      }>> = {};

      // Process rates and only keep the best rate per shipment per account
      serviceRates.forEach(rate => {
        // Find the corresponding shipment data using improved matching logic
        let correspondingShipment = serviceShipments.find(shipment => 
          shipment.trackingId === rate.shipment_data?.trackingId
        );
        
        // If no match, try alternative matching
        if (!correspondingShipment) {
          correspondingShipment = serviceShipments.find(shipment => 
            shipment.id === rate.shipment_data?.id
          );
        }
        
        // If still no match, try matching by shipment index
        if (!correspondingShipment && typeof rate.shipment_index === 'number') {
          correspondingShipment = serviceShipments.find(shipment => 
            shipment.id === rate.shipment_index + 1
          );
        }
        
        if (correspondingShipment) {
          const shipmentKey = correspondingShipment.trackingId || String(correspondingShipment.id);
          
          if (!accountShipmentData[rate.account_name]) {
            accountShipmentData[rate.account_name] = {};
          }
          
          // Only keep the best (lowest) rate per shipment per account
          if (!accountShipmentData[rate.account_name][shipmentKey] || 
              rate.rate_amount < accountShipmentData[rate.account_name][shipmentKey].rate) {
            
            const dollarSavings = correspondingShipment.currentRate - rate.rate_amount;
            
            accountShipmentData[rate.account_name][shipmentKey] = {
              rate: rate.rate_amount,
              shipment: correspondingShipment,
              dollarSavings
            };
          }
        }
      });

      // Calculate performance metrics from deduplicated data
      const accountPerformance = Object.entries(accountShipmentData)
        .map(([accountName, shipmentRatesMap]) => {
          const shipmentDataArray = Object.values(shipmentRatesMap);
          
          const totalCost = shipmentDataArray.reduce((sum, data) => sum + data.rate, 0);
          const totalSavings = shipmentDataArray.reduce((sum, data) => sum + data.dollarSavings, 0);
          const winCount = shipmentDataArray.filter(data => data.dollarSavings > 0).length;
          const shipmentCount = shipmentDataArray.length;
          
          const avgCost = shipmentCount > 0 ? totalCost / shipmentCount : 0;
          const avgSavings = shipmentCount > 0 ? totalSavings / shipmentCount : 0;
          const winRate = shipmentCount > 0 ? (winCount / shipmentCount) * 100 : 0;

          return {
            accountName,
            shipmentCount,
            totalCost,
            avgCost,
            totalSavings,
            avgSavings,
            winRate
          };
        })
        .filter(account => account.shipmentCount > 0)
        .sort((a, b) => {
          // Sort to match the account summary order
          const aIndex = accountSummaries.findIndex(acc => acc.accountName === a.accountName);
          const bIndex = accountSummaries.findIndex(acc => acc.accountName === b.accountName);
          if (aIndex === -1 && bIndex === -1) return b.avgSavings - a.avgSavings;
          if (aIndex === -1) return 1;
          if (bIndex === -1) return -1;
          return aIndex - bIndex;
        });

      return {
        serviceName: customerService,
        upsServiceName: upsService,
        totalShipments: serviceShipments.length,
        accounts: accountPerformance
      };
    }).filter(service => service.totalShipments > 0);
  }, [shipmentRates, shipmentData, serviceMappings, accountSummaries]);

  // Initialize selected accounts with what's actually being used in shipment data
  useEffect(() => {
    if (serviceBreakdowns.length > 0) {
      const initialSelections: Record<string, string> = {};
      serviceBreakdowns.forEach(service => {
        // Get all shipments for this service
        const serviceShipments = shipmentData.filter(s => s.customer_service === service.serviceName);
        
        if (serviceShipments.length > 0) {
          // Find what account is actually being used for this service
          const accountCounts = serviceShipments.reduce((acc, s) => {
            // Check multiple possible account fields
            const account = s.account || s.accountName;
            if (account && account !== 'Default Account' && account !== 'unknown') {
              acc[account] = (acc[account] || 0) + 1;
            }
            return acc;
          }, {} as Record<string, number>);
          
          const mostUsedAccount = Object.entries(accountCounts)
            .sort(([,a], [,b]) => b - a)[0]?.[0];
          
          if (mostUsedAccount) {
            initialSelections[service.serviceName] = mostUsedAccount;
            console.log(`🔍 Initialized ${service.serviceName} with currently used account: ${mostUsedAccount}`);
          } else if (service.accounts.length > 0) {
            // Fallback to best performing account if no actual usage found
            initialSelections[service.serviceName] = service.accounts[0].accountName;
            console.log(`🔍 Initialized ${service.serviceName} with best performing account: ${service.accounts[0].accountName}`);
          }
        } else if (service.accounts.length > 0) {
          // No shipments for this service, use best performing account
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
                    <span className="font-medium">{account.shipmentsQuoted} / {kpiMetrics.totalShipments}</span>
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
                      {service.serviceName}
                      {service.upsServiceName && service.upsServiceName !== service.serviceName && (
                        <span className="text-xs font-normal text-muted-foreground ml-2">
                          → {service.upsServiceName}
                        </span>
                      )}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {service.totalShipments} shipments analyzed
                    </p>
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
                           <span className="text-muted-foreground">Total Spend:</span>
                           <span className="font-medium">{formatCurrency(account.totalCost)}</span>
                         </div>
                         
                         <div className="flex justify-between">
                           <span className="text-muted-foreground">Total Savings:</span>
                           <span className={`font-medium ${account.totalSavings >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                             {formatCurrency(account.totalSavings)}
                           </span>
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