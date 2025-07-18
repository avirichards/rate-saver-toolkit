import { useState, useCallback, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

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

// Assignment state management interfaces
interface GlobalAssignment {
  account: AccountInfo;
  assignedAt: Date;
}

interface ServiceAssignmentState {
  account: AccountInfo;
  assignedAt: Date;
}

interface IndividualAssignment {
  account: AccountInfo;
  assignedAt: Date;
  isOverride: boolean;
}

export const useAccountAssignments = (
  shipmentData: any[], 
  markupFunction?: (shipment: any) => any,
  currentAnalysisId?: string
) => {
  // State for assignment tracking with database persistence
  const [assignments, setAssignments] = useState<{
    global: GlobalAssignment | null;
    service: Record<string, ServiceAssignmentState>;
    individual: Record<number, IndividualAssignment>;
  }>({
    global: null,
    service: {},
    individual: {}
  });

  // Load assignments from database on mount
  useEffect(() => {
    const loadAssignments = async () => {
      if (!currentAnalysisId) return;
      
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
          .from('shipping_analyses')
          .select('account_assignments, service_assignments, global_assignment')
          .eq('id', currentAnalysisId)
          .eq('user_id', user.id)
          .single();

        if (data) {
          setAssignments({
            global: data.global_assignment || null,
            service: data.service_assignments || {},
            individual: (data.account_assignments || []).reduce((acc: any, assignment: any) => {
              acc[assignment.shipmentId] = assignment;
              return acc;
            }, {})
          });
          console.log('📥 Loaded assignments from database:', data);
        }
      } catch (error) {
        console.error('❌ Failed to load assignments:', error);
      }
    };

    loadAssignments();
  }, [currentAnalysisId]);

  // Extract available accounts from shipment data with enhanced extraction
  const availableAccounts = useMemo(() => {
    console.log('🔍 useAccountAssignments - Extracting accounts from shipment data:', {
      shipmentCount: shipmentData.length,
      sampleShipment: shipmentData[0] ? {
        id: shipmentData[0].id,
        trackingId: shipmentData[0].trackingId,
        hasAccounts: !!shipmentData[0].accounts,
        accountsCount: shipmentData[0].accounts?.length || 0,
        availableFields: Object.keys(shipmentData[0])
      } : null
    });
    
    const accountMap = new Map<string, AccountInfo>();
    
    shipmentData.forEach((shipment, index) => {
      // Extract account information from enhanced data structure
      const accounts = shipment.accounts || [];
      
      if (index < 3) {
        console.log(`🔍 Processing shipment ${shipment.id} for accounts:`, {
          accountsFound: accounts.length,
          accounts: accounts.map((acc: any) => ({
            carrier: acc.carrierType || acc.carrier,
            account: acc.accountName || acc.name,
            rate: acc.rate || acc.cost
          }))
        });
      }
      
      accounts.forEach((account: any) => {
        const accountKey = `${account.carrierType}-${account.accountName}`;
        if (!accountMap.has(accountKey)) {
          accountMap.set(accountKey, {
            carrierId: account.carrierId || account.id,
            accountName: account.accountName || account.name || 'Default',
            carrierType: account.carrierType || account.carrier || 'Unknown',
            displayName: account.displayName || 
              `${account.carrierType || account.carrier || 'Unknown'} – ${account.accountName || account.name || 'Default'}`
          });
        }
      });
    });
    
    const accounts = Array.from(accountMap.values());
    console.log('🔍 useAccountAssignments - Extracted accounts:', {
      totalAccounts: accounts.length,
      accounts: accounts.map(acc => ({ carrier: acc.carrierType, account: acc.accountName }))
    });
    
    return accounts;
  }, [shipmentData]);

  // Calculate account performance metrics
  const accountPerformance = useMemo((): AccountPerformance[] => {
    const performanceMap = new Map<string, AccountPerformance>();
    
    shipmentData.forEach(shipment => {
      const accounts = shipment.accounts || [];
      
      accounts.forEach((account: any) => {
        const accountKey = `${account.carrierType}-${account.accountName}`;
        const rate = account.rate || account.cost || 0;
        const savings = shipment.currentRate - rate;
        
        if (!performanceMap.has(accountKey)) {
          performanceMap.set(accountKey, {
            account: {
              carrierId: account.carrierId || account.id,
              accountName: account.accountName || account.name || 'Default',
              carrierType: account.carrierType || account.carrier || 'Unknown',
              displayName: account.displayName || 
                `${account.carrierType || account.carrier || 'Unknown'} – ${account.accountName || account.name || 'Default'}`
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
      const accounts = shipment.accounts || [];
      
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
            accountName: account.accountName || account.name || 'Default',
            carrierType: account.carrierType || account.carrier || 'Unknown',
            displayName: account.displayName || 
              `${account.carrierType || account.carrier || 'Unknown'} – ${account.accountName || account.name || 'Default'}`
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

  // Database persistence for assignments
  const saveAssignments = async (newAssignments: typeof assignments) => {
    if (!currentAnalysisId) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('shipping_analyses')
        .update({
          account_assignments: Object.entries(newAssignments.individual).map(([shipmentId, assignment]) => ({
            shipmentId: Number(shipmentId),
            ...assignment
          })),
          service_assignments: newAssignments.service,
          global_assignment: newAssignments.global,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentAnalysisId)
        .eq('user_id', user.id);
        
      console.log('✅ Account assignments saved to database');
    } catch (error) {
      console.error('❌ Failed to save assignments:', error);
    }
  };

  // Assign account to all shipments
  const assignGlobalAccount = useCallback((account: AccountInfo) => {
    console.log('🌍 Assigning global account:', account);
    const newAssignments = {
      ...assignments,
      global: {
        account,
        assignedAt: new Date()
      }
    };
    setAssignments(newAssignments);
    saveAssignments(newAssignments);
    toast.success(`Assigned ${account.displayName} to all shipments`);
  }, [assignments]);

  // Assign account to specific service type
  const assignServiceAccount = useCallback((serviceType: string, account: AccountInfo) => {
    console.log('🔧 Assigning service account:', { serviceType, account });
    const newAssignments = {
      ...assignments,
      service: {
        ...assignments.service,
        [serviceType]: {
          account,
          assignedAt: new Date()
        }
      }
    };
    setAssignments(newAssignments);
    saveAssignments(newAssignments);
    toast.success(`Assigned ${account.displayName} to ${serviceType} shipments`);
  }, [assignments]);

  // Assign account to individual shipment
  const assignShipmentAccount = useCallback((shipmentId: number, account: AccountInfo) => {
    console.log('📦 Assigning shipment account:', { shipmentId, account });
    const newAssignments = {
      ...assignments,
      individual: {
        ...assignments.individual,
        [shipmentId]: {
          account,
          assignedAt: new Date(),
          isOverride: true
        }
      }
    };
    setAssignments(newAssignments);
    saveAssignments(newAssignments);
  }, [assignments]);

  // Get assignment for specific shipment
  const getShipmentAssignment = useCallback((shipmentId: number): AccountAssignment | null => {
    const individual = assignments.individual[shipmentId];
    if (individual) {
      return {
        shipmentId,
        assignedAccount: individual.account,
        rate: 0, // Calculate from shipment data
        savings: 0, // Calculate from shipment data
        isOverride: individual.isOverride
      };
    }
    return null;
  }, [assignments]);

  // Calculate total metrics with current assignments
  const totalMetrics = useMemo(() => {
    let totalSavings = 0;
    let totalCost = 0;
    let assignedShipments = 0;
    
    // Calculate metrics based on current assignments
    shipmentData.forEach(shipment => {
      const assignment = getShipmentAssignment(shipment.id);
      if (assignment || assignments.global) {
        totalSavings += shipment.savings || 0;
        totalCost += shipment.newRate || 0;
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
  }, [shipmentData, assignments, getShipmentAssignment]);

  return {
    availableAccounts,
    accountPerformance,
    serviceRecommendations,
    assignments,
    totalMetrics,
    assignGlobalAccount,
    assignServiceAccount,
    assignShipmentAccount,
    getShipmentAssignment
  };
};