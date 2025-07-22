
// Unified data types for analysis flow
export interface UnifiedShipmentData {
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

export interface UnifiedOrphanedShipment {
  id: number;
  trackingId: string;
  error: string;
  errorType: string;
  missingFields: string[];
  rawData: any;
}

export interface UnifiedAnalysisData {
  totalCurrentCost: number;
  totalPotentialSavings: number;
  recommendations: UnifiedShipmentData[];
  orphanedShipments: UnifiedOrphanedShipment[];
  savingsPercentage: number;
  totalShipments: number;
  analyzedShipments: number;
  completedShipments: number;
  errorShipments: number;
  averageSavingsPercent?: number;
  file_name?: string;
  report_name?: string;
  client_id?: string;
}

// Database storage format - matches shipping_analyses table structure
export interface DatabaseAnalysisFormat {
  processed_shipments: UnifiedShipmentData[];
  orphaned_shipments: UnifiedOrphanedShipment[];
  total_shipments: number;
  total_savings: number;
  savings_analysis: {
    savingsPercentage: number;
    completedShipments: number;
    errorShipments: number;
    averageSavingsPercent?: number;
  };
  file_name: string;
  report_name?: string;
  client_id?: string;
}
