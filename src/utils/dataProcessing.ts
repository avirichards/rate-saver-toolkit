
import { toast } from 'sonner';

// Standardized interfaces for data processing
export interface ProcessedAnalysisData {
  totalCurrentCost: number;
  totalPotentialSavings: number;
  recommendations: any[];
  savingsPercentage: number;
  totalShipments: number;
  analyzedShipments: number;
  orphanedShipments?: any[];
  completedShipments?: number;
  errorShipments?: number;
  averageSavingsPercent?: number;
  file_name?: string;
  report_name?: string;
  client_id?: string;
  bestAccount?: string;
  serviceMappings?: any[];
}

export interface ProcessedShipmentData {
  id: number;
  trackingId: string;
  originZip: string;
  destinationZip: string;
  weight: number;
  length?: number;
  width?: number;
  height?: number;
  dimensions?: string;
  carrier: string;
  service: string;
  originalService?: string;
  bestService?: string;
  newService?: string;
  currentRate: number;
  newRate: number;
  savings: number;
  savingsPercent: number;
  account?: string;
  accountName?: string;
  accountId?: string;
  analyzedWithAccount?: {
    name: string;
    id: string;
  };
}

export interface ValidationResult {
  isValid: boolean;
  missingFields: string[];
  errorType: string;
}

// Validate shipment data completeness
export const validateShipmentData = (shipment: any): ValidationResult => {
  const requiredFields = ['originZip', 'destZip', 'weight'];
  const missingFields: string[] = [];
  
  requiredFields.forEach(field => {
    const value = shipment[field] || shipment[field === 'destZip' ? 'destinationZip' : field];
    if (!value || value === '' || value === '0') {
      missingFields.push(field);
    }
  });
  
  return {
    isValid: missingFields.length === 0,
    missingFields,
    errorType: missingFields.length > 0 ? 'missing_data' : 'none'
  };
};

// Helper function to determine best overall account based on total cost across all shipments
const determineBestOverallAccount = (shipmentRates: any[]): string | null => {
  if (!shipmentRates || shipmentRates.length === 0) return null;
  
  // Group rates by account and calculate total cost for ALL shipments
  const accountTotals = shipmentRates.reduce((acc: any, rate: any) => {
    const accountName = rate.account_name;
    const shipmentIndex = rate.shipment_index;
    
    if (!acc[accountName]) {
      acc[accountName] = {
        totalCost: 0,
        shipmentCosts: new Map()
      };
    }
    
    // Only count each shipment once per account (use lowest rate for that shipment)
    const currentCost = acc[accountName].shipmentCosts.get(shipmentIndex);
    const newCost = rate.rate_amount || 0;
    
    if (!currentCost || newCost < currentCost) {
      const oldCost = currentCost || 0;
      acc[accountName].totalCost = acc[accountName].totalCost - oldCost + newCost;
      acc[accountName].shipmentCosts.set(shipmentIndex, newCost);
    }
    
    return acc;
  }, {});
  
  // Find account with lowest total cost across all shipments
  let bestAccount = null;
  let lowestTotalCost = Infinity;
  
  Object.entries(accountTotals).forEach(([accountName, metrics]: [string, any]) => {
    if (metrics.totalCost < lowestTotalCost) {
      lowestTotalCost = metrics.totalCost;
      bestAccount = accountName;
    }
  });
  
  console.log('🏆 Best overall account determined:', bestAccount, 'with total cost:', lowestTotalCost);
  return bestAccount;
};

// Unified data processing function - works from standardized database fields
export const processAnalysisData = (analysis: any, getShipmentMarkup?: (shipment: any) => any, shipmentRates?: any[]): ProcessedAnalysisData => {
  console.log('🔄 Processing analysis data from standardized fields:', analysis);
  
  // Use the centralized data structure: processed_shipments and orphaned_shipments
  const processedShipments = analysis.processed_shipments || [];
  const orphanedShipments = analysis.orphaned_shipments || [];
  const markupData = analysis.markup_data;
  
  // Determine best overall account if shipment rates are provided
  const bestAccount = shipmentRates ? determineBestOverallAccount(shipmentRates) : null;
  
  console.log('📊 Data sources:', {
    processedShipmentsCount: processedShipments.length,
    orphanedShipmentsCount: orphanedShipments.length,
    hasMarkupData: !!markupData,
    totalShipments: analysis.total_shipments,
    bestAccount
  });
  
  // Calculate totals from processed shipments - with markup applied if available
  let totalCurrentCost = 0;
  let totalPotentialSavings = 0;
  
  if (markupData && getShipmentMarkup) {
    // Calculate with markup applied
    processedShipments.forEach((item: any) => {
      const markupInfo = getShipmentMarkup(item);
      const savings = item.currentRate - markupInfo.markedUpPrice;
      totalCurrentCost += item.currentRate || 0;
      totalPotentialSavings += savings;
    });
    console.log('✅ Applied markup calculations to totals');
  } else {
    // Fallback to raw values
    totalCurrentCost = processedShipments.reduce((sum: number, item: any) => sum + (item.currentRate || 0), 0);
    totalPotentialSavings = processedShipments.reduce((sum: number, item: any) => sum + (item.savings || 0), 0);
    console.log('⚠️ Using raw savings (no markup applied)');
  }
  
  return {
    totalCurrentCost,
    totalPotentialSavings,
    recommendations: processedShipments,
    savingsPercentage: totalCurrentCost > 0 ? (totalPotentialSavings / totalCurrentCost) * 100 : 0,
    totalShipments: analysis.total_shipments || (processedShipments.length + orphanedShipments.length),
    analyzedShipments: processedShipments.length,
    orphanedShipments,
    completedShipments: processedShipments.length,
    errorShipments: orphanedShipments.length,
    file_name: analysis.file_name,
    report_name: analysis.report_name,
    client_id: analysis.client_id,
    bestAccount
  };
};

// Convert recommendations to formatted shipment data - using best overall account with service mapping
export const formatShipmentData = (recommendations: any[], shipmentRates?: any[], bestAccount?: string, serviceMappings?: any[]): ProcessedShipmentData[] => {
  console.log('🔍 formatShipmentData - Processing recommendations:', recommendations?.length || 0, 'items');
  console.log('🔍 Using best account for all shipments:', bestAccount);
  console.log('🔍 Service mappings available:', serviceMappings?.length || 0);
  
  if (recommendations?.length > 0) {
    console.log('🔍 Sample recommendation data structure:', {
      keys: Object.keys(recommendations[0]),
      sampleData: recommendations[0]
    });
  }
  
  // Create a lookup map for service mappings
  const serviceMappingLookup = new Map();
  if (serviceMappings) {
    serviceMappings.forEach(mapping => {
      serviceMappingLookup.set(mapping.original, mapping.standardized);
    });
  }
  
  return recommendations.map((rec: any, index: number) => {
    // Get current rate from original data
    const currentRate = rec.currentCost || rec.current_rate || rec.currentRate || 
                       rec.shipment?.currentRate || rec.shipment?.current_rate || 0;
    
    const originalService = rec.originalService || rec.service || 'Unknown';
    
    // Find the rate for this shipment from the best overall account
    let newRate = 0;
    let bestService = 'No Quote Available';
    let shipProsService = originalService; // Default to original service
    
    if (bestAccount && shipmentRates) {
      const shipmentTrackingId = rec.shipment?.trackingId || rec.trackingId;
      
      // Find rates for this specific shipment from the best account
      const bestAccountRates = shipmentRates.filter(rate => 
        rate.account_name === bestAccount && 
        (rate.shipment_data?.trackingId === shipmentTrackingId || rate.shipment_index === index)
      );
      
      if (bestAccountRates.length > 0) {
        // Use service mapping to find the appropriate service
        const mappedServiceName = serviceMappingLookup.get(originalService);
        
        let selectedRate = null;
        
        if (mappedServiceName) {
          // Try to find a rate that matches the mapped service
          selectedRate = bestAccountRates.find(rate => 
            rate.service_name === mappedServiceName || 
            rate.service_name?.includes(mappedServiceName?.replace('UPS ', ''))
          );
        }
        
        // If no mapped service rate found, use the cheapest available rate from the best account
        if (!selectedRate && bestAccountRates.length > 0) {
          selectedRate = bestAccountRates.reduce((cheapest, current) => 
            (current.rate_amount || 0) < (cheapest.rate_amount || 0) ? current : cheapest
          );
        }
        
        if (selectedRate) {
          newRate = selectedRate.rate_amount || 0;
          bestService = selectedRate.service_name || selectedRate.service_code || 'UPS Ground';
          // Use the mapped service name for Ship Pros Service Type
          shipProsService = mappedServiceName || bestService;
          
          console.log(`📋 Using rate from best account "${bestAccount}" for shipment ${index + 1}:`, {
            trackingId: rec.shipment?.trackingId || rec.trackingId,
            service: selectedRate.service_name,
            rate: selectedRate.rate_amount
          });
        } else {
          console.warn(`⚠️ No rates found for shipment ${index + 1} from best account "${bestAccount}"`);
        }
      } else {
        console.warn(`⚠️ No rates available for shipment ${index + 1} from best account "${bestAccount}"`);
      }
    } else {
      // Fallback to original logic if no best account determined
      newRate = rec.recommendedCost || rec.recommended_cost || rec.newRate || 
                rec.shipment?.newRate || rec.shipment?.recommended_cost || 0;
      bestService = rec.bestService || rec.recommendedService || 'UPS Ground';
      
      // Still apply service mapping for consistency
      const mappedServiceName = serviceMappingLookup.get(originalService);
      shipProsService = mappedServiceName || bestService;
    }
    
    const calculatedSavings = currentRate - newRate;
    
    if (index < 3) { // Debug first 3 items
      console.log(`🔍 Processing shipment ${index + 1}:`, {
        trackingId: rec.shipment?.trackingId || rec.trackingId,
        originalService,
        mappedService: serviceMappingLookup.get(originalService),
        shipProsService,
        currentRate,
        newRate,
        calculatedSavings,
        bestAccount,
        bestService
      });
    }
    
    // Determine which account was actually used for this rate
    const usedAccount = bestAccount || rec.account || rec.accountName || 'Default Account';
    const usedAccountId = bestAccount ? 
      shipmentRates?.find(rate => rate.account_name === bestAccount)?.carrier_config_id || 'unknown' : 
      'unknown';

    return {
      id: index + 1,
      trackingId: rec.shipment?.trackingId || rec.trackingId || `Shipment-${index + 1}`,
      originZip: rec.shipment?.originZip || rec.originZip || '',
      destinationZip: rec.shipment?.destZip || rec.destinationZip || '',
      weight: parseFloat(rec.shipment?.weight || rec.weight || '0'),
      length: parseFloat(rec.shipment?.length || rec.length || '0'),
      width: parseFloat(rec.shipment?.width || rec.width || '0'),
      height: parseFloat(rec.shipment?.height || rec.height || '0'),
      dimensions: rec.shipment?.dimensions || rec.dimensions,
      carrier: rec.shipment?.carrier || rec.carrier || 'Unknown',
      service: shipProsService, // This is the "Ship Pros Service Type" column
      originalService: originalService,
      bestService: bestService,
      newService: shipProsService,
      currentRate,
      newRate,
      savings: calculatedSavings || 0,
      savingsPercent: currentRate > 0 ? (calculatedSavings / currentRate) * 100 : 0,
      // Ensure account fields are consistent and show the actual account used
      account: usedAccount,
      accountName: usedAccount,
      accountId: usedAccountId,
      analyzedWithAccount: {
        name: usedAccount,
        id: usedAccountId
      }
    };
  });
};

// Error handling utility
export const handleDataProcessingError = (error: any, context: string): void => {
  console.error(`❌ Error in ${context}:`, error);
  
  if (context.includes('client')) {
    toast.error('Failed to load shared report. The link may be invalid or expired.');
  } else {
    toast.error('Failed to load analysis results');
  }
};

// Generate CSV export data with markup
export const generateExportData = (filteredData: any[], getShipmentMarkup: (shipment: any) => any) => {
  return filteredData.map(item => {
    const markupInfo = getShipmentMarkup(item);
    const savings = item.currentRate - markupInfo.markedUpPrice;
    const savingsPercent = item.currentRate > 0 ? (savings / item.currentRate) * 100 : 0;
    return {
      'Tracking ID': item.trackingId,
      'Origin ZIP': item.originZip,
      'Destination ZIP': item.destinationZip,
      'Weight': item.weight,
      'Dimensions': item.dimensions || `${item.length || 0}x${item.width || 0}x${item.height || 0}`,
      'Current Service': item.originalService || item.currentService || '',
      'Ship Pros Service': item.service,
      'Current Rate': `$${item.currentRate.toFixed(2)}`,
      'Ship Pros Cost': `$${markupInfo.markedUpPrice.toFixed(2)}`,
      'Savings': `$${savings.toFixed(2)}`,
      'Savings Percentage': `${savingsPercent.toFixed(1)}%`
    };
  });
};
