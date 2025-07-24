
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

// Helper function to determine best overall account
const determineBestOverallAccount = (shipmentRates: any[]): string | null => {
  if (!shipmentRates || shipmentRates.length === 0) return null;
  
  // Group rates by account and calculate total metrics
  const accountMetrics = shipmentRates.reduce((acc: any, rate: any) => {
    const accountName = rate.account_name;
    if (!acc[accountName]) {
      acc[accountName] = {
        totalCost: 0,
        totalSavings: 0,
        shipmentCount: 0,
        rates: []
      };
    }
    
    acc[accountName].totalCost += rate.rate_amount || 0;
    acc[accountName].shipmentCount += 1;
    acc[accountName].rates.push(rate);
    
    return acc;
  }, {});
  
  // Find best account based on total savings potential
  let bestAccount = null;
  let bestSavings = -Infinity;
  
  Object.entries(accountMetrics).forEach(([accountName, metrics]: [string, any]) => {
    // Calculate potential savings - this would need original costs to be accurate
    // For now, use account with lowest total cost as proxy for best savings
    const averageCost = metrics.totalCost / metrics.shipmentCount;
    const savingsScore = -averageCost; // Lower cost = higher score
    
    if (savingsScore > bestSavings) {
      bestSavings = savingsScore;
      bestAccount = accountName;
    }
  });
  
  console.log('🏆 Best overall account determined:', bestAccount);
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

// Convert recommendations to formatted shipment data - using best overall account
export const formatShipmentData = (recommendations: any[], shipmentRates?: any[], bestAccount?: string): ProcessedShipmentData[] => {
  console.log('🔍 formatShipmentData - Processing recommendations:', recommendations?.length || 0, 'items');
  console.log('🔍 Using best account for all shipments:', bestAccount);
  
  if (recommendations?.length > 0) {
    console.log('🔍 Sample recommendation data structure:', {
      keys: Object.keys(recommendations[0]),
      sampleData: recommendations[0]
    });
  }
  
  return recommendations.map((rec: any, index: number) => {
    // Get current rate from original data
    const currentRate = rec.currentCost || rec.current_rate || rec.currentRate || 
                       rec.shipment?.currentRate || rec.shipment?.current_rate || 0;
    
    // Find the rate for this shipment from the best overall account
    let newRate = 0;
    let newService = 'No Quote Available';
    
    if (bestAccount && shipmentRates) {
      const bestAccountRate = shipmentRates.find(rate => 
        rate.account_name === bestAccount && rate.shipment_data?.trackingId === rec.trackingId
      );
      
      if (bestAccountRate) {
        newRate = bestAccountRate.rate_amount || 0;
        newService = bestAccountRate.service_name || bestAccountRate.service_code || 'UPS Ground';
      }
    } else {
      // Fallback to original logic if no best account determined
      newRate = rec.recommendedCost || rec.recommended_cost || rec.newRate || 
                rec.shipment?.newRate || rec.shipment?.recommended_cost || 0;
      newService = rec.recommendedService || 'UPS Ground';
    }
    
    const calculatedSavings = currentRate - newRate;
    
    if (index < 3) { // Debug first 3 items
      console.log(`🔍 Processing shipment ${index + 1}:`, {
        trackingId: rec.shipment?.trackingId || rec.trackingId,
        currentRate,
        newRate,
        calculatedSavings,
        bestAccount,
        newService,
        availableFields: Object.keys(rec)
      });
    }
    
    return {
      id: index + 1,
      trackingId: rec.shipment?.trackingId || rec.trackingId || `Shipment-${index + 1}`,
      originZip: rec.shipment?.originZip || rec.originZip || '',
      destinationZip: rec.shipment?.destZip || rec.destinationZip || '',
      weight: parseFloat(rec.shipment?.weight || rec.weight || '0'),
      length: parseFloat(rec.shipment?.length || rec.length || '12'),
      width: parseFloat(rec.shipment?.width || rec.width || '12'),
      height: parseFloat(rec.shipment?.height || rec.height || '6'),
      dimensions: rec.shipment?.dimensions || rec.dimensions,
      carrier: rec.shipment?.carrier || rec.carrier || 'Unknown',
      service: newService,
      originalService: rec.originalService || rec.service || 'Unknown',
      newService: newService,
      currentRate,
      newRate,
      savings: calculatedSavings || 0,
      savingsPercent: currentRate > 0 ? (calculatedSavings / currentRate) * 100 : 0
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
      'Current Service': item.originalService || '',
      'Ship Pros Service': item.service,
      'Current Rate': `$${item.currentRate.toFixed(2)}`,
      'Ship Pros Cost': `$${markupInfo.markedUpPrice.toFixed(2)}`,
      'Savings': `$${savings.toFixed(2)}`,
      'Savings Percentage': `${savingsPercent.toFixed(1)}%`
    };
  });
};
