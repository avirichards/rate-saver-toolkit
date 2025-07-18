import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { Button } from '@/components/ui-lov/Button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowUp, ArrowDown, Crown, Trophy, Medal } from 'lucide-react';
import { formatCurrency, formatPercentage, getSavingsColor } from '@/lib/utils';
import { AccountPerformance, AccountInfo } from '@/hooks/useAccountAssignments';

interface AccountPerformanceSummaryProps {
  accountPerformance: AccountPerformance[];
  onAssignGlobal: (account: AccountInfo) => void;
  onViewAccount: (account: AccountInfo) => void;
  sortConfig: { key: string; direction: 'asc' | 'desc' } | null;
  onSort: (key: string) => void;
}

export const AccountPerformanceSummary: React.FC<AccountPerformanceSummaryProps> = ({
  accountPerformance,
  onAssignGlobal,
  onViewAccount,
  sortConfig,
  onSort
}) => {
  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Crown className="h-4 w-4 text-yellow-500" />;
      case 2: return <Trophy className="h-4 w-4 text-gray-400" />;
      case 3: return <Medal className="h-4 w-4 text-orange-500" />;
      default: return null;
    }
  };

  const SortHeader = ({ column, children }: { column: string; children: React.ReactNode }) => (
    <TableHead 
      className="cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={() => onSort(column)}
    >
      <div className="flex items-center gap-2">
        {children}
        {sortConfig?.key === column && (
          sortConfig.direction === 'asc' ? 
            <ArrowUp className="h-4 w-4" /> : 
            <ArrowDown className="h-4 w-4" />
        )}
      </div>
    </TableHead>
  );

  if (accountPerformance.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Account Performance Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No account data available for comparison
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Account Performance Summary
          <Badge variant="secondary">{accountPerformance.length} Accounts</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <SortHeader column="rank">Rank</SortHeader>
                <SortHeader column="account">Account</SortHeader>
                <SortHeader column="shipmentCount">Shipments</SortHeader>
                <SortHeader column="totalCost">Ship Pros Cost</SortHeader>
                <SortHeader column="currentCost">Current Cost</SortHeader>
                <SortHeader column="totalSavings">Gross Savings</SortHeader>
                <SortHeader column="savingsPercentage">Savings %</SortHeader>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accountPerformance.map((performance) => {
                const currentCost = performance.totalCost + performance.totalSavings;
                return (
                  <TableRow 
                    key={`${performance.account.carrierType}-${performance.account.accountName}`}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => onViewAccount(performance.account)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {getRankIcon(performance.rank)}
                        <span>#{performance.rank}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{performance.account.displayName}</span>
                        <span className="text-sm text-muted-foreground">
                          {performance.account.carrierType}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{performance.shipmentCount}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{formatCurrency(performance.totalCost)}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground">{formatCurrency(currentCost)}</span>
                    </TableCell>
                    <TableCell>
                      <span className={`font-medium ${getSavingsColor(performance.totalSavings)}`}>
                        {formatCurrency(performance.totalSavings)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={performance.savingsPercentage > 0 ? "default" : "destructive"}
                        className={performance.savingsPercentage > 0 ? "bg-green-100 text-green-800" : ""}
                      >
                        {formatPercentage(performance.savingsPercentage)}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onAssignGlobal(performance.account)}
                        className="text-xs"
                      >
                        Assign to All
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        
        <div className="mt-4 text-sm text-muted-foreground">
          Click on any account row to view detailed service-level performance
        </div>
      </CardContent>
    </Card>
  );
};