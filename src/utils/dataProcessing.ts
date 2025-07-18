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
    client_id: analysis.client_id
  };
};

// Legacy function for backward compatibility - redirects to unified function
export const processNormalViewData = (recommendations: any[]): ProcessedAnalysisData => {
  console.warn('⚠️ Using legacy processNormalViewData - consider migrating to processAnalysisData');
  
  const validShipments: any[] = [];
  const orphanedShipments: any[] = [];
  
  recommendations.forEach((rec: any, index: number) => {
    const shipmentData = rec.shipment || rec;
    const validation = validateShipmentData(shipmentData);
    
    const formattedShipment = {
      id: index + 1,
      trackingId: shipmentData.trackingId || `Shipment-${index + 1}`,
      originZip: shipmentData.originZip || '',
      destinationZip: shipmentData.destZip || shipmentData.destinationZip || '',
      weight: parseFloat(shipmentData.weight || '0'),
      length: parseFloat(shipmentData.length || rec.length || '12'),
      width: parseFloat(shipmentData.width || rec.width || '12'),
      height: parseFloat(shipmentData.height || rec.height || '6'),
      dimensions: shipmentData.dimensions || rec.dimensions,
      carrier: shipmentData.carrier || rec.carrier || 'Unknown',
      service: rec.originalService || shipmentData.service || '',
      originalService: rec.originalService || shipmentData.service || '',
      bestService: rec.bestService || rec.recommendedService || 'UPS Ground',
      newService: rec.recommendedService || rec.bestService || 'UPS Ground',
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

// Convert recommendations to formatted shipment data
export const formatShipmentData = (recommendations: any[]): ProcessedShipmentData[] => {
  console.log('🔍 formatShipmentData - Processing recommendations:', recommendations?.length || 0, 'items');
  if (recommendations?.length > 0) {
    console.log('🔍 Sample recommendation data structure:', {
      keys: Object.keys(recommendations[0]),
      sampleData: recommendations[0]
    });
  }
  
  return recommendations.map((rec: any, index: number) => {
    // More flexible rate extraction - try multiple possible field names
    const currentRate = rec.currentCost || rec.current_rate || rec.currentRate || 
                       rec.shipment?.currentRate || rec.shipment?.current_rate || 0;
    const newRate = rec.recommendedCost || rec.recommended_cost || rec.newRate || 
                   rec.shipment?.newRate || rec.shipment?.recommended_cost || 0;
    const calculatedSavings = currentRate - newRate;
    
    if (index < 3) { // Debug first 3 items
      console.log(`🔍 Processing shipment ${index + 1}:`, {
        trackingId: rec.shipment?.trackingId || rec.trackingId,
        currentRate,
        newRate,
        calculatedSavings,
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
      carrier: rec.account || rec.accountName || rec.account_name ||
               rec.client || rec.clientName || rec.client_name ||
               rec.customerAccount || rec.customer_account ||
               rec.shipment?.account || rec.shipment?.accountName ||
               rec.shipment?.client || rec.shipment?.clientName ||
               rec.shipment?.carrier || rec.carrier || 'Unknown',
      service: rec.originalService || rec.service || 'Unknown',
      originalService: rec.originalService || rec.service || 'Unknown',
      bestService: rec.bestService || rec.recommendedService || 'UPS Ground',
      newService: rec.recommendedService || rec.bestService || 'UPS Ground',
      currentRate,
      newRate,
      savings: rec.savings || calculatedSavings || 0,
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
      'Current Service': item.originalService || item.currentService || '',
      'Ship Pros Service': item.service,
      'Current Rate': `$${item.currentRate.toFixed(2)}`,
      'Ship Pros Cost': `$${markupInfo.markedUpPrice.toFixed(2)}`,
      'Savings': `$${savings.toFixed(2)}`,
      'Savings Percentage': `${savingsPercent.toFixed(1)}%`
    };
  });
};