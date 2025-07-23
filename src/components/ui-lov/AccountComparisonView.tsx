import React, { useMemo, useState } from 'react';
import { SummaryStats } from './SummaryStats';
import { DollarSign, Package, Target, TruckIcon } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts';

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
  // Filter state
  const [selectedServiceTypes, setSelectedServiceTypes] = useState<string[]>(['Ground', '2-Day', 'Overnight']);
  const [selectedWeightBands, setSelectedWeightBands] = useState<string[]>(['0-10', '11-50', '50+']);
  // Calculate KPI metrics from existing data
  const kpiMetrics = useMemo(() => {
    // Get unique accounts from shipment rates
    const uniqueAccounts = new Set(shipmentRates.map(rate => rate.account_name));
    const accountsCompared = uniqueAccounts.size;

    // Total shipments from shipment data
    const totalShipments = shipmentData.length;

    // Calculate total savings from shipment data
    const totalSavings = shipmentData.reduce((sum, shipment) => sum + (shipment.savings || 0), 0);

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

    return {
      accountsCompared,
      totalShipments,
      totalSavings,
      topPerformer: topPerformer.account
    };
  }, [shipmentRates, shipmentData]);

  // Calculate chart data based on filters
  const chartData = useMemo(() => {
    const accounts = Array.from(new Set(shipmentRates.map(rate => rate.account_name)));
    
    return accounts.map(account => {
      const accountRates = shipmentRates.filter(rate => rate.account_name === account);
      const totalShipments = accountRates.length;
      const winningShipments = accountRates.filter(rate => {
        // Find if this rate is the best for its shipment
        const allRatesForShipment = shipmentRates.filter(r => r.shipment_index === rate.shipment_index);
        const bestRate = Math.min(...allRatesForShipment.map(r => r.rate_amount));
        return rate.rate_amount === bestRate;
      }).length;
      
      const winRate = totalShipments > 0 ? (winningShipments / totalShipments) * 100 : 0;
      
      // Calculate average savings
      let totalSavings = 0;
      let savingsCount = 0;
      accountRates.forEach(rate => {
        const shipment = shipmentData.find(s => s.id === rate.shipment_index + 1);
        if (shipment) {
          totalSavings += shipment.currentRate - rate.rate_amount;
          savingsCount++;
        }
      });
      const avgSavings = savingsCount > 0 ? totalSavings / savingsCount : 0;

      return {
        account,
        winRate: Math.round(winRate),
        avgSavings: Math.round(avgSavings)
      };
    });
  }, [shipmentRates, shipmentData, selectedServiceTypes, selectedWeightBands]);

  return (
    <div className="space-y-6">
      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryStats
          title="Accounts Compared"
          value={kpiMetrics.accountsCompared}
          icon={<Target />}
          color="blue"
        />
        <SummaryStats
          title="Total Shipments"
          value={kpiMetrics.totalShipments.toLocaleString()}
          icon={<Package />}
          color="green"
        />
        <SummaryStats
          title="Total Savings"
          value={formatCurrency(kpiMetrics.totalSavings)}
          icon={<DollarSign />}
          color={kpiMetrics.totalSavings >= 0 ? "green" : "red"}
        />
        <SummaryStats
          title="Top Performer"
          value={kpiMetrics.topPerformer}
          icon={<TruckIcon />}
          color="purple"
        />
      </div>

      {/* Filter Pills */}
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-2 block">Service Type</label>
          <ToggleGroup 
            type="multiple" 
            value={selectedServiceTypes}
            onValueChange={setSelectedServiceTypes}
            className="justify-start"
          >
            <ToggleGroupItem value="Ground" variant="outline">Ground</ToggleGroupItem>
            <ToggleGroupItem value="2-Day" variant="outline">2-Day</ToggleGroupItem>
            <ToggleGroupItem value="Overnight" variant="outline">Overnight</ToggleGroupItem>
          </ToggleGroup>
        </div>
        
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-2 block">Weight Band</label>
          <ToggleGroup 
            type="multiple" 
            value={selectedWeightBands}
            onValueChange={setSelectedWeightBands}
            className="justify-start"
          >
            <ToggleGroupItem value="0-10" variant="outline">0–10 lbs</ToggleGroupItem>
            <ToggleGroupItem value="11-50" variant="outline">11–50 lbs</ToggleGroupItem>
            <ToggleGroupItem value="50+" variant="outline">50+ lbs</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {/* Mini Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Win Rate by Account</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData}>
                <XAxis dataKey="account" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Bar dataKey="winRate" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Average Savings by Account</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData}>
                <XAxis dataKey="account" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Bar dataKey="avgSavings" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};