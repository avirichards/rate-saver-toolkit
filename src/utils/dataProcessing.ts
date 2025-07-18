
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
  // Account data for Account Review tab
  accounts?: any[];
  rates?: any[];
  allRates?: any[];
  carrierResults?: any[];
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

// Unified data processing function - works from standardized database fields
export const processAnalysisData = (analysis: any, getShipmentMarkup?: (shipment: any) => any): ProcessedAnalysisData => {
  console.log('🔄 Processing analysis data from standardized fields:', analysis);
  
  // Use the centralized data structure: processed_shipments and orphaned_shipments
  const processedShipments = analysis.processed_shipments || [];
  const orphanedShipments = analysis.orphaned_shipments || [];
  const markupData = analysis.markup_data;
  
  console.log('📊 Data sources:', {
    processedShipmentsCount: processedShipments.length,
    orphanedShipmentsCount: orphanedShipments.length,
    hasMarkupData: !!markupData,
    totalShipments: analysis.total_shipments,
    sampleProcessedShipment: processedShipments[0] ? {
      hasAccounts: !!processedShipments[0].accounts,
      accountsCount: processedShipments[0].accounts?.length || 0,
      hasAllRates: !!processedShipments[0].allRates,
      allRatesCount: processedShipments[0].allRates?.length || 0,
      hasCarrierResults: !!processedShipments[0].carrierResults,
      carrierResultsCount: processedShipments[0].carrierResults?.length || 0
    } : null
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
    // Calculate without markup
    processedShipments.forEach((item: any) => {
      totalCurrentCost += item.currentRate || 0;
      totalPotentialSavings += item.savings || 0;
    });
    console.log('✅ Calculated totals without markup');
  }
  
  const result = {
    totalCurrentCost,
    totalPotentialSavings: Math.max(0, totalPotentialSavings),
    recommendations: processedShipments,
    savingsPercentage: totalCurrentCost > 0 ? (totalPotentialSavings / totalCurrentCost) * 100 : 0,
    totalShipments: analysis.total_shipments || processedShipments.length,
    analyzedShipments: processedShipments.length,
    orphanedShipments: orphanedShipments,
    completedShipments: processedShipments.length,
    errorShipments: orphanedShipments.length,
    averageSavingsPercent: processedShipments.length > 0 ? 
      processedShipments.reduce((sum: number, item: any) => sum + (item.savingsPercent || 0), 0) / processedShipments.length : 0,
    file_name: analysis.file_name,
    report_name: analysis.report_name,
    client_id: analysis.client_id
  };
  
  console.log('📈 Final processed data:', {
    totalCurrentCost,
    totalPotentialSavings,
    savingsPercentage: result.savingsPercentage,
    totalShipments: result.totalShipments,
    analyzedShipments: result.analyzedShipments,
    orphanedShipmentsCount: orphanedShipments.length,
    hasAccountData: processedShipments.some((ship: any) => ship.accounts && ship.accounts.length > 0)
  });
  
  return result;
};

// Calculate savings percentage with proper validation
const calculateSavingsPercent = (currentRate: number, newRate: number): number => {
  if (currentRate <= 0) return 0;
  return ((currentRate - newRate) / currentRate) * 100;
};

// Legacy migration handler
export const processLegacyRecommendationsData = (recommendations: any[]): ProcessedAnalysisData => {
  console.log('🔄 Processing legacy recommendations data...');
  const validShipments: any[] = [];
  const orphanedShipments: any[] = [];
  
  recommendations.forEach((rec: any) => {
    const validation = validateShipmentData(rec);
    
    const formattedShipment = {
      id: rec.id || validShipments.length + 1,
      trackingId: rec.trackingId || rec.tracking_id || `SHIP-${String(validShipments.length + 1).padStart(4, '0')}`,
      originZip: rec.originZip || rec.origin_zip || 'N/A',
      destinationZip: rec.destZip || rec.destination_zip || 'N/A',
      weight: parseFloat(rec.weight || '0') || 0,
      carrier: rec.carrier || 'Unknown',
      service: rec.service || 'Standard',
      originalService: rec.originalService || rec.current_service || 'Unknown',
      currentRate: rec.currentCost || 0,
      newRate: rec.recommendedCost || 0,
      savings: rec.savings || 0,
      savingsPercent: rec.currentCost > 0 ? (rec.savings / rec.currentCost) * 100 : 0
    };
    
    if (rec.status === 'error' || rec.error || !validation.isValid) {
      orphanedShipments.push({
        ...formattedShipment,
        error: rec.error || `Missing required data: ${validation.missingFields.join(', ')}`,
        errorType: rec.errorType || validation.errorType,
        missingFields: validation.missingFields
      });
    } else {
      validShipments.push(formattedShipment);
    }
  });
  
  const totalCurrentCost = validShipments.reduce((sum, item) => sum + (item.currentRate || 0), 0);
  const totalPotentialSavings = validShipments.reduce((sum, item) => sum + (item.savings || 0), 0);
  
  return {
    totalCurrentCost,
    totalPotentialSavings,
    recommendations: validShipments,
    savingsPercentage: totalCurrentCost > 0 ? (totalPotentialSavings / totalCurrentCost) * 100 : 0,
    totalShipments: recommendations.length,
    analyzedShipments: validShipments.length,
    orphanedShipments,
    completedShipments: validShipments.length,
    errorShipments: orphanedShipments.length
  };
};

// Legacy function for backward compatibility - redirects to unified function
export const processClientViewData = (analysis: any): ProcessedAnalysisData => {
  console.warn('⚠️ Using legacy processClientViewData - consider migrating to processAnalysisData');
  return processAnalysisData(analysis);
};

// Enhanced formatShipmentData to work with the new processed_shipments structure
export const formatShipmentData = (recommendations: any[], markup?: any, includeMarkup = false): ProcessedShipmentData[] => {
  console.log('🔍 formatShipmentData - Processing recommendations:', recommendations?.length || 0, 'items');
  
  // The recommendations parameter now comes directly from processed_shipments
  // which already has the enhanced multi-carrier data structure
  return recommendations.map((shipment: any, index: number) => {
    // Data is already processed and standardized in the new pipeline
    const currentRate = shipment.currentRate || 0;
    let newRate = shipment.newRate || 0;
    
    // Calculate markup if provided
    if (includeMarkup && markup && newRate > 0) {
      if (markup.markupType === 'global') {
        newRate = newRate * (1 + markup.globalMarkup / 100);
      } else {
        const serviceMarkup = markup.perServiceMarkup?.[shipment.service] || 0;
        newRate = newRate * (1 + serviceMarkup / 100);
      }
    }
    
    const calculatedSavings = currentRate - newRate;
    
    console.log(`🏢 Shipment ${shipment.trackingId} account data:`, {
      hasAccounts: !!shipment.accounts,
      accountsCount: shipment.accounts?.length || 0,
      hasAllRates: !!shipment.allRates,
      allRatesCount: shipment.allRates?.length || 0,
      hasCarrierResults: !!shipment.carrierResults,
      carrierResultsCount: shipment.carrierResults?.length || 0
    });
    
    return {
      id: shipment.id || index + 1,
      trackingId: shipment.trackingId || `SHIP-${String(index + 1).padStart(4, '0')}`,
      originZip: shipment.originZip || 'N/A',
      destinationZip: shipment.destinationZip || 'N/A',
      weight: shipment.weight || 0,
      length: shipment.length,
      width: shipment.width,
      height: shipment.height,
      dimensions: shipment.dimensions,
      carrier: shipment.carrier || 'Unknown',
      service: shipment.service || 'Standard',
      originalService: shipment.originalService || 'Unknown',
      bestService: shipment.bestService || shipment.service,
      newService: shipment.newService || shipment.service,
      currentRate: currentRate,
      newRate: newRate,
      savings: calculatedSavings,
      savingsPercent: calculateSavingsPercent(currentRate, newRate),
      
      // Multi-carrier account data (already processed in Analysis.tsx)
      accounts: shipment.accounts || [],
      allRates: shipment.allRates || [],
      carrierResults: shipment.carrierResults || [],
      rates: shipment.allRates || [] // Legacy compatibility
    };
  });
};

// Export utility functions
export const generateExportData = (shipmentData: ProcessedShipmentData[], includeSummary = true) => {
  const exportData = shipmentData.map(item => ({
    'Tracking ID': item.trackingId,
    'Origin Zip': item.originZip,
    'Destination Zip': item.destinationZip,
    'Weight (lbs)': item.weight,
    'Current Carrier': item.carrier,
    'Current Service': item.originalService,
    'Recommended Service': item.service,
    'Current Rate': item.currentRate.toFixed(2),
    'Recommended Rate': item.newRate.toFixed(2),
    'Savings': item.savings.toFixed(2),
    'Savings %': item.savingsPercent.toFixed(1) + '%'
  }));

  if (includeSummary) {
    const totalCurrentCost = shipmentData.reduce((sum, item) => sum + item.currentRate, 0);
    const totalNewCost = shipmentData.reduce((sum, item) => sum + item.newRate, 0);
    const totalSavings = totalCurrentCost - totalNewCost;
    const savingsPercent = totalCurrentCost > 0 ? (totalSavings / totalCurrentCost) * 100 : 0;

    exportData.unshift({
      'Tracking ID': 'SUMMARY',
      'Origin Zip': '',
      'Destination Zip': '',
      'Weight (lbs)': shipmentData.length,
      'Current Carrier': '',
      'Current Service': '',
      'Recommended Service': '',
      'Current Rate': totalCurrentCost.toFixed(2),
      'Recommended Rate': totalNewCost.toFixed(2),
      'Savings': totalSavings.toFixed(2),
      'Savings %': savingsPercent.toFixed(1) + '%'
    });
  }

  return exportData;
};

export const handleDataProcessingError = (error: any, context: string) => {
  console.error(`❌ Data processing error in ${context}:`, error);
  toast.error(`Error processing data: ${error.message}`);
  
  // Return a safe fallback state
  return {
    totalCurrentCost: 0,
    totalPotentialSavings: 0,
    recommendations: [],
    savingsPercentage: 0,
    totalShipments: 0,
    analyzedShipments: 0,
    orphanedShipments: [],
    completedShipments: 0,
    errorShipments: 0
  };
};
