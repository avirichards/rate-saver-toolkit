
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { Button } from '@/components/ui-lov/Button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, User, Package, Target, DollarSign, TrendingUp } from 'lucide-react';
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

  // Enhanced data quality check with detailed logging
  const dataQualityCheck = useMemo(() => {
    console.log('🔍 AccountReviewTab - Data quality check:', {
      totalShipments: shipmentData.length,
      sampleShipment: shipmentData[0] ? {
        trackingId: shipmentData[0].trackingId,
        hasAccounts: !!shipmentData[0].accounts,
        accountsLength: shipmentData[0].accounts?.length || 0,
        hasAllRates: !!shipmentData[0].allRates,
        allRatesLength: shipmentData[0].allRates?.length || 0,
        hasCarrierResults: !!shipmentData[0].carrierResults,
        carrierResultsLength: shipmentData[0].carrierResults?.length || 0,
        accountsSample: shipmentData[0].accounts?.slice(0, 2),
        allRatesSample: shipmentData[0].allRates?.slice(0, 2)
      } : null
    });

    const shipmentsWithAccountData = shipmentData.filter(s => {
      const hasAccounts = s.accounts && s.accounts.length > 0;
      const hasAllRates = s.allRates && s.allRates.length > 0;
      const hasCarrierResults = s.carrierResults && s.carrierResults.length > 0;
      
      return hasAccounts || hasAllRates || hasCarrierResults;
    });
    
    const shipmentsWithMultipleAccounts = shipmentData.filter(s => {
      const accountCount = (s.accounts?.length || 0) + 
                          (s.allRates?.length || 0) +
                          (s.carrierResults?.reduce((sum: number, cr: any) => sum + (cr.rates?.length || 0), 0) || 0);
      return accountCount > 1;
    });

    const result = {
      totalShipments: shipmentData.length,
      shipmentsWithData: shipmentsWithAccountData.length,
      shipmentsWithMultipleAccounts: shipmentsWithMultipleAccounts.length,
      hasUsableData: shipmentsWithAccountData.length > 0,
      hasMultiAccountData: shipmentsWithMultipleAccounts.length > 0,
      availableAccountsCount: availableAccounts.length
    };

    console.log('📊 Data quality result:', result);
    return result;
  }, [shipmentData, availableAccounts.length]);

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
        return 'Multi-Carrier Account Performance';
      case 'services':
        return `${selectedAccount?.displayName} → Service Analysis`;
      case 'shipments':
        return `${selectedAccount?.displayName} → ${selectedService} → Assignments`;
      default:
        return '';
    }
  };

  // Enhanced data availability check with troubleshooting info
  if (!dataQualityCheck.hasUsableData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Account Review & Assignment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Multi-Carrier Data Required</h3>
            <p className="text-muted-foreground mb-4">
              Account review requires shipment data with multiple carrier accounts. 
              {dataQualityCheck.totalShipments > 0 
                ? 'Your shipments need to be processed through the multi-carrier analysis first.'
                : 'Please run a multi-carrier analysis to generate account comparison data.'
              }
            </p>
            <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-2">
              <div className="grid grid-cols-2 gap-4 text-left">
                <div>
                  <span className="font-medium">Total Shipments:</span> {dataQualityCheck.totalShipments}
                </div>
                <div>
                  <span className="font-medium">With Account Data:</span> {dataQualityCheck.shipmentsWithData}
                </div>
                <div>
                  <span className="font-medium">Multi-Account:</span> {dataQualityCheck.shipmentsWithMultipleAccounts}
                </div>
                <div>
                  <span className="font-medium">Available Accounts:</span> {dataQualityCheck.availableAccountsCount}
                </div>
              </div>
              {dataQualityCheck.totalShipments > 0 && dataQualityCheck.shipmentsWithData === 0 && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded text-amber-800">
                  <p className="font-medium">Troubleshooting:</p>
                  <p className="text-sm">
                    Your shipments appear to be in the system but lack multi-carrier data. 
                    Please run the multi-carrier analysis from the Analysis page to generate account comparisons.
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Enhanced header with data quality indicators */}
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
                  <Badge variant="outline" className="bg-blue-50">
                    {availableAccounts.length} Accounts Available
                  </Badge>
                  <Badge variant="outline" className="bg-green-50">
                    {dataQualityCheck.shipmentsWithMultipleAccounts} Multi-Account Shipments
                  </Badge>
                  <Badge variant="outline" className="bg-purple-50">
                    {dataQualityCheck.shipmentsWithData} Processed Shipments
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {assignments.global ? `Global: ${assignments.global.account.displayName}` : 'No Global Assignment'} | 
                    Service: {Object.keys(assignments.service).length} | 
                    Individual: {Object.keys(assignments.individual).length}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Enhanced metrics summary */}
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(totalMetrics.totalSavings)}
                </div>
                <div className="text-sm text-muted-foreground">Potential Savings</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {formatCurrency(totalMetrics.totalCost)}
                </div>
                <div className="text-sm text-muted-foreground">Ship Pros Cost</div>
              </div>
              <div>
                <div className="text-center text-2xl font-bold text-primary">
                  {totalMetrics.assignedShipments}/{totalMetrics.totalShipments}
                </div>
                <div className="text-center text-sm text-muted-foreground mt-1">
                  Assignments: {totalMetrics.assignedShipments > 0 ? 
                    `${((totalMetrics.assignedShipments / totalMetrics.totalShipments) * 100).toFixed(1)}%` : 
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
          accountPerformance={accountPerformance}
          onAssignGlobal={assignGlobalAccount}
          onViewAccount={handleViewAccount}
          sortConfig={sortConfig}
          onSort={handleSort}
        />
      )}

      {currentLevel === 'services' && selectedAccount && (
        <div className="text-center py-8">
          <h3 className="text-lg font-semibold mb-2">Service Type Analysis</h3>
          <p className="text-muted-foreground">
            Detailed service comparison for {selectedAccount.displayName} coming soon
          </p>
        </div>
      )}

      {currentLevel === 'shipments' && selectedAccount && selectedService && (
        <div className="text-center py-8">
          <h3 className="text-lg font-semibold mb-2">Individual Shipment Assignments</h3>
          <p className="text-muted-foreground">
            Granular shipment assignment interface for {selectedAccount.displayName} - {selectedService} coming soon
          </p>
        </div>
      )}

      {/* Enhanced assignment status */}
      {(assignments.global || Object.keys(assignments.service).length > 0 || Object.keys(assignments.individual).length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Active Account Assignments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {assignments.global && (
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-blue-600" />
                    <span>Global assignment:</span>
                    <span className="font-medium text-blue-800">{assignments.global.account.displayName}</span>
                  </div>
                  <Badge variant="secondary">All Shipments</Badge>
                </div>
              )}
              
              {Object.entries(assignments.service).map(([serviceType, assignment]) => (
                <div key={serviceType} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-green-600" />
                    <span className="font-medium text-green-800">{serviceType}</span>
                    <span>→ {assignment.account.displayName}</span>
                  </div>
                  <Badge variant="secondary">Service Level</Badge>
                </div>
              ))}
              
              {Object.keys(assignments.individual).length > 0 && (
                <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-orange-600" />
                    <span className="font-medium text-orange-800">
                      {Object.keys(assignments.individual).length} individual assignments
                    </span>
                  </div>
                  <Badge variant="secondary">Custom</Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
