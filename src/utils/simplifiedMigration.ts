import { supabase } from '@/integrations/supabase/client';

interface LegacyAnalysis {
  id: string;
  user_id: string;
  original_data: any[];
  recommendations: any[];
  total_shipments: number;
  total_savings: number;
  processed_shipments: any[] | null;
}

// Simple migration - just convert to centralized format
export const migrateSingleAnalysis = async (analysisId: string): Promise<boolean> => {
  console.log(`🔄 Migrating analysis ${analysisId}`);
  
  try {
    // Get the analysis
    const { data: analysis, error: fetchError } = await supabase
      .from('shipping_analyses')
      .select('*')
      .eq('id', analysisId)
      .single();

    if (fetchError || !analysis) {
      console.error('Failed to fetch analysis:', fetchError);
      return false;
    }

    // Skip if already migrated
    if (analysis.processed_shipments && Array.isArray(analysis.processed_shipments)) {
      console.log(`✅ Analysis ${analysisId} already migrated`);
      return true;
    }

    // Get source data
    const sourceData = analysis.recommendations || analysis.original_data || [];
    
    if (!Array.isArray(sourceData)) {
      console.warn(`No valid data to migrate for analysis ${analysisId}`);
      return false;
    }

    // Convert to standardized format
    const processedShipments = sourceData.map((item: any, index: number) => {
      const shipmentData = item.shipment || item;
      const currentRate = item.currentCost || item.current_rate || 0;
      const newRate = item.recommendedCost || item.recommended_cost || 0;
      const savings = item.savings || (currentRate - newRate) || 0;

      return {
        id: index + 1,
        trackingId: shipmentData?.trackingId || `Shipment-${index + 1}`,
        originZip: shipmentData?.originZip || '',
        destinationZip: shipmentData?.destZip || shipmentData?.destinationZip || '',
        weight: parseFloat(shipmentData?.weight || '0'),
        carrier: shipmentData?.carrier || item.carrier || 'UPS',
        service: item.originalService || shipmentData?.service || 'Unknown',
        currentRate,
        newRate,
        savings,
        savingsPercent: currentRate > 0 ? (savings / currentRate) * 100 : 0
      };
    });

    // Update with centralized data
    const { error: updateError } = await supabase
      .from('shipping_analyses')
      .update({
        processed_shipments: processedShipments,
        orphaned_shipments: [], // Keep simple - no complex orphan recovery
        processing_metadata: {
          migratedAt: new Date().toISOString(),
          migrationVersion: 'simplified-v1',
          originalCount: sourceData.length,
          processedCount: processedShipments.length
        }
      })
      .eq('id', analysisId);

    if (updateError) {
      console.error('Failed to update analysis:', updateError);
      return false;
    }

    console.log(`✅ Successfully migrated analysis ${analysisId}`);
    return true;

  } catch (error) {
    console.error(`Error migrating analysis ${analysisId}:`, error);
    return false;
  }
};

// Manual migration function for user-triggered migration
export const migrateUserAnalyses = async (): Promise<{ success: number; failed: number }> => {
  console.log('🔄 Starting user-triggered migration');
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }
  
  // Get analyses that need migration
  const { data: analyses, error } = await supabase
    .from('shipping_analyses')
    .select('id')
    .eq('user_id', user.id)
    .is('processed_shipments', null);
  
  if (error) {
    console.error('Failed to fetch analyses:', error);
    throw error;
  }
  
  if (!analyses || analyses.length === 0) {
    console.log('No analyses need migration');
    return { success: 0, failed: 0 };
  }
  
  console.log(`Found ${analyses.length} analyses to migrate`);
  
  let success = 0;
  let failed = 0;
  
  for (const analysis of analyses) {
    const result = await migrateSingleAnalysis(analysis.id);
    if (result) {
      success++;
    } else {
      failed++;
    }
    
    // Small delay to be gentle on the database
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`Migration complete: ${success} success, ${failed} failed`);
  return { success, failed };
};