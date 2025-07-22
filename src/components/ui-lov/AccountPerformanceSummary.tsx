
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { Badge } from '@/components/ui/badge';
import { TrendingDown, TrendingUp, Award, Users, DollarSign, Clock } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface AccountPerformance {
  accountName: string;
  totalShipments: number;
  totalSavings: number;
  averageRate: number;
  winRate: number; // percentage of shipments where this account had the best rate
  averageTransitDays: number;
  serviceCount: number;
}

interface AccountPerformanceSummaryProps {
  accountPerformances: AccountPerformance[];
}

export const AccountPerformanceSummary: React.FC<AccountPerformanceSummaryProps> = ({ 
  accountPerformances 
}) => {
  const sortedAccounts = [...accountPerformances].sort((a, b) => b.winRate - a.winRate);
  const topAccount = sortedAccounts[0];
  const totalShipments = accountPerformances.reduce((sum, acc) => sum + acc.totalShipments, 0);
  const totalSavings = accountPerformances.reduce((sum, acc) => sum + acc.totalSavings, 0);

  return (
    <div className="space-y-6">
      {/* Overall Performance Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-yellow-600" />
            Account Performance Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-primary">{accountPerformances.length}</div>
              <div className="text-sm text-muted-foreground">Accounts Compared</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{totalShipments}</div>
              <div className="text-sm text-muted-foreground">Total Shipments</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-green-600">{formatCurrency(totalSavings)}</div>
              <div className="text-sm text-muted-foreground">Total Savings</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">{topAccount?.accountName || 'N/A'}</div>
              <div className="text-sm text-muted-foreground">Top Performer</div>
            </div>
          </div>

          {/* Top Account Highlight */}
          {topAccount && (
            <div className="p-4 rounded-lg border-2 border-yellow-600">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Award className="h-5 w-5 text-yellow-600" />
                    {topAccount.accountName}
                  </h3>
                  <p className="text-sm text-muted-foreground">Best overall performer</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-yellow-600">{topAccount.winRate.toFixed(1)}%</div>
                  <div className="text-sm text-muted-foreground">Win Rate</div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Account Performance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedAccounts.map((account, index) => (
          <Card key={account.accountName} className={index === 0 ? 'border-yellow-600 border-2' : ''}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{account.accountName}</CardTitle>
                {index === 0 && (
                  <Badge variant="default" className="bg-yellow-600">
                    <Award className="h-3 w-3 mr-1" />
                    Best
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Win Rate</span>
                  </div>
                  <span className="font-semibold text-green-600">{account.winRate.toFixed(1)}%</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-blue-600" />
                    <span className="text-sm">Avg Rate</span>
                  </div>
                  <span className="font-semibold">{formatCurrency(account.averageRate)}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-purple-600" />
                    <span className="text-sm">Shipments</span>
                  </div>
                  <span className="font-semibold">{account.totalShipments}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-orange-600" />
                    <span className="text-sm">Avg Transit</span>
                  </div>
                  <span className="font-semibold">{account.averageTransitDays.toFixed(1)} days</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
