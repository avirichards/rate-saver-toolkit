import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { Button } from '@/components/ui-lov/Button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, User, Package, Target, DollarSign } from 'lucide-react';
import { AccountPerformanceSummary } from '@/components/ui-lov/AccountPerformanceSummary';
import { ServiceTypeComparison } from '@/components/ui-lov/ServiceTypeComparison';
import { ShipmentDetailAssignment } from '@/components/ui-lov/ShipmentDetailAssignment';
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
  const [sortConfig, setSortConfig] = useState<{key: string, direction: 'asc' | 'desc'} | null>(null);

  const {
    availableAccounts,
    accountPerformance,
    serviceRecommendations,
    assignGlobalAccount,
    assignServiceAccount,
    assignShipmentAccount,
    getShipmentAssignment,
    totalMetrics,
    assignments
  } = useAccountAssignments(shipmentData, markupFunction, analysisId);

  // Sort account performance based on current sort config
  const sortedAccountPerformance = useMemo(() => {
    if (!sortConfig) return accountPerformance;
    
    return [...accountPerformance].sort((a, b) => {
      const { key, direction } = sortConfig;
      let aValue, bValue;
      
      switch (key) {
        case 'account':
          aValue = a.account.displayName;
          bValue = b.account.displayName;
          break;
        case 'rank':
          aValue = a.rank;
          bValue = b.rank;
          break;
        case 'shipmentCount':
          aValue = a.shipmentCount;
          bValue = b.shipmentCount;
          break;
        case 'totalSavings':
          aValue = a.totalSavings;
          bValue = b.totalSavings;
          break;
        case 'totalCost':
          aValue = a.totalCost;
          bValue = b.totalCost;
          break;
        case 'savingsPercentage':
          aValue = a.savingsPercentage;
          bValue = b.savingsPercentage;
          break;
        default:
          return 0;
      }
      
      if (direction === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });
  }, [accountPerformance, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev?.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
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
    setCurrentLevel('accounts');
    setSelectedAccount(null);
    setSelectedService(null);
  };

  const handleBackToServices = () => {
    setCurrentLevel('services');
    setSelectedService(null);
  };

  const getBreadcrumb = () => {
    switch (currentLevel) {
      case 'accounts':
        return 'Account Performance Summary';
      case 'services':
        return `${selectedAccount?.displayName} → Service Comparison`;
      case 'shipments':
        return `${selectedAccount?.displayName} → ${selectedService} → Shipment Details`;
      default:
        return '';
    }
  };

  // Check if we have multi-account data
  if (availableAccounts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Account Review</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Multi-Account Data Available</h3>
            <p className="text-muted-foreground">
              Account review requires shipment data with multiple carrier accounts. 
              Please ensure your analysis includes multi-carrier rate comparisons.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with breadcrumb and key metrics */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {currentLevel !== 'accounts' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={currentLevel === 'services' ? handleBackToAccounts : handleBackToServices}
                  className="p-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <div>
                <CardTitle className="text-xl">{getBreadcrumb()}</CardTitle>
                <div className="flex items-center gap-4 mt-2">
                  <Badge variant="outline">
                    {availableAccounts.length} Accounts Available
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Global: {assignments.global?.account.displayName || 'None'} | 
                    Service-level: {Object.keys(assignments.service).length} | 
                    Individual: {Object.keys(assignments.individual).length}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Key metrics summary */}
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(totalMetrics.totalSavings)}
                </div>
                <div className="text-sm text-muted-foreground">Total Savings</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {formatCurrency(totalMetrics.totalCost)}
                </div>
                <div className="text-sm text-muted-foreground">Total Cost</div>
              </div>
              <div>
                <div className="text-center text-2xl font-bold text-primary">
                  {totalMetrics.assignedShipments}/{totalMetrics.totalShipments}
                </div>
                <div className="text-center text-sm text-muted-foreground mt-1">
                  Assigned: {Object.keys(assignments.individual).length > 0 ? 
                    `${((Object.keys(assignments.individual).length / totalMetrics.totalShipments) * 100).toFixed(1)}%` : 
                    '0%'}
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Dynamic content based on current level */}
      {currentLevel === 'accounts' && (
        <AccountPerformanceSummary
          accountPerformance={sortedAccountPerformance}
          onAssignGlobal={assignGlobalAccount}
          onViewAccount={handleViewAccount}
          sortConfig={sortConfig}
          onSort={handleSort}
        />
      )}

      {currentLevel === 'services' && selectedAccount && (
        <div className="text-center py-8">
          <h3 className="text-lg font-semibold mb-2">Service Type Comparison</h3>
          <p className="text-muted-foreground">Service comparison view coming soon for {selectedAccount.displayName}</p>
        </div>
      )}

      {currentLevel === 'shipments' && selectedAccount && selectedService && (
        <div className="text-center py-8">
          <h3 className="text-lg font-semibold mb-2">Shipment Detail Assignment</h3>
          <p className="text-muted-foreground">
            Shipment assignment view coming soon for {selectedAccount.displayName} - {selectedService}
          </p>
        </div>
      )}

      {/* Assignment Status Summary */}
      {(assignments.global || Object.keys(assignments.service).length > 0 || Object.keys(assignments.individual).length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Current Assignments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {assignments.global && (
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    <span>Global assignment to all shipments:</span>
                    <span className="font-medium">{assignments.global.account.displayName}</span>
                  </div>
                </div>
              )}
              
              {Object.entries(assignments.service).map(([serviceType, assignment]) => (
                <div key={serviceType} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    <span>{serviceType} shipments</span>
                    <span>assigned to {assignment.account.displayName}</span>
                  </div>
                </div>
              ))}
              
              {Object.keys(assignments.individual).length > 0 && (
                <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    <span>{Object.keys(assignments.individual).length} individual shipment assignments</span>
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