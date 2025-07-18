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
            global: (data.global_assignment as any) || null,
            service: (data.service_assignments as any) || {},
            individual: Array.isArray(data.account_assignments) ? 
              (data.account_assignments as any[]).reduce((acc: any, assignment: any) => {
                acc[assignment.shipmentId] = assignment;
                return acc;
              }, {}) : {}
          });
          console.log('📥 Loaded assignments from database:', data);
        }
      } catch (error) {
        console.error('❌ Failed to load assignments:', error);
      }
    };

    loadAssignments();
  }, [currentAnalysisId]);

  // Enhanced account extraction with standardized format support
  const availableAccounts = useMemo(() => {
    console.log('🔍 useAccountAssignments - Extracting accounts from shipment data:', {
      shipmentCount: shipmentData.length,
      sampleShipment: shipmentData[0] ? {
        id: shipmentData[0].id,
        trackingId: shipmentData[0].trackingId,
        hasAccounts: !!shipmentData[0].accounts,
        accountsCount: shipmentData[0].accounts?.length || 0,
        hasAllRates: !!shipmentData[0].allRates,
        allRatesCount: shipmentData[0].allRates?.length || 0,
        hasCarrierResults: !!shipmentData[0].carrierResults,
        carrierResultsCount: shipmentData[0].carrierResults?.length || 0
      } : null
    });
    
    const accountMap = new Map<string, AccountInfo>();
    
    shipmentData.forEach((shipment, index) => {
      // Enhanced account sources - prioritize standardized multi-carrier data
      const accountSources = [
        shipment.allRates, // Standardized multi-carrier rates
        shipment.carrierResults, // Multi-carrier results with rates
        shipment.accounts, // Legacy account data
        shipment.rates, // Legacy rates
        shipment.ups_response?.rates, // UPS-specific
        shipment.multi_carrier_results?.allRates, // Direct multi-carrier results
        shipment.multi_carrier_results?.carrierResults // Direct carrier results
      ];
      
      let accounts: any[] = [];
      
      // Handle carrier results format (contains rates arrays)
      for (const source of accountSources) {
        if (source && Array.isArray(source) && source.length > 0) {
          // Check if this is carrier results format
          if (source[0] && source[0].rates && Array.isArray(source[0].rates)) {
            // Extract rates from carrier results
            accounts = source.flatMap((carrierResult: any) => 
              carrierResult.rates?.map((rate: any) => ({
                carrierId: rate.carrierId || carrierResult.carrierId || 'default',
                carrierType: rate.carrierType || carrierResult.carrierType || 'Unknown',
                accountName: rate.accountName || carrierResult.carrierName || 'Default',
                displayName: rate.displayName || carrierResult.displayName || 
                  `${rate.carrierType || carrierResult.carrierType || 'Unknown'} – ${rate.accountName || carrierResult.carrierName || 'Default'}`,
                rate: rate.rate || rate.cost || rate.totalCharges || 0,
                service: rate.serviceName || rate.serviceCode || 'Standard'
              })) || []
            );
            break;
          } else if (source[0] && (source[0].carrierId || source[0].carrierType || source[0].displayName)) {
            // Direct rates format
            accounts = source;
            break;
          }
        }
      }
      
      if (index < 3) {
        console.log(`🔍 Processing shipment ${shipment.id || shipment.trackingId} for accounts:`, {
          accountsFound: accounts.length,
          sourceUsed: accountSources.findIndex(source => source === accounts),
          sampleAccounts: accounts.slice(0, 2).map((acc: any) => ({
            carrier: acc.carrierType,
            account: acc.accountName,
            displayName: acc.displayName,
            rate: acc.rate
          }))
        });
      }
      
      accounts.forEach((account: any) => {
        const carrierType = account.carrierType || account.carrier || account.carrier_name || 'Unknown';
        const accountName = account.accountName || account.name || account.account || 'Default';
        const accountKey = `${carrierType}-${accountName}`;
        
        if (!accountMap.has(accountKey)) {
          accountMap.set(accountKey, {
            carrierId: account.carrierId || account.id || account.carrier_id || 'default',
            accountName,
            carrierType,
            displayName: account.displayName || `${carrierType} – ${accountName}`
          });
        }
      });
    });
    
    const accounts = Array.from(accountMap.values());
    console.log('🔍 useAccountAssignments - Final extracted accounts:', {
      totalAccounts: accounts.length,
      accounts: accounts.map(acc => ({ 
        carrier: acc.carrierType, 
        account: acc.accountName,
        displayName: acc.displayName 
      }))
    });
    
    return accounts;
  }, [shipmentData]);

  // Enhanced account performance calculation with multi-carrier support
  const accountPerformance = useMemo((): AccountPerformance[] => {
    const performanceMap = new Map<string, AccountPerformance>();
    
    shipmentData.forEach(shipment => {
      // Get all available rates for this shipment
      const allRates = shipment.allRates || shipment.accounts || [];
      const carrierResults = shipment.carrierResults || [];
      
      // Combine rates from all sources
      const allAvailableRates: any[] = [];
      
      // Add direct rates
      allAvailableRates.push(...allRates);
      
      // Add rates from carrier results
      carrierResults.forEach((carrierResult: any) => {
        if (carrierResult.rates && Array.isArray(carrierResult.rates)) {
          allAvailableRates.push(...carrierResult.rates);
        }
      });
      
      allAvailableRates.forEach((account: any) => {
        const carrierType = account.carrierType || account.carrier || 'Unknown';
        const accountName = account.accountName || account.name || 'Default';
        const accountKey = `${carrierType}-${accountName}`;
        const rate = account.rate || account.cost || account.totalCharges || 0;
        const savings = shipment.currentRate - rate;
        
        if (!performanceMap.has(accountKey)) {
          performanceMap.set(accountKey, {
            account: {
              carrierId: account.carrierId || account.id || 'default',
              accountName,
              carrierType,
              displayName: account.displayName || `${carrierType} – ${accountName}`
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
      const totalCurrentCost = perf.totalCost + perf.totalSavings;
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
            account: assignment.account,
            assignedAt: assignment.assignedAt.toISOString(),
            isOverride: assignment.isOverride
          })) as any,
          service_assignments: Object.fromEntries(
            Object.entries(newAssignments.service).map(([key, value]) => [
              key, 
              { account: value.account, assignedAt: value.assignedAt.toISOString() }
            ])
          ) as any,
          global_assignment: newAssignments.global ? {
            account: newAssignments.global.account,
            assignedAt: newAssignments.global.assignedAt.toISOString()
          } as any : null,
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
