import { supabase } from '@/integrations/supabase/client';

export interface OrphanedShipmentData {
  id: number;
  trackingId: string;
  originZip: string;
  destinationZip: string;
  weight: number;
  service: string;
  error: string;
  errorType: string;
  errorCategory: string;
}

export interface RecoveryResult {
  recoveredCount: number;
  recoveredShipments: OrphanedShipmentData[];
  totalOrphaned: number;
}

/**
 * Recovers missing shipments from original CSV data and adds them to orphaned_shipments
 */
export async function recoverMissingShipments(
  analysisData: any,
  totalExpectedShipments: number,
  currentProcessedCount: number,
  currentOrphanedCount: number
): Promise<RecoveryResult> {
  const trackedCount = currentProcessedCount + currentOrphanedCount;
  const missingCount = totalExpectedShipments - trackedCount;
  
  console.log('🔍 ORPHAN RECOVERY: Starting recovery process:', {
    totalExpected: totalExpectedShipments,
    currentProcessed: currentProcessedCount,
    currentOrphaned: currentOrphanedCount,
    trackedCount,
    missingCount
  });
  
  if (missingCount <= 0) {
    console.log('✅ ORPHAN RECOVERY: No missing shipments to recover');
    return {
      recoveredCount: 0,
      recoveredShipments: [],
      totalOrphaned: currentOrphanedCount
    };
  }
  
  // Extract original data
  const originalData = analysisData.original_data;
  let csvData: any[] = [];
  let fieldMappings: any = {};
  
  if (originalData && typeof originalData === 'object' && originalData.csvData) {
    // New format
    csvData = originalData.csvData;
    fieldMappings = originalData.fieldMappings || {};
  } else if (Array.isArray(originalData)) {
    // Old format
    csvData = originalData;
  } else {
    console.warn('⚠️ ORPHAN RECOVERY: No usable original data found');
    return {
      recoveredCount: 0,
      recoveredShipments: [],
      totalOrphaned: currentOrphanedCount
    };
  }
  
  if (!Array.isArray(csvData) || csvData.length === 0) {
    console.warn('⚠️ ORPHAN RECOVERY: No CSV data available');
    return {
      recoveredCount: 0,
      recoveredShipments: [],
      totalOrphaned: currentOrphanedCount
    };
  }
  
  // Get current tracking IDs to avoid duplicates
  const existingTrackingIds = new Set<string>();
  
  // Add processed shipment tracking IDs
  if (analysisData.processed_shipments) {
    analysisData.processed_shipments.forEach((s: any) => {
      if (s.trackingId) existingTrackingIds.add(s.trackingId);
    });
  }
  
  // Add orphaned shipment tracking IDs
  if (analysisData.orphaned_shipments) {
    analysisData.orphaned_shipments.forEach((s: any) => {
      if (s.trackingId) existingTrackingIds.add(s.trackingId);
    });
  }
  
  console.log('🔍 ORPHAN RECOVERY: Existing tracking IDs:', Array.from(existingTrackingIds));
  
  // Find missing shipments from CSV
  const recoveredShipments: OrphanedShipmentData[] = [];
  
  csvData.forEach((row, index) => {
    // Determine tracking ID
    let trackingId = getFieldValue(row, fieldMappings, 'trackingId', ['tracking_id', 'trackingId', 'tracking_number']);
    if (!trackingId) {
      trackingId = `Row-${index + 1}`;
    }
    
    // Skip if we already have this shipment
    if (existingTrackingIds.has(trackingId)) {
      return;
    }
    
    // Create orphaned shipment record
    const orphanedShipment: OrphanedShipmentData = {
      id: trackedCount + recoveredShipments.length + 1,
      trackingId,
      originZip: getFieldValue(row, fieldMappings, 'originZip', ['origin_zip', 'from_zip']) || '',
      destinationZip: getFieldValue(row, fieldMappings, 'destZip', ['dest_zip', 'to_zip', 'destination_zip']) || '',
      weight: parseFloat(getFieldValue(row, fieldMappings, 'weight', ['weight']) || '0'),
      service: getFieldValue(row, fieldMappings, 'service', ['service', 'shipping_service']) || 'Unknown',
      error: 'Shipment not processed during analysis - recovered from original CSV data',
      errorType: 'missing_data',
      errorCategory: 'Data Recovery'
    };
    
    recoveredShipments.push(orphanedShipment);
    
    console.log('🔍 ORPHAN RECOVERY: Found missing shipment:', {
      trackingId,
      service: orphanedShipment.service,
      weight: orphanedShipment.weight
    });
  });
  
  console.log('🔄 ORPHAN RECOVERY: Recovery complete:', {
    expectedMissing: missingCount,
    actualRecovered: recoveredShipments.length,
    recoveredShipments: recoveredShipments.map(s => s.trackingId)
  });
  
  // Update database if we found missing shipments
  if (recoveredShipments.length > 0) {
    try {
      const updatedOrphanedShipments = [
        ...(analysisData.orphaned_shipments || []),
        ...recoveredShipments
      ];
      
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase
          .from('shipping_analyses')
          .update({
            orphaned_shipments: updatedOrphanedShipments,
            processing_metadata: {
              ...analysisData.processing_metadata,
              recoveryPerformed: true,
              recoveredShipments: recoveredShipments.length,
              recoveryDate: new Date().toISOString()
            }
          })
          .eq('id', analysisData.id)
          .eq('user_id', user.id);
        
        if (error) {
          console.error('❌ ORPHAN RECOVERY: Database update failed:', error);
        } else {
          console.log('✅ ORPHAN RECOVERY: Database updated successfully');
        }
      }
    } catch (error) {
      console.error('❌ ORPHAN RECOVERY: Error updating database:', error);
    }
  }
  
  return {
    recoveredCount: recoveredShipments.length,
    recoveredShipments,
    totalOrphaned: currentOrphanedCount + recoveredShipments.length
  };
}

/**
 * Helper function to get field value using field mappings or fallback field names
 */
function getFieldValue(row: any, fieldMappings: any, fieldType: string, fallbackFields: string[]): string | null {
  // Try field mapping first
  if (fieldMappings && fieldMappings[fieldType] && row[fieldMappings[fieldType]]) {
    return row[fieldMappings[fieldType]];
  }
  
  // Try fallback fields
  for (const field of fallbackFields) {
    if (row[field]) {
      return row[field];
    }
  }
  
  return null;
}

/**
 * Validates that all expected shipments are accounted for
 */
export function validateShipmentAccountability(
  totalExpected: number,
  processedCount: number,
  orphanedCount: number
): { isComplete: boolean; missingCount: number; coverage: number } {
  const trackedCount = processedCount + orphanedCount;
  const missingCount = Math.max(0, totalExpected - trackedCount);
  const coverage = totalExpected > 0 ? (trackedCount / totalExpected) * 100 : 100;
  
  return {
    isComplete: missingCount === 0,
    missingCount,
    coverage
  };
}