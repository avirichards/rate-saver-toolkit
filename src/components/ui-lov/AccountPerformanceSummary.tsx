import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui-lov/Button';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, TrendingUp, TrendingDown } from 'lucide-react';
import { formatCurrency, getSavingsColor } from '@/lib/utils';

interface AccountPerformance {
  rank: number;
  accountName: string;
  shipmentCount: number;
  shipProsCost: number;
  currentCost: number;
  grossSavings: number;
  savingsPercent: number;
  accountType: string;
}

interface AccountPerformanceSummaryProps {
  accounts: AccountPerformance[];
  onAccountSelect: (accountName: string) => void;
  onDrillDown: (level: 2) => void;
}

export function AccountPerformanceSummary({ 
  accounts, 
  onAccountSelect, 
  onDrillDown 
}: AccountPerformanceSummaryProps) {
  const sortedAccounts = [...accounts].sort((a, b) => b.grossSavings - a.grossSavings);

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Account Performance Summary</h2>
          <p className="text-sm text-muted-foreground">Overall performance ranking across all shipments</p>
        </div>
        <Button
          variant="outline"
          onClick={() => onDrillDown(2)}
          className="gap-2"
        >
          View by Service Type
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-7 gap-4 px-4 py-2 text-xs font-medium text-muted-foreground border-b">
          <div>Rank</div>
          <div>Account</div>
          <div className="text-right">Shipments</div>
          <div className="text-right">Ship Pros Cost</div>
          <div className="text-right">Current Cost</div>
          <div className="text-right">Gross Savings</div>
          <div className="text-right">Savings %</div>
        </div>

        {sortedAccounts.map((account, index) => (
          <div
            key={account.accountName}
            className="grid grid-cols-7 gap-4 px-4 py-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
            onClick={() => onAccountSelect(account.accountName)}
          >
            <div className="flex items-center gap-2">
              <Badge 
                variant={index === 0 ? "default" : "outline"}
                className="w-8 h-6 justify-center"
              >
                {index + 1}
              </Badge>
              {index === 0 && <TrendingUp className="h-4 w-4 text-green-600" />}
            </div>
            
            <div className="flex flex-col">
              <span className="font-medium text-foreground">{account.accountName}</span>
              <span className="text-xs text-muted-foreground">{account.accountType}</span>
            </div>
            
            <div className="text-right font-mono text-sm">
              {account.shipmentCount.toLocaleString()}
            </div>
            
            <div className="text-right font-mono text-sm">
              {formatCurrency(account.shipProsCost)}
            </div>
            
            <div className="text-right font-mono text-sm text-muted-foreground">
              {formatCurrency(account.currentCost)}
            </div>
            
            <div className={`text-right font-mono text-sm ${getSavingsColor(account.grossSavings)}`}>
              {formatCurrency(account.grossSavings)}
            </div>
            
            <div className={`text-right font-mono text-sm ${getSavingsColor(account.grossSavings)}`}>
              {account.savingsPercent > 0 ? '+' : ''}{account.savingsPercent.toFixed(1)}%
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-600" />
            <span>Best Performer</span>
          </div>
          <div>
            Total Analyzed: {accounts.reduce((sum, acc) => sum + acc.shipmentCount, 0)} shipments
          </div>
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => onDrillDown(2)}
        >
          Drill Down to Service Types
        </Button>
      </div>
    </Card>
  );
}