import React, { useMemo } from 'react';
import { SummaryStats } from './SummaryStats';
import { DollarSign, Package, Target, TruckIcon, Calculator } from 'lucide-react';
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
    const shipmentBestRates: Record<number, { account: string; rate: number; currentRate: number }> = {};
    
    shipmentRates.forEach(rate => {
      const shipmentIndex = rate.shipment_index;
      const currentShipment = shipmentData.find(s => s.id === shipmentIndex + 1);
      
      if (currentShipment) {
        if (!shipmentBestRates[shipmentIndex] || rate.rate_amount < shipmentBestRates[shipmentIndex].rate) {
          shipmentBestRates[shipmentIndex] = {
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
    </div>
  );
};