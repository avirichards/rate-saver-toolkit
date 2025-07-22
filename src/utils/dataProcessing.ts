
import { toast } from 'sonner';
import { UnifiedAnalysisData, UnifiedShipmentData, UnifiedOrphanedShipment, DatabaseAnalysisFormat } from '@/types/analysisTypes';

// Standardized interfaces for data processing
export interface ProcessedAnalysisData extends UnifiedAnalysisData {}
export interface ProcessedShipmentData extends UnifiedShipmentData {}

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

// Convert raw analysis data to unified format
export const convertToUnifiedFormat = (rawData: any): UnifiedAnalysisData => {
  console.log('🔄 Converting raw data to unified format:', rawData);
  
  const validShipments: UnifiedShipmentData[] = [];
  const orphanedShipments: UnifiedOrphanedShipment[] = [];
  
  // Handle different input formats
  const recommendations = rawData.recommendations || rawData.processed_shipments || [];
  const orphaned = rawData.orphanedShipments || rawData.orphaned_shipments || [];
  
  // Process valid shipments
  recommendations.forEach((rec: any, index: number) => {
    const shipmentData = rec.shipment || rec;
    const validation = validateShipmentData(shipmentData);
    
    if (rec.status === 'error' || rec.error || !validation.isValid) {
      orphanedShipments.push({
        id: index + 1,
        trackingId: shipmentData.trackingId || `Shipment-${index + 1}`,
        error: rec.error || `Missing required data: ${validation.missingFields.join(', ')}`,
        errorType: rec.errorType || validation.errorType,
        missingFields: validation.missingFields,
        rawData: rec
      });
    } else {
      validShipments.push({
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
        currentRate: rec.currentCost || rec.currentRate || 0,
        newRate: rec.recommendedCost || rec.newRate || 0,
        savings: rec.savings || 0,
        savingsPercent: rec.currentCost > 0 ? (rec.savings / rec.currentCost) * 100 : 0
      });
    }
  });
  
  // Add any existing orphaned shipments
  orphaned.forEach((orphan: any, index: number) => {
    orphanedShipments.push({
      id: validShipments.length + index + 1,
      trackingId: orphan.trackingId || `Orphan-${index + 1}`,
      error: orphan.error || 'Processing error',
      errorType: orphan.errorType || 'unknown',
      missingFields: orphan.missingFields || [],
      rawData: orphan
    });
  });
  
  const totalCurrentCost = validShipments.reduce((sum, item) => sum + (item.currentRate || 0), 0);
  const totalPotentialSavings = validShipments.reduce((sum, item) => sum + (item.savings || 0), 0);
  
  return {
    totalCurrentCost,
    totalPotentialSavings,
    recommendations: validShipments,
    orphanedShipments,
    savingsPercentage: totalCurrentCost > 0 ? (totalPotentialSavings / totalCurrentCost) * 100 : 0,
    totalShipments: rawData.totalShipments || (validShipments.length + orphanedShipments.length),
    analyzedShipments: validShipments.length,
    completedShipments: validShipments.length,
    errorShipments: orphanedShipments.length,
    averageSavingsPercent: validShipments.length > 0 ? validShipments.reduce((sum, s) => sum + s.savingsPercent, 0) / validShipments.length : 0,
    file_name: rawData.file_name,
    report_name: rawData.report_name,
    client_id: rawData.client_id
  };
};

// Convert unified format to database format
export const convertToDatabaseFormat = (unifiedData: UnifiedAnalysisData): DatabaseAnalysisFormat => {
  console.log('💾 Converting unified data to database format');
  
  return {
    processed_shipments: unifiedData.recommendations,
    orphaned_shipments: unifiedData.orphanedShipments,
    total_shipments: unifiedData.totalShipments,
    total_savings: unifiedData.totalPotentialSavings,
    savings_analysis: {
      savingsPercentage: unifiedData.savingsPercentage,
      completedShipments: unifiedData.completedShipments,
      errorShipments: unifiedData.errorShipments,
      averageSavingsPercent: unifiedData.averageSavingsPercent
    },
    file_name: unifiedData.file_name || '',
    report_name: unifiedData.report_name,
    client_id: unifiedData.client_id
  };
};

// Convert database format back to unified format
export const convertFromDatabaseFormat = (dbData: any): UnifiedAnalysisData => {
  console.log('📖 Converting database data to unified format:', dbData);
  
  // Handle case where data is already in unified format
  if (dbData.recommendations && Array.isArray(dbData.recommendations)) {
    return dbData as UnifiedAnalysisData;
  }
  
  const processedShipments = dbData.processed_shipments || [];
  const orphanedShipments = dbData.orphaned_shipments || [];
  const savingsAnalysis = dbData.savings_analysis || {};
  
  const totalCurrentCost = processedShipments.reduce((sum: number, item: any) => sum + (item.currentRate || 0), 0);
  
  return {
    totalCurrentCost,
    totalPotentialSavings: dbData.total_savings || 0,
    recommendations: processedShipments,
    orphanedShipments,
    savingsPercentage: savingsAnalysis.savingsPercentage || 0,
    totalShipments: dbData.total_shipments || 0,
    analyzedShipments: processedShipments.length,
    completedShipments: savingsAnalysis.completedShipments || processedShipments.length,
    errorShipments: savingsAnalysis.errorShipments || orphanedShipments.length,
    averageSavingsPercent: savingsAnalysis.averageSavingsPercent,
    file_name: dbData.file_name,
    report_name: dbData.report_name,
    client_id: dbData.client_id
  };
};

// Main processing function - now uses unified format
export const processAnalysisData = (analysis: any, getShipmentMarkup?: (shipment: any) => any): ProcessedAnalysisData => {
  console.log('🔄 Processing analysis data with unified format:', analysis);
  
  // If data is from database, convert it first
  if (analysis.processed_shipments || analysis.orphaned_shipments) {
    return convertFromDatabaseFormat(analysis);
  }
  
  // If data is from fresh analysis, convert it
  return convertToUnifiedFormat(analysis);
};

// Legacy functions for backward compatibility
export const processNormalViewData = (recommendations: any[]): ProcessedAnalysisData => {
  console.warn('⚠️ Using legacy processNormalViewData - migrating to unified format');
  return convertToUnifiedFormat({ recommendations });
};

export const processClientViewData = (analysis: any): ProcessedAnalysisData => {
  console.warn('⚠️ Using legacy processClientViewData - migrating to unified format');
  return processAnalysisData(analysis);
};

// Convert recommendations to formatted shipment data (legacy compatibility)
export const formatShipmentData = (recommendations: any[]): ProcessedShipmentData[] => {
  console.log('🔍 formatShipmentData - Processing recommendations with unified format');
  const unified = convertToUnifiedFormat({ recommendations });
  return unified.recommendations;
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
