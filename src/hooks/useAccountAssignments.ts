import { useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';

export interface AccountInfo {
  carrierId: string;
  accountName: string;
  carrierType: string;
  displayName: string; // "UPS – DropShoppr"
}

export interface AccountAssignment {
  shipmentId: number;
  assignedAccount: AccountInfo;
  rate: number;
  savings: number;
  isOverride: boolean; // User manually assigned vs system recommendation
}

export interface ServiceAssignment {
  serviceType: string;
  recommendedAccount: AccountInfo;
  alternativeAccounts: AccountInfo[];
  shipmentCount: number;
  totalSavings: number;
}

export interface AccountPerformance {
  account: AccountInfo;
  shipmentCount: number;
  totalSavings: number;
  savingsPercentage: number;
  totalCost: number;
  rank: number;
}

export const useAccountAssignments = (
  shipmentData: any[], 
  markupFunction?: (shipment: any) => any
) => {
  const [assignments, setAssignments] = useState<Map<number, AccountAssignment>>(new Map());
  const [globalAssignment, setGlobalAssignment] = useState<AccountInfo | null>(null);
  const [serviceAssignments, setServiceAssignments] = useState<Map<string, AccountInfo>>(new Map());

  // Extract available accounts from shipment data
  const availableAccounts = useMemo(() => {
    const accountMap = new Map<string, AccountInfo>();
    
    shipmentData.forEach(shipment => {
      // Extract account information from various data structures
      const accounts = shipment.accounts || shipment.rates || [];
      
      accounts.forEach((account: any) => {
        const accountKey = `${account.carrier}-${account.accountName}`;
        if (!accountMap.has(accountKey)) {
          accountMap.set(accountKey, {
            carrierId: account.carrierId || account.id,
            accountName: account.accountName || account.name,
            carrierType: account.carrier || account.carrierType,
            displayName: `${account.carrier || account.carrierType} – ${account.accountName || account.name}`
          });
        }
      });
    });
    
    return Array.from(accountMap.values());
  }, [shipmentData]);

  // Calculate account performance metrics
  const accountPerformance = useMemo((): AccountPerformance[] => {
    const performanceMap = new Map<string, AccountPerformance>();
    
    shipmentData.forEach(shipment => {
      const accounts = shipment.accounts || shipment.rates || [];
      
      accounts.forEach((account: any) => {
        const accountKey = `${account.carrier}-${account.accountName}`;
        const rate = account.rate || account.cost || 0;
        const savings = shipment.currentRate - rate;
        
        if (!performanceMap.has(accountKey)) {
          performanceMap.set(accountKey, {
            account: {
              carrierId: account.carrierId || account.id,
              accountName: account.accountName || account.name,
              carrierType: account.carrier || account.carrierType,
              displayName: `${account.carrier || account.carrierType} – ${account.accountName || account.name}`
            },
            shipmentCount: 0,
            totalSavings: 0,
            savingsPercentage: 0,
            totalCost: 0,
            rank: 0
          });
        }
        
        const performance = performanceMap.get(accountKey)!;
        performance.shipmentCount++;
        performance.totalSavings += savings;
        performance.totalCost += rate;
      });
    });
    
    // Calculate percentages and rank accounts
    const performances = Array.from(performanceMap.values());
    performances.forEach(perf => {
      const totalCurrentCost = perf.shipmentCount * (shipmentData.reduce((sum, s) => sum + s.currentRate, 0) / shipmentData.length);
      perf.savingsPercentage = totalCurrentCost > 0 ? (perf.totalSavings / totalCurrentCost) * 100 : 0;
    });
    
    return performances
      .sort((a, b) => b.totalSavings - a.totalSavings)
      .map((perf, index) => ({ ...perf, rank: index + 1 }));
  }, [shipmentData]);

  // Calculate service-level recommendations
  const serviceRecommendations = useMemo((): ServiceAssignment[] => {
    const serviceMap = new Map<string, ServiceAssignment>();
    
    shipmentData.forEach(shipment => {
      const serviceType = shipment.service || shipment.originalService || 'Unknown';
      const accounts = shipment.accounts || shipment.rates || [];
      
      if (!serviceMap.has(serviceType)) {
        serviceMap.set(serviceType, {
          serviceType,
          recommendedAccount: availableAccounts[0] || {
            carrierId: '',
            accountName: '',
            carrierType: '',
            displayName: 'No Account'
          },
          alternativeAccounts: [],
          shipmentCount: 0,
          totalSavings: 0
        });
      }
      
      const service = serviceMap.get(serviceType)!;
      service.shipmentCount++;
      
      // Find best account for this service
      let bestAccount = null;
      let bestSavings = -Infinity;
      
      accounts.forEach((account: any) => {
        const rate = account.rate || account.cost || 0;
        const savings = shipment.currentRate - rate;
        
        if (savings > bestSavings) {
          bestSavings = savings;
          bestAccount = {
            carrierId: account.carrierId || account.id,
            accountName: account.accountName || account.name,
            carrierType: account.carrier || account.carrierType,
            displayName: `${account.carrier || account.carrierType} – ${account.accountName || account.name}`
          };
        }
      });
      
      if (bestAccount) {
        service.recommendedAccount = bestAccount;
        service.totalSavings += bestSavings;
      }
    });
    
    return Array.from(serviceMap.values());
  }, [shipmentData, availableAccounts]);

  // Assign account to all shipments
  const assignGlobalAccount = useCallback((account: AccountInfo) => {
    setGlobalAssignment(account);
    
    const newAssignments = new Map<number, AccountAssignment>();
    shipmentData.forEach(shipment => {
      const accountData = (shipment.accounts || shipment.rates || []).find((acc: any) => 
        acc.carrierId === account.carrierId || 
        (acc.accountName === account.accountName && acc.carrier === account.carrierType)
      );
      
      if (accountData) {
        const rate = markupFunction ? markupFunction(shipment).markedUpPrice : (accountData.rate || accountData.cost || 0);
        newAssignments.set(shipment.id, {
          shipmentId: shipment.id,
          assignedAccount: account,
          rate,
          savings: shipment.currentRate - rate,
          isOverride: true
        });
      }
    });
    
    setAssignments(newAssignments);
    toast.success(`Assigned ${account.displayName} to all shipments`);
  }, [shipmentData, markupFunction]);

  // Assign account to specific service type
  const assignServiceAccount = useCallback((serviceType: string, account: AccountInfo) => {
    setServiceAssignments(prev => new Map(prev).set(serviceType, account));
    
    setAssignments(prev => {
      const newAssignments = new Map(prev);
      
      shipmentData
        .filter(shipment => (shipment.service || shipment.originalService) === serviceType)
        .forEach(shipment => {
          const accountData = (shipment.accounts || shipment.rates || []).find((acc: any) => 
            acc.carrierId === account.carrierId || 
            (acc.accountName === account.accountName && acc.carrier === account.carrierType)
          );
          
          if (accountData) {
            const rate = markupFunction ? markupFunction(shipment).markedUpPrice : (accountData.rate || accountData.cost || 0);
            newAssignments.set(shipment.id, {
              shipmentId: shipment.id,
              assignedAccount: account,
              rate,
              savings: shipment.currentRate - rate,
              isOverride: true
            });
          }
        });
      
      return newAssignments;
    });
    
    toast.success(`Assigned ${account.displayName} to ${serviceType} shipments`);
  }, [shipmentData, markupFunction]);

  // Assign account to individual shipment
  const assignShipmentAccount = useCallback((shipmentId: number, account: AccountInfo) => {
    const shipment = shipmentData.find(s => s.id === shipmentId);
    if (!shipment) return;
    
    const accountData = (shipment.accounts || shipment.rates || []).find((acc: any) => 
      acc.carrierId === account.carrierId || 
      (acc.accountName === account.accountName && acc.carrier === account.carrierType)
    );
    
    if (accountData) {
      const rate = markupFunction ? markupFunction(shipment).markedUpPrice : (accountData.rate || accountData.cost || 0);
      setAssignments(prev => new Map(prev).set(shipmentId, {
        shipmentId,
        assignedAccount: account,
        rate,
        savings: shipment.currentRate - rate,
        isOverride: true
      }));
    }
  }, [shipmentData, markupFunction]);

  // Get assignment for specific shipment
  const getShipmentAssignment = useCallback((shipmentId: number): AccountAssignment | null => {
    return assignments.get(shipmentId) || null;
  }, [assignments]);

  // Calculate total metrics with current assignments
  const totalMetrics = useMemo(() => {
    let totalSavings = 0;
    let totalCost = 0;
    let assignedShipments = 0;
    
    shipmentData.forEach(shipment => {
      const assignment = assignments.get(shipment.id);
      if (assignment) {
        totalSavings += assignment.savings;
        totalCost += assignment.rate;
        assignedShipments++;
      }
    });
    
    return {
      totalSavings,
      totalCost,
      assignedShipments,
      totalShipments: shipmentData.length,
      averageSavingsPercent: totalCost > 0 ? (totalSavings / (totalCost + totalSavings)) * 100 : 0
    };
  }, [shipmentData, assignments]);

  return {
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
  };
};