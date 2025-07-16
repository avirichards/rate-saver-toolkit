import { toast } from 'sonner';

// Simplified interfaces
export interface ProcessedAnalysisData {
  totalCurrentCost: number;
  totalPotentialSavings: number;
  recommendations: ProcessedShipmentData[];
  orphanedShipments: OrphanedShipmentData[];
  savingsPercentage: number;
  totalShipments: number;
  analyzedShipments: number;
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
  bestService?: string;
}

export interface OrphanedShipmentData {
  id: number;
  trackingId: string;
  originZip: string;
  destinationZip: string;
  weight: number;
  service: string;
  error: string;
  errorType: string;
  errorCategory?: string;
  stage?: 'mapping' | 'analysis' | 'recovery' | 'legacy';
  attemptCount?: number;
  missingFields?: string[];
}

export interface ValidationResult {
  isValid: boolean;
  missingFields: string[];
}

// Single validation function
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
    missingFields
  };
};

// Unified data processor for all formats
export const processAnalysisData = (analysis: any, isClientView: boolean = false): ProcessedAnalysisData => {
  // Get data from the most reliable source available
  let sourceData: any[] = [];
  let orphanedData: any[] = [];
  let totalCurrentCost = 0;
  let totalPotentialSavings = 0;

  // Priority 1: Use centralized processed_shipments if available
  if (analysis.processed_shipments && Array.isArray(analysis.processed_shipments)) {
    sourceData = analysis.processed_shipments;
    orphanedData = Array.isArray(analysis.orphaned_shipments) ? analysis.orphaned_shipments : [];
    totalCurrentCost = sourceData.reduce((sum, item) => sum + (item.currentRate || 0), 0);
    totalPotentialSavings = sourceData.reduce((sum, item) => sum + (item.savings || 0), 0);
    
    console.log('🔍 UNIFIED PROCESSOR: Using centralized data:', {
      processedShipments: sourceData.length,
      orphanedShipments: orphanedData.length,
      totalSavings: totalPotentialSavings
    });
  }
  // Priority 2: Use savings_analysis if structured properly
  else if (analysis.savings_analysis?.recommendations) {
    sourceData = analysis.savings_analysis.recommendations;
    totalCurrentCost = analysis.savings_analysis.totalCurrentCost || 0;
    totalPotentialSavings = analysis.savings_analysis.totalPotentialSavings || analysis.total_savings || 0;
  }
  // Priority 3: Use recommendations array
  else if (analysis.recommendations && Array.isArray(analysis.recommendations)) {
    sourceData = analysis.recommendations;
    totalCurrentCost = sourceData.reduce((sum, item) => sum + (item.currentCost || 0), 0);
    totalPotentialSavings = sourceData.reduce((sum, item) => sum + (item.savings || 0), 0);
  }
  // Priority 4: Use original_data
  else if (analysis.original_data && Array.isArray(analysis.original_data)) {
    sourceData = analysis.original_data;
    totalCurrentCost = sourceData.reduce((sum, item) => sum + (item.currentCost || 0), 0);
    totalPotentialSavings = sourceData.reduce((sum, item) => sum + (item.savings || 0), 0);
  }
  // Fallback: Use just total_savings
  else if (analysis.total_savings) {
    totalPotentialSavings = analysis.total_savings;
    sourceData = [];
  }

  // Process shipments into standardized format
  const processedShipments = sourceData.map((item: any, index: number): ProcessedShipmentData => {
    // Handle different data structures flexibly
    const shipmentData = item.shipment || item;
    const currentRate = item.currentRate || item.currentCost || item.current_rate || 0;
    const newRate = item.newRate || item.recommendedCost || item.recommended_cost || 0;
    const savings = item.savings || item.savings_amount || (currentRate - newRate) || 0;

    return {
      id: index + 1,
      trackingId: shipmentData.trackingId || item.trackingId || `Shipment-${index + 1}`,
      originZip: shipmentData.originZip || item.originZip || '',
      destinationZip: shipmentData.destinationZip || shipmentData.destZip || item.destinationZip || '',
      weight: parseFloat(shipmentData.weight || item.weight || '0'),
      carrier: shipmentData.carrier || item.carrier || 'UPS',
      service: item.originalService || item.service || shipmentData.service || 'Unknown',
      currentRate,
      newRate,
      savings,
      savingsPercent: currentRate > 0 ? (savings / currentRate) * 100 : 0,
      bestService: item.bestService || item.recommendedService || 'UPS Ground'
    };
  });

  // Process orphaned shipments into standardized format
  const processedOrphanedShipments = orphanedData.map((item: any, index: number): OrphanedShipmentData => {
    return {
      id: item.id || (index + 1),
      trackingId: item.trackingId || `Orphan-${index + 1}`,
      originZip: item.originZip || '',
      destinationZip: item.destinationZip || item.destZip || '',
      weight: parseFloat(item.weight || '0'),
      service: item.service || 'Unknown',
      error: item.error || 'Processing failed',
      errorType: item.errorType || 'Unknown Error',
      errorCategory: item.errorCategory || 'Processing Error',
      stage: item.stage || 'legacy',
      attemptCount: item.attemptCount || 1,
      missingFields: Array.isArray(item.missingFields) ? item.missingFields : []
    };
  });

  return {
    totalCurrentCost,
    totalPotentialSavings,
    recommendations: processedShipments,
    orphanedShipments: processedOrphanedShipments,
    savingsPercentage: totalCurrentCost > 0 ? (totalPotentialSavings / totalCurrentCost) * 100 : 0,
    totalShipments: analysis.total_shipments || (processedShipments.length + processedOrphanedShipments.length),
    analyzedShipments: processedShipments.length,
    file_name: analysis.file_name,
    report_name: analysis.report_name,
    client_id: analysis.client_id
  };
};

// Simple status check - only what users need to know
export const getAnalysisStatus = (analysis: any): 'ready' | 'needs-migration' | 'no-data' => {
  // Check if we have centralized data
  if (analysis.processed_shipments && Array.isArray(analysis.processed_shipments)) {
    return 'ready';
  }
  
  // Check if we have any data to migrate
  if (analysis.recommendations || analysis.original_data || analysis.savings_analysis) {
    return 'needs-migration';
  }
  
  return 'no-data';
};

// Error handling
export const handleDataProcessingError = (error: any, context: string): void => {
  console.error(`Error in ${context}:`, error);
  
  if (context.includes('client')) {
    toast.error('Failed to load shared report. The link may be invalid or expired.');
  } else {
    toast.error('Failed to load analysis results');
  }
};

// CSV export utility
export const generateExportData = (filteredData: ProcessedShipmentData[], getShipmentMarkup: (shipment: any) => any) => {
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