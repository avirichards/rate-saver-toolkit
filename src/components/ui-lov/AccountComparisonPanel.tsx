import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './Card';
import { Button } from '@/components/ui-lov/Button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EditIcon, TrendingDownIcon, TrendingUpIcon, ExternalLinkIcon } from 'lucide-react';
import { cn, formatCurrency, formatPercentage } from '@/lib/utils';
import { toast } from 'sonner';

interface ServiceTypeAssignment {
  serviceType: string;
  assignedAccount: string;
  shipProsCost: number;
  bestAltCost: number;
  estimatedSavings: number;
  savingsPercent: number;
  shipmentCount: number;
  accounts: Array<{
    accountName: string;
    totalCost: number;
    avgRate: number;
    coverage: number;
  }>;
}

interface AccountComparisonPanelProps {
  serviceAssignments: ServiceTypeAssignment[];
  availableAccounts: string[];
  onAssignmentChange: (serviceType: string, newAccount: string) => void;
  onViewDetails: (serviceType: string) => void;
  className?: string;
}

export const AccountComparisonPanel: React.FC<AccountComparisonPanelProps> = ({
  serviceAssignments,
  availableAccounts,
  onAssignmentChange,
  onViewDetails,
  className
}) => {
  const [editingService, setEditingService] = useState<string | null>(null);

  const handleAssignmentChange = (serviceType: string, newAccount: string) => {
    onAssignmentChange(serviceType, newAccount);
    setEditingService(null);
    toast.success(`${serviceType} assigned to ${newAccount}`);
  };

  const getSavingsColor = (savingsPercent: number) => {
    if (savingsPercent > 10) return 'text-emerald-600 bg-emerald-50';
    if (savingsPercent > 0) return 'text-blue-600 bg-blue-50';
    return 'text-red-600 bg-red-50';
  };

  const getSavingsIcon = (savingsPercent: number) => {
    if (savingsPercent > 0) {
      return <TrendingDownIcon className="h-3 w-3" />;
    }
    return <TrendingUpIcon className="h-3 w-3" />;
  };

  return (
    <Card className={cn("", className)}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Account Comparison
          <Badge variant="outline">
            {serviceAssignments.length} Service Types
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-muted">
                <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">
                  Service Type
                </th>
                <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">
                  Assigned Account
                </th>
                <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">
                  Ship Pros Cost
                </th>
                <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">
                  Best Alt Cost
                </th>
                <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">
                  Est. Savings
                </th>
                <th className="text-center py-3 px-2 text-sm font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {serviceAssignments.map((assignment) => (
                <tr key={assignment.serviceType} className="border-b border-muted/50 hover:bg-muted/30">
                  <td className="py-3 px-2">
                    <div>
                      <div className="font-medium">{assignment.serviceType}</div>
                      <div className="text-xs text-muted-foreground">
                        {assignment.shipmentCount} shipments
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-2">
                    {editingService === assignment.serviceType ? (
                      <Select
                        value={assignment.assignedAccount}
                        onValueChange={(value) => handleAssignmentChange(assignment.serviceType, value)}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {availableAccounts.map((account) => (
                            <SelectItem key={account} value={account}>
                              {account}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="secondary">
                        {assignment.assignedAccount}
                      </Badge>
                    )}
                  </td>
                  <td className="py-3 px-2 text-right font-mono">
                    {formatCurrency(assignment.shipProsCost)}
                  </td>
                  <td className="py-3 px-2 text-right font-mono">
                    {formatCurrency(assignment.bestAltCost)}
                  </td>
                  <td className="py-3 px-2 text-right">
                    <div className={cn(
                      "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
                      getSavingsColor(assignment.savingsPercent)
                    )}>
                      {getSavingsIcon(assignment.savingsPercent)}
                      {formatCurrency(assignment.estimatedSavings)}
                      <span className="ml-1">
                        ({formatPercentage(assignment.savingsPercent)})
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-2">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingService(
                          editingService === assignment.serviceType ? null : assignment.serviceType
                        )}
                        className="h-8 w-8 p-0"
                      >
                        <EditIcon className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onViewDetails(assignment.serviceType)}
                        className="h-8 w-8 p-0"
                      >
                        <ExternalLinkIcon className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {serviceAssignments.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p>No service type assignments found.</p>
            <p className="text-sm mt-1">Complete an analysis with multiple carrier accounts to see comparisons.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};