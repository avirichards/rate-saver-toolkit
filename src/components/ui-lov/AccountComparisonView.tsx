import React, { useMemo } from 'react';
import { SummaryStats } from './SummaryStats';
import { Card, CardContent, CardHeader, CardTitle } from './Card';
import { formatCurrency } from '@/lib/utils';

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
}

interface AccountComparisonViewProps {
  shipmentRates: ShipmentRate[];
  shipmentData: ProcessedShipmentData[];
}

export const AccountComparisonView: React.FC<AccountComparisonViewProps> = ({
  shipmentRates,
  shipmentData
}) => {
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
    </div>
  );
};