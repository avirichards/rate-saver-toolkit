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
  carrier: string;
  service: string;
  currentRate: number;
  newRate: number;
  savings: number;
  savingsPercent: number;
  bestService?: string; // Add the missing property
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

// Process analysis data from database for normal view
export const processNormalViewData = (recommendations: any[]): ProcessedAnalysisData => {
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
      carrier: shipmentData.carrier || rec.carrier || 'Unknown',
      service: rec.originalService || shipmentData.service || '',
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

// Process analysis data from database for client view
export const processClientViewData = (analysis: any): ProcessedAnalysisData => {
  console.log('🔄 Processing client view data:', analysis);
  
  // Try to get data from different possible sources
  const savingsAnalysis = analysis.savings_analysis;
  const originalData = analysis.original_data;
  const recommendations = analysis.recommendations;
  
  let totalCurrentCost = 0;
  let totalPotentialSavings = 0;
  let processedRecommendations = [];
  
  // Priority 1: Use savings_analysis if available and properly structured
  if (savingsAnalysis?.totalCurrentCost && savingsAnalysis?.recommendations) {
    console.log('✅ Using savings_analysis data');
    totalCurrentCost = savingsAnalysis.totalCurrentCost;
    totalPotentialSavings = savingsAnalysis.totalPotentialSavings || analysis.total_savings || 0;
    processedRecommendations = savingsAnalysis.recommendations;
  }
  // Priority 2: Use recommendations array if available
  else if (recommendations && Array.isArray(recommendations)) {
    console.log('📊 Using recommendations array');
    processedRecommendations = recommendations;
    totalCurrentCost = recommendations.reduce((sum: number, item: any) => sum + (item.currentCost || 0), 0);
    totalPotentialSavings = recommendations.reduce((sum: number, item: any) => sum + (item.savings || 0), 0);
  }
  // Priority 3: Use original_data if available
  else if (originalData && Array.isArray(originalData)) {
    console.log('📋 Using original_data array');
    processedRecommendations = originalData;
    totalCurrentCost = originalData.reduce((sum: number, item: any) => sum + (item.currentCost || 0), 0);
    totalPotentialSavings = originalData.reduce((sum: number, item: any) => sum + (item.savings || 0), 0);
  }
  // Fallback: Use just the total_savings if available
  else if (analysis.total_savings) {
    console.log('💵 Using total_savings fallback');
    totalPotentialSavings = analysis.total_savings;
    processedRecommendations = [];
  }
  
  console.log('📊 Final processed data:', {
    totalCurrentCost,
    totalPotentialSavings,
    recommendationsCount: processedRecommendations.length,
    totalShipments: analysis.total_shipments
  });
  
  return {
    totalCurrentCost,
    totalPotentialSavings,
    recommendations: processedRecommendations,
    savingsPercentage: totalCurrentCost > 0 ? (totalPotentialSavings / totalCurrentCost) * 100 : 0,
    totalShipments: analysis.total_shipments,
    analyzedShipments: savingsAnalysis?.analyzedShipments || analysis.total_shipments,
    completedShipments: savingsAnalysis?.completedShipments || processedRecommendations.length,
    errorShipments: savingsAnalysis?.errorShipments || 0,
    file_name: analysis.file_name,
    report_name: analysis.report_name,
    client_id: analysis.client_id
  };
};

// Convert recommendations to formatted shipment data
export const formatShipmentData = (recommendations: any[]): ProcessedShipmentData[] => {
  return recommendations.map((rec: any, index: number) => ({
    id: index + 1,
    trackingId: rec.shipment?.trackingId || rec.trackingId || `Shipment-${index + 1}`,
    originZip: rec.shipment?.originZip || rec.originZip || '',
    destinationZip: rec.shipment?.destZip || rec.destinationZip || '',
    weight: parseFloat(rec.shipment?.weight || rec.weight || '0'),
    carrier: rec.shipment?.carrier || rec.carrier || 'Unknown',
    service: rec.originalService || rec.service || 'Unknown',
    currentRate: rec.currentCost || 0,
    newRate: rec.recommendedCost || 0,
    savings: rec.savings || 0,
    savingsPercent: rec.currentCost > 0 ? (rec.savings / rec.currentCost) * 100 : 0,
    bestService: rec.bestService || rec.recommendedService || 'UPS Ground' // Add bestService
  }));
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
      'Carrier': item.carrier,
      'Service': item.service,
      'Current Rate': `$${item.currentRate.toFixed(2)}`,
      'Ship Pros Cost': `$${markupInfo.markedUpPrice.toFixed(2)}`,
      'Savings': `$${savings.toFixed(2)}`,
      'Savings Percentage': `${savingsPercent.toFixed(1)}%`
    };
  });
};