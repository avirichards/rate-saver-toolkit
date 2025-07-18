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
    totalShipments: analysis.total_shipments
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
    orphanedShipmentsCount: orphanedShipments.length
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

// Enhanced account data extraction for the new standardized format
const extractAccountData = (shipment: any): any[] => {
  console.log('🔍 extractAccountData - Analyzing shipment structure:', {
    shipmentId: shipment.id || shipment.trackingId,
    availableFields: Object.keys(shipment),
    hasAccounts: !!shipment.accounts,
    hasAllRates: !!shipment.allRates,
    hasCarrierResults: !!shipment.carrierResults,
    hasMultiCarrierResults: !!shipment.multi_carrier_results
  });
  
  // Priority order for account data sources - new standardized format first
  const sources = [
    { name: 'multi_carrier_results.allRates', data: shipment.multi_carrier_results?.allRates },
    { name: 'multi_carrier_results.carrierResults', data: shipment.multi_carrier_results?.carrierResults },
    { name: 'allRates', data: shipment.allRates },
    { name: 'carrierResults', data: shipment.carrierResults },
    { name: 'accounts', data: shipment.accounts },
    { name: 'rates', data: shipment.rates },
    { name: 'ups_response.rates', data: shipment.ups_response?.rates }
  ];
  
  for (const source of sources) {
    if (source.data && Array.isArray(source.data) && source.data.length > 0) {
      console.log(`✅ Found account data in ${source.name}:`, source.data.slice(0, 2));
      
      // Handle carrier results format (contains rates array)
      if (source.name.includes('carrierResults')) {
        const allAccountRates: any[] = [];
        source.data.forEach((carrierResult: any) => {
          if (carrierResult.rates && Array.isArray(carrierResult.rates)) {
            allAccountRates.push(...carrierResult.rates.map((rate: any) => ({
              carrierId: rate.carrierId || carrierResult.carrierId || 'default',
              carrierType: rate.carrierType || carrierResult.carrierType || 'Unknown',
              accountName: rate.accountName || carrierResult.carrierName || 'Default',
              displayName: rate.displayName || carrierResult.displayName || 
                `${rate.carrierType || carrierResult.carrierType || 'Unknown'} – ${rate.accountName || carrierResult.carrierName || 'Default'}`,
              rate: parseFloat(rate.rate || rate.cost || rate.price || rate.totalCharges || '0') || 0,
              service: rate.serviceName || rate.serviceCode || 'Standard',
              ...rate
            })));
          }
        });
        if (allAccountRates.length > 0) {
          return allAccountRates;
        }
      } else {
        // Handle direct rates format
        return source.data.map((account: any) => ({
          carrierId: account.carrierId || account.id || account.carrier_id || 'default',
          carrierType: account.carrierType || account.carrier || account.carrier_name || 'Unknown',
          accountName: account.accountName || account.name || account.account || 'Default',
          displayName: account.displayName || 
            `${account.carrierType || account.carrier || account.carrier_name || 'Unknown'} – ${account.accountName || account.name || account.account || 'Default'}`,
          rate: parseFloat(account.rate || account.cost || account.price || account.total_cost || account.totalCharges || '0') || 0,
          service: account.serviceName || account.serviceType || account.service_type || account.service || 'Standard',
          ...account
        }));
      }
    }
  }
  
  console.log('❌ No account data found in any source for shipment:', shipment.id || shipment.trackingId);
  return [];
};

// Enhanced formatShipmentData to handle multi-carrier results properly
export const formatShipmentData = (recommendations: any[], markup?: any, includeMarkup = false): ProcessedShipmentData[] => {
  console.log('🔍 formatShipmentData - Processing recommendations:', recommendations?.length || 0, 'items');
  if (recommendations?.length > 0) {
    console.log('🔍 Sample recommendation structure:', {
      keys: Object.keys(recommendations[0]),
      hasMultiCarrierResults: !!recommendations[0].multi_carrier_results,
      multiCarrierStructure: recommendations[0].multi_carrier_results ? {
        hasAllRates: !!recommendations[0].multi_carrier_results.allRates,
        allRatesCount: recommendations[0].multi_carrier_results.allRates?.length || 0,
        hasCarrierResults: !!recommendations[0].multi_carrier_results.carrierResults,
        carrierResultsCount: recommendations[0].multi_carrier_results.carrierResults?.length || 0
      } : null
    });
  }
  
  return recommendations.map((rec: any, index: number) => {
    // Enhanced rate extraction - prioritize multi-carrier results
    const currentRate = rec.currentCost || rec.current_rate || rec.currentRate || 
                       rec.shipment?.currentRate || rec.shipment?.current_rate || 0;
    
    // For new rate, prefer the best rate from multi-carrier results
    let newRate = rec.recommendedCost || rec.recommended_cost || rec.newRate || 
                  rec.shipment?.newRate || rec.shipment?.recommended_cost || 0;
    
    // If we have multi-carrier results, use the best rate
    if (rec.multi_carrier_results?.bestRates && rec.multi_carrier_results.bestRates.length > 0) {
      const bestRate = rec.multi_carrier_results.bestRates[0];
      newRate = bestRate.rate || bestRate.cost || bestRate.totalCharges || newRate;
    }
    
    const calculatedSavings = currentRate - newRate;
    
    // Extract account data using the enhanced function
    const extractedAccounts = extractAccountData(rec);
    
    console.log('🏢 Account extraction for shipment:', {
      shipmentId: rec.id || rec.trackingId || index,
      accountsFound: extractedAccounts.length,
      sampleAccount: extractedAccounts[0],
      hasMultiCarrierData: !!rec.multi_carrier_results
    });
    
    // Calculate markup if provided
    let finalNewRate = newRate;
    if (includeMarkup && markup && finalNewRate > 0) {
      if (markup.markupType === 'global') {
        finalNewRate = finalNewRate * (1 + markup.globalMarkup / 100);
      } else {
        const serviceMarkup = markup.perServiceMarkup?.[rec.service] || 0;
        finalNewRate = finalNewRate * (1 + serviceMarkup / 100);
      }
    }
    
    return {
      id: index + 1,
      trackingId: rec.trackingId || rec.tracking_id || rec.Tracking_ID || `SHIP-${String(index + 1).padStart(4, '0')}`,
      originZip: rec.originZip || rec.origin_zip || rec.Origin_Zip || rec.fromZip || rec.from_zip || 'N/A',
      destinationZip: rec.destinationZip || rec.destination_zip || rec.destZip || rec.dest_zip || rec.Destination_Zip || rec.toZip || rec.to_zip || 'N/A',
      weight: parseFloat(rec.weight || rec.Weight || rec.weight_lbs || '0') || 0,
      length: parseFloat(rec.length || rec.Length || '0') || undefined,
      width: parseFloat(rec.width || rec.Width || '0') || undefined,
      height: parseFloat(rec.height || rec.Height || '0') || undefined,
      dimensions: rec.dimensions || (rec.length && rec.width && rec.height ? `${rec.length}x${rec.width}x${rec.height}` : undefined),
      carrier: rec.carrier || rec.Carrier || rec.current_carrier || 'Unknown',
      service: rec.service || rec.Service || rec.newService || rec.bestService || rec.Ship_Pros_Service || 'Standard',
      originalService: rec.originalService || rec.original_service || rec.current_service || rec.Service || 'Unknown',
      bestService: rec.bestService || rec.best_service || rec.Ship_Pros_Service || rec.newService,
      newService: rec.newService || rec.new_service || rec.Ship_Pros_Service || rec.bestService,
      currentRate: parseFloat(String(currentRate)) || 0,
      newRate: finalNewRate,
      savings: calculatedSavings,
      savingsPercent: calculateSavingsPercent(currentRate, finalNewRate),
      
      // Enhanced multi-carrier account data
      accounts: extractedAccounts,
      allRates: rec.multi_carrier_results?.allRates || rec.allRates || rec.rates || [],
      carrierResults: rec.multi_carrier_results?.carrierResults || rec.carrierResults || [],
      rates: rec.rates || rec.multi_carrier_results?.allRates || []
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
