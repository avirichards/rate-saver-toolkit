import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { Button } from '@/components/ui-lov/Button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, BarChart3, Package, User } from 'lucide-react';
import { AccountPerformanceSummary } from './AccountPerformanceSummary';
import { ServiceTypeComparison } from './ServiceTypeComparison';
import { ShipmentDetailAssignment } from './ShipmentDetailAssignment';
import { useAccountAssignments, AccountInfo } from '@/hooks/useAccountAssignments';
import { formatCurrency, formatPercentage } from '@/lib/utils';

type ViewLevel = 'accounts' | 'services' | 'shipments';

interface AccountReviewTabProps {
  shipmentData: any[];
  markupFunction?: (shipment: any) => any;
  analysisId?: string;
}

export const AccountReviewTab: React.FC<AccountReviewTabProps> = ({
  shipmentData,
  markupFunction,
  analysisId
}) => {
  const [currentLevel, setCurrentLevel] = useState<ViewLevel>('accounts');
  const [selectedAccount, setSelectedAccount] = useState<AccountInfo | null>(null);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const {
    availableAccounts,
    accountPerformance,
    serviceRecommendations,
    assignments,
    globalAssignment,
    serviceAssignments,
    totalMetrics,
    assignGlobalAccount,
    assignServiceAccount,
    assignShipmentAccount,
    getShipmentAssignment
  } = useAccountAssignments(shipmentData, markupFunction, analysisId);

  // Sort account performance based on current sort config
  const sortedAccountPerformance = useMemo(() => {
    if (!sortConfig) return accountPerformance;
    
    return [...accountPerformance].sort((a, b) => {
      let aValue: any = a[sortConfig.key as keyof typeof a];
      let bValue: any = b[sortConfig.key as keyof typeof b];
      
      if (sortConfig.key === 'account') {
        aValue = a.account.displayName;
        bValue = b.account.displayName;
      }
      
      if (typeof aValue === 'string') {
        return sortConfig.direction === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
    });
  }, [accountPerformance, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig(current => ({
      key,
      direction: current?.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleViewAccount = (account: AccountInfo) => {
    setSelectedAccount(account);
    setCurrentLevel('services');
  };

  const handleViewServiceDetails = (serviceType: string) => {
    setSelectedService(serviceType);
    setCurrentLevel('shipments');
  };

  const handleBackToAccounts = () => {
    setSelectedAccount(null);
    setSelectedService(null);
    setCurrentLevel('accounts');
  };

  const handleBackToServices = () => {
    setSelectedService(null);
    setCurrentLevel('services');
  };

  const getBreadcrumb = () => {
    const items = ['Account Review'];
    
    if (selectedAccount) {
      items.push(selectedAccount.displayName);
    }
    
    if (selectedService) {
      items.push(selectedService);
    }
    
    return items.join(' > ');
  };

  if (availableAccounts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Account Review</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Multi-Account Data Available</h3>
            <p className="text-muted-foreground mb-4">
              This analysis contains only single-account data. Account comparison requires multiple carrier accounts.
            </p>
            <div className="text-sm text-muted-foreground">
              To use this feature, ensure your analysis includes multiple UPS or FedEx accounts.
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with navigation and metrics */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {currentLevel !== 'accounts' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={currentLevel === 'services' ? handleBackToAccounts : handleBackToServices}
                  className="gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
              )}
              <div>
                <CardTitle className="text-lg">{getBreadcrumb()}</CardTitle>
                <div className="text-sm text-muted-foreground mt-1">
                  {currentLevel === 'accounts' && 'Compare account performance across your dataset'}
                  {currentLevel === 'services' && 'Review service-level recommendations'}
                  {currentLevel === 'shipments' && 'Assign accounts to individual shipments'}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(totalMetrics.totalSavings)}
                </div>
                <div className="text-sm text-muted-foreground">Total Potential Savings</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {totalMetrics.assignedShipments}
                </div>
                <div className="text-sm text-muted-foreground">
                  of {totalMetrics.totalShipments} shipments assigned
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {formatPercentage(totalMetrics.averageSavingsPercent)}
                </div>
                <div className="text-sm text-muted-foreground">Average Savings</div>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Level-specific content */}
      {currentLevel === 'accounts' && (
        <AccountPerformanceSummary
          accountPerformance={sortedAccountPerformance}
          onAssignGlobal={assignGlobalAccount}
          onViewAccount={handleViewAccount}
          sortConfig={sortConfig}
          onSort={handleSort}
        />
      )}

      {currentLevel === 'services' && (
        <ServiceTypeComparison
          serviceRecommendations={serviceRecommendations}
          availableAccounts={availableAccounts}
          selectedAccount={selectedAccount || undefined}
          onAssignServiceAccount={assignServiceAccount}
          onViewServiceDetails={handleViewServiceDetails}
          serviceAssignments={serviceAssignments}
        />
      )}

      {currentLevel === 'shipments' && (
        <ShipmentDetailAssignment
          shipmentData={shipmentData}
          availableAccounts={availableAccounts}
          onAssignShipmentAccount={assignShipmentAccount}
          getShipmentAssignment={getShipmentAssignment}
          selectedService={selectedService || undefined}
          selectedAccount={selectedAccount || undefined}
          markupFunction={markupFunction}
        />
      )}

      {/* Assignment Status Summary */}
      {(globalAssignment || serviceAssignments.size > 0 || assignments.size > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Current Assignments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {globalAssignment && (
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Badge variant="default">Global</Badge>
                    <span className="font-medium">All shipments assigned to {globalAssignment.displayName}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => assignGlobalAccount(globalAssignment)}
                  >
                    Clear Global
                  </Button>
                </div>
              )}
              
              {Array.from(serviceAssignments.entries()).map(([serviceType, account]) => (
                <div key={serviceType} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{serviceType}</Badge>
                    <span>assigned to {account.displayName}</span>
                  </div>
                </div>
              ))}
              
              {assignments.size > 0 && (
                <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    <span>{assignments.size} individual shipment assignments</span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};