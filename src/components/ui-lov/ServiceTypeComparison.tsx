import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { Button } from '@/components/ui-lov/Button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { formatCurrency, formatPercentage } from '@/lib/utils';
import { ServiceAssignment, AccountInfo } from '@/hooks/useAccountAssignments';

interface ServiceTypeComparisonProps {
  serviceRecommendations: ServiceAssignment[];
  availableAccounts: AccountInfo[];
  selectedAccount?: AccountInfo;
  onAssignServiceAccount: (serviceType: string, account: AccountInfo) => void;
  onViewServiceDetails: (serviceType: string) => void;
  serviceAssignments: Map<string, AccountInfo>;
}

export const ServiceTypeComparison: React.FC<ServiceTypeComparisonProps> = ({
  serviceRecommendations,
  availableAccounts,
  selectedAccount,
  onAssignServiceAccount,
  onViewServiceDetails,
  serviceAssignments
}) => {
  const filteredRecommendations = selectedAccount 
    ? serviceRecommendations.filter(service => 
        service.recommendedAccount.carrierId === selectedAccount.carrierId ||
        service.recommendedAccount.accountName === selectedAccount.accountName
      )
    : serviceRecommendations;

  const getAssignedAccount = (serviceType: string) => {
    return serviceAssignments.get(serviceType) || null;
  };

  const getCompetingAccounts = (service: ServiceAssignment, currentAccount: AccountInfo) => {
    return availableAccounts
      .filter(account => 
        account.carrierId !== currentAccount.carrierId &&
        account.accountName !== currentAccount.accountName
      )
      .slice(0, 2); // Show top 2 competing accounts
  };

  if (filteredRecommendations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Service Type Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            {selectedAccount 
              ? `No services found for ${selectedAccount.displayName}`
              : 'No service data available'
            }
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Service Type Comparison
          {selectedAccount && (
            <Badge variant="outline">{selectedAccount.displayName}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service Type</TableHead>
                <TableHead>Best Performing Account</TableHead>
                <TableHead>Shipments</TableHead>
                <TableHead>Total Savings</TableHead>
                <TableHead>Assigned Account</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecommendations.map((service) => {
                const assignedAccount = getAssignedAccount(service.serviceType);
                const isAssigned = !!assignedAccount;
                const isBestAssigned = assignedAccount?.carrierId === service.recommendedAccount.carrierId;
                
                return (
                  <TableRow 
                    key={service.serviceType}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => onViewServiceDetails(service.serviceType)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span>{service.serviceType}</span>
                        {isAssigned && (
                          isBestAssigned ? 
                            <CheckCircle2 className="h-4 w-4 text-green-500" /> :
                            <AlertCircle className="h-4 w-4 text-orange-500" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-green-700">
                          {service.recommendedAccount.displayName}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {formatCurrency(service.totalSavings)} savings
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{service.shipmentCount}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-green-600">
                        {formatCurrency(service.totalSavings)}
                      </span>
                    </TableCell>
                    <TableCell>
                      {isAssigned ? (
                        <div className="flex items-center gap-2">
                          <Badge variant={isBestAssigned ? "default" : "secondary"}>
                            {assignedAccount.displayName}
                          </Badge>
                          {!isBestAssigned && (
                            <span className="text-xs text-orange-600">Override</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        {!isBestAssigned && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onAssignServiceAccount(service.serviceType, service.recommendedAccount)}
                            className="text-xs"
                          >
                            Assign Best
                          </Button>
                        )}
                        <Select
                          value={assignedAccount?.carrierId || ""}
                          onValueChange={(value) => {
                            const account = availableAccounts.find(acc => acc.carrierId === value);
                            if (account) {
                              onAssignServiceAccount(service.serviceType, account);
                            }
                          }}
                        >
                          <SelectTrigger className="w-32 h-8">
                            <SelectValue placeholder="Override" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableAccounts.map((account) => (
                              <SelectItem key={account.carrierId} value={account.carrierId}>
                                {account.displayName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        
        <div className="mt-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Best account assigned</span>
            </div>
            <div className="flex items-center gap-1">
              <AlertCircle className="h-4 w-4 text-orange-500" />
              <span>Override assignment</span>
            </div>
          </div>
          <div className="mt-2">
            Click on any service row to view individual shipment assignments
          </div>
        </div>
      </CardContent>
    </Card>
  );
};