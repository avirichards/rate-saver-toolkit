import { supabase } from '@/integrations/supabase/client';

interface LegacyAnalysis {
  id: string;
  user_id: string;
  original_data: any[];
  recommendations: any[];
  ups_quotes: any[];
  total_shipments: number;
  total_savings: number;
  processed_shipments: any[] | null;
  orphaned_shipments: any[] | null;
  processing_metadata: any | null;
}

// Function to validate shipment data completeness
const validateShipmentData = (shipment: any): { isValid: boolean; missingFields: string[]; errorType: string } => {
  const missingFields: string[] = [];
  
  // Check for missing tracking ID
  if (!shipment.trackingId || shipment.trackingId.trim() === '') {
    missingFields.push('Tracking ID');
  }
  
  // Check for missing ZIP codes
  if (!shipment.originZip || shipment.originZip.trim() === '') {
    missingFields.push('Origin ZIP');
  }
  if (!shipment.destZip || shipment.destZip.trim() === '') {
    missingFields.push('Destination ZIP');
  }
  
  // Check for missing or invalid weight
  const weight = parseFloat(shipment.weight || '0');
  if (!shipment.weight || weight <= 0) {
    missingFields.push('Weight');
  }
  
  // Service is optional for orphan classification
  const hasService = shipment.service && shipment.service.trim() !== '';
  
  const isValid = missingFields.length === 0 && hasService;
  const errorType = missingFields.length > 0 ? 'Missing Critical Data' : 
                   !hasService ? 'Missing Service' : 'Valid';
  
  if (!hasService) {
    missingFields.push('Service');
  }
  
  return { isValid, missingFields, errorType };
};

// Enhanced orphaned data recovery from multiple sources
const recoverOrphanedData = (analysis: LegacyAnalysis): any[] => {
  const orphanedShipments: any[] = [];
  
  // Source 1: Check for incomplete shipments in recommendations
  if (Array.isArray(analysis.recommendations)) {
    analysis.recommendations.forEach((rec: any, index: number) => {
      if (rec.error || rec.status === 'error') {
        const shipmentData = rec.shipment || rec.shipment_data || rec;
        orphanedShipments.push({
          id: `rec-${index}`,
          trackingId: shipmentData?.trackingId || `Orphan-Rec-${index}`,
          originZip: shipmentData?.originZip || '',
          destinationZip: shipmentData?.destZip || '',
          weight: parseFloat(shipmentData?.weight || '0'),
          service: rec.originalService || shipmentData?.service || 'Unknown',
          error: rec.error || 'Processing failed',
          errorType: 'Processing Error',
          source: 'recommendations'
        });
      }
    });
  }

  // Source 2: Check original_data for shipments not in recommendations
  if (Array.isArray(analysis.original_data) && Array.isArray(analysis.recommendations)) {
    const processedTrackingIds = new Set(
      analysis.recommendations.map((rec: any) => 
        rec.shipment?.trackingId || rec.shipment_data?.trackingId || rec.trackingId
      ).filter(Boolean)
    );

    analysis.original_data.forEach((original: any, index: number) => {
      const trackingId = original.trackingId || original['Tracking ID'] || `Original-${index}`;
      
      if (!processedTrackingIds.has(trackingId)) {
        const validation = validateShipmentData(original);
        if (!validation.isValid) {
          orphanedShipments.push({
            id: `orig-${index}`,
            trackingId,
            originZip: original.originZip || original['Origin ZIP'] || '',
            destinationZip: original.destZip || original['Destination ZIP'] || '',
            weight: parseFloat(original.weight || original['Weight'] || '0'),
            service: original.service || original['Service'] || 'Unknown',
            error: `Missing: ${validation.missingFields.join(', ')}`,
            errorType: validation.errorType,
            source: 'original_data'
          });
        }
      }
    });
  }

  return orphanedShipments;
};

export const migrateSingleAnalysis = async (analysis: LegacyAnalysis): Promise<boolean> => {
  console.log(`🔄 MIGRATION: Processing analysis ${analysis.id}`);
  
  // Skip if already migrated (both fields must exist)
  if (analysis.processed_shipments && analysis.orphaned_shipments !== null) {
    console.log(`✅ MIGRATION: Analysis ${analysis.id} already migrated`);
    return true;
  }
  
  try {
    let dataToUse = analysis.recommendations || analysis.original_data || [];
    
    if (!Array.isArray(dataToUse) || dataToUse.length === 0) {
      console.warn(`⚠️ MIGRATION: No valid data found for analysis ${analysis.id}`);
      // Still create empty centralized data structure
      const { error } = await supabase
        .from('shipping_analyses')
        .update({
          processed_shipments: [],
          orphaned_shipments: [],
          processing_metadata: {
            migratedAt: new Date().toISOString(),
            migrationSource: 'legacy_migration_utility',
            dataStatus: 'no_data_found'
          }
        })
        .eq('id', analysis.id);
      
      return !error;
    }
    
    const validShipments: any[] = [];
    
    // Use enhanced orphaned data recovery
    const orphanedShipments = recoverOrphanedData(analysis);
    
    dataToUse.forEach((rec: any, index: number) => {
      // Handle both recommendations format and raw data format
      let shipmentData = rec.shipment || rec.shipment_data || rec;
      let errorStatus = rec.error || rec.status === 'error' ? rec.error || 'Processing failed' : null;
      
      const validation = validateShipmentData(shipmentData);
      
      // Only add to valid shipments if no errors and validation passes
      if (!errorStatus && validation.isValid) {
        validShipments.push({
          id: index + 1,
          trackingId: shipmentData?.trackingId || `Shipment-${index + 1}`,
          originZip: shipmentData?.originZip || '',
          destinationZip: shipmentData?.destZip || '',
          weight: parseFloat(shipmentData?.weight || '0'),
          carrier: shipmentData?.carrier || rec.carrier || 'UPS',
          customer_service: rec.originalService || shipmentData?.service || 'Unknown',
          currentRate: rec.currentCost || rec.current_rate || rec.published_rate || 0,
          ShipPros_cost: rec.recommendedCost || rec.recommended_cost || rec.negotiated_rate || rec.ShipPros_cost || 0,
          savings: rec.savings || rec.savings_amount || 0,
          savingsPercent: (() => {
            const current = rec.currentCost || rec.current_rate || rec.published_rate || 0;
            const savings = rec.savings || rec.savings_amount || 0;
            return current > 0 ? (savings / current) * 100 : 0;
          })()
        });
      }
    });
    
    const processingMetadata = {
      migratedAt: new Date().toISOString(),
      originalDataCount: dataToUse.length,
      processedCount: validShipments.length,
      orphanedCount: orphanedShipments.length,
      totalSavings: analysis.total_savings,
      migrationSource: 'legacy_migration_utility'
    };
    
    // Update the analysis with centralized data
    const { error } = await supabase
      .from('shipping_analyses')
      .update({
        processed_shipments: validShipments,
        orphaned_shipments: orphanedShipments,
        processing_metadata: processingMetadata
      })
      .eq('id', analysis.id);
    
    if (error) {
      console.error(`❌ MIGRATION: Failed to update analysis ${analysis.id}:`, error);
      return false;
    }
    
    console.log(`✅ MIGRATION: Successfully migrated analysis ${analysis.id}`, {
      processedShipments: validShipments.length,
      orphanedShipments: orphanedShipments.length,
      total: validShipments.length + orphanedShipments.length
    });
    
    return true;
  } catch (error) {
    console.error(`❌ MIGRATION: Error processing analysis ${analysis.id}:`, error);
    return false;
  }
};

export const migrateAllLegacyAnalyses = async (): Promise<{ success: number; failed: number; skipped: number }> => {
  console.log('🔄 MIGRATION: Starting migration of all legacy analyses');
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }
  
  // Get all analyses that need migration
  const { data: analyses, error } = await supabase
    .from('shipping_analyses')
    .select('id, user_id, original_data, recommendations, ups_quotes, total_shipments, total_savings, processed_shipments, orphaned_shipments, processing_metadata')
    .eq('user_id', user.id)
    .or('processed_shipments.is.null,orphaned_shipments.is.null');
  
  if (error) {
    console.error('❌ MIGRATION: Failed to fetch analyses:', error);
    throw error;
  }
  
  if (!analyses || analyses.length === 0) {
    console.log('✅ MIGRATION: No analyses need migration');
    return { success: 0, failed: 0, skipped: 0 };
  }
  
  console.log(`🔄 MIGRATION: Found ${analyses.length} analyses to migrate`);
  
  let success = 0;
  let failed = 0;
  let skipped = 0;
  
  for (const analysis of analyses) {
    const result = await migrateSingleAnalysis(analysis as LegacyAnalysis);
    if (result === true) {
      success++;
    } else if (result === false) {
      failed++;
    } else {
      skipped++;
    }
    
    // Small delay to prevent overwhelming the database
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`✅ MIGRATION: Migration complete`, { success, failed, skipped });
  return { success, failed, skipped };
};