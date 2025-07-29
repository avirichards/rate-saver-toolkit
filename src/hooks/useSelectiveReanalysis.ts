import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { mapServiceToServiceCode } from '@/utils/serviceMapping';
import { getCarrierServiceCode, CarrierType } from '@/utils/carrierServiceRegistry';
import { UniversalServiceCategory } from '@/utils/universalServiceCategories';

interface ReanalysisShipment {
  id: number;
  originZip: string;
  destinationZip: string;
  weight: string | number;
  length?: string | number;
  width?: string | number;
  height?: string | number;
  service: string;
  carrier?: string;
  trackingId?: string;
  isResidential?: string | boolean | { _type?: string; value?: any };
  accountId?: string;
  ShipPros_service?: string | UniversalServiceCategory;
}

interface ServiceMappingCorrection {
  from: string;
  to: string;
  affectedCount: number;
  isResidential?: boolean;
  accountId?: string;
}

export function useSelectiveReanalysis() {
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [reanalyzingShipments, setReanalyzingShipments] = useState<Set<number>>(new Set());

  // Process a single shipment (similar to Analysis.tsx processShipment function)
  const processShipment = useCallback(async (shipment: ReanalysisShipment & { accountId?: string }) => {
    console.log('🔄 Re-analyzing shipment:', shipment.id, 'with residential status:', shipment.isResidential, 'account:', shipment.accountId);

    // Validate carrier configuration
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Please log in to run analysis');
    }

    // Get carrier configs for this user - prefer specified account, fallback to any active UPS config
    let query = supabase
      .from('carrier_configs')
      .select('*')
      .eq('user_id', user.id)
      .eq('carrier_type', 'ups')
      .eq('is_active', true);

    // If accountId is specified, use that specific config
    if (shipment.accountId) {
      query = query.eq('id', shipment.accountId);
    }

    const { data: configs } = await query;

    if (!configs || configs.length === 0) {
      throw new Error('UPS configuration not found. Please configure UPS accounts in Settings.');
    }

    // Use the first config (either the specified one or any available)
    const config = configs[0];
    console.log('Using carrier config:', config.account_name, 'for re-analysis');

    // Prepare shipment data for UPS API - match the expected interface
    // Use the recommended service from the single source of truth - now it should be a UniversalServiceCategory
    const targetService = shipment.ShipPros_service || UniversalServiceCategory.GROUND;
    console.log('🔧 Processing re-analysis with target service:', { 
      original: targetService, 
      shipmentId: shipment.id,
      accountId: shipment.accountId 
    });
    const serviceCode = getServiceCode(targetService);
    
    const shipmentData = {
      shipFrom: {
        name: 'Shipper',
        address: '123 Main St',
        city: 'City',
        state: 'FL',
        zipCode: shipment.originZip,
        country: 'US'
      },
      shipTo: {
        name: 'Recipient',
        address: '456 Main St',
        city: 'City',
        state: 'TX',
        zipCode: shipment.destinationZip,
        country: 'US'
      },
      package: {
        weight: parseFloat(shipment.weight.toString()),
        weightUnit: 'LBS',
        length: parseFloat((shipment.length || 12).toString()),
        width: parseFloat((shipment.width || 12).toString()),
        height: parseFloat((shipment.height || 6).toString()),
        dimensionUnit: 'IN'
      },
      serviceTypes: [serviceCode],
      equivalentServiceCode: serviceCode,
      isResidential: (() => {
        if (typeof shipment.isResidential === 'boolean') return shipment.isResidential;
        if (typeof shipment.isResidential === 'string') return shipment.isResidential === 'true';
        if (shipment.isResidential && typeof shipment.isResidential === 'object' && 'value' in shipment.isResidential) {
          return shipment.isResidential.value === 'true' || shipment.isResidential.value === true;
        }
        return false;
      })()
    };

    console.log('Sending shipment data to UPS API:', shipmentData, 'with configId:', config.id);

    // Call UPS rate quote API with specific carrier config
    const { data, error } = await supabase.functions.invoke('ups-rate-quote', {
      body: { 
        shipment: shipmentData,
        configId: config.id
      }
    });

    if (error) {
      console.error('UPS API Error:', error);
      throw new Error(`UPS API Error: ${error.message || 'Failed to get rates'}`);
    }

    if (!data || !data.rates || data.rates.length === 0) {
      console.warn('No rates returned from UPS API:', data);
      throw new Error('No rates available for this shipment. Check ZIP codes and package details.');
    }

    // Find the best rate (lowest cost)
    const bestRate = data.rates.reduce((best: any, current: any) => 
      (current.totalCharges || 999999) < (best.totalCharges || 999999) ? current : best
    );

    console.log('🔄 Re-analysis result:', {
      shipmentId: shipment.id,
      isResidential: shipment.isResidential,
      ShipPros_cost: bestRate.totalCharges,
      ShipPros_service: bestRate.serviceName,
      ratesReceived: data.rates.length
    });

    return {
      shipment: shipment,
      originalRate: 0, // We don't know the original rate in re-analysis
      ShipPros_cost: bestRate.totalCharges,
      savings: 0, // Will be calculated when we know the original rate
      ShipPros_service: bestRate.serviceName,
      upsRates: data.rates,
      accountUsed: {
        id: config.id,
        name: config.account_name,
        carrierType: config.carrier_type
      }
    };
  }, []);

  // Re-analyze selected shipments
  const reanalyzeShipments = useCallback(async (
    shipments: ReanalysisShipment[],
    analysisId: string,
    onProgress?: (processed: number, total: number) => void
  ) => {
    setIsReanalyzing(true);
    const updatedShipments: any[] = [];
    const failedShipments: any[] = [];

    try {
      for (let i = 0; i < shipments.length; i++) {
        const shipment = shipments[i];
        setReanalyzingShipments(prev => new Set([...prev, shipment.id]));

        try {
          const result = await processShipment(shipment);
          updatedShipments.push({
            ...shipment,
            ShipPros_cost: result.ShipPros_cost,
            ShipPros_service: result.ShipPros_service,
            upsRates: result.upsRates,
            isResidential: (() => {
              if (typeof shipment.isResidential === 'boolean') return shipment.isResidential;
              if (typeof shipment.isResidential === 'string') return shipment.isResidential === 'true';
              if (shipment.isResidential && typeof shipment.isResidential === 'object' && 'value' in shipment.isResidential) {
                return shipment.isResidential.value === 'true' || shipment.isResidential.value === true;
              }
              return false;
            })(),
            reanalyzed: true,
            reanalyzedAt: new Date().toISOString(),
            // Store the account used for analysis
            accountId: shipment.accountId,
            analyzedWithAccount: result.accountUsed
          });

          onProgress?.(i + 1, shipments.length);
        } catch (error: any) {
          console.error(`Failed to re-analyze shipment ${shipment.id}:`, error);
          failedShipments.push({
            ...shipment,
            error: error.message,
            errorType: 'reanalysis_error'
          });
        } finally {
          setReanalyzingShipments(prev => {
            const next = new Set(prev);
            next.delete(shipment.id);
            return next;
          });
        }

        // Small delay to prevent overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Update the database with re-analyzed results
      if (updatedShipments.length > 0) {
        await updateAnalysisInDatabase(analysisId, updatedShipments);
      }

      if (failedShipments.length > 0) {
        toast.error(`${failedShipments.length} shipments failed to re-analyze`);
      } else {
        toast.success(`Successfully re-analyzed ${updatedShipments.length} shipments`);
      }

      return {
        success: updatedShipments,
        failed: failedShipments
      };

    } catch (error: any) {
      console.error('Re-analysis error:', error);
      toast.error(`Re-analysis failed: ${error.message}`);
      throw error;
    } finally {
      setIsReanalyzing(false);
      setReanalyzingShipments(new Set());
    }
  }, [processShipment]);

  // Apply service mapping corrections and re-analyze
  const applyServiceCorrections = useCallback(async (
    corrections: ServiceMappingCorrection[],
    selectedShipments: any[],
    analysisId: string
  ) => {
    // Apply corrections to shipment data
    const correctedShipments = selectedShipments.map(shipment => {
      let updatedShipment = { ...shipment };
      
      corrections.forEach(correction => {
        const currentService = updatedShipment.customer_service || updatedShipment.service || '';
        if (currentService === correction.from) {
          // Update the Ship Pros service directly in the single source of truth
          updatedShipment.ShipPros_service = correction.to;
          updatedShipment.corrected = true;
          
          // Apply residential status if specified in the correction
          if (correction.isResidential !== undefined) {
            updatedShipment.isResidential = correction.isResidential;
          }
          
          // Apply account selection if specified in the correction
          if (correction.accountId) {
            updatedShipment.accountId = correction.accountId;
          }
          
          // Keep the original service unchanged - this represents what the customer actually used
        }
      });
      
      return updatedShipment;
    });

    // Re-analyze the corrected shipments
    return reanalyzeShipments(correctedShipments, analysisId);
  }, [reanalyzeShipments]);

  // Fix orphaned shipment and move it to processed shipments
  const fixOrphanedShipment = useCallback(async (
    shipment: any,
    analysisId: string
  ) => {
    setReanalyzingShipments(prev => new Set([...prev, shipment.id]));

    try {
      const result = await processShipment(shipment);
      
      // Update the analysis to move this shipment from orphaned to processed
      const currentRate = shipment.currentRate || 0;
      const shipProsCost = result.ShipPros_cost || 0;
      const calculatedSavings = currentRate - shipProsCost;
      const savingsPercent = currentRate > 0 ? (calculatedSavings / currentRate) * 100 : 0;
      
      await moveOrphanToProcessed(analysisId, shipment.id, {
        ...shipment,
        ShipPros_cost: shipProsCost,
        ShipPros_service: result.ShipPros_service,
        upsRates: result.upsRates,
        // Calculate and preserve savings data
        currentRate: currentRate,
        savings: calculatedSavings,
        savingsPercent: savingsPercent,
        // Preserve the account information from the re-analysis result
        accountId: result.accountUsed?.id || shipment.accountId,
        accountName: result.accountUsed?.name || shipment.accountName,
        analyzedWithAccount: result.accountUsed?.name || shipment.analyzedWithAccount,
        carrier: result.accountUsed?.carrierType || shipment.carrier,
        // Preserve the original customer service to prevent "Unknown" in overview
        customer_service: shipment.customer_service || shipment.service,
        fixed: true,
        fixedAt: new Date().toISOString(),
        // Clear error fields since it's now fixed
        error: undefined,
        errorType: undefined,
        errorCategory: undefined
      });

      toast.success(`Successfully fixed and analyzed shipment ${shipment.trackingId || shipment.id}`);
      return result;

    } catch (error: any) {
      console.error(`Failed to fix orphaned shipment ${shipment.id}:`, error);
      toast.error(`Failed to fix shipment: ${error.message}`);
      throw error;
    } finally {
      setReanalyzingShipments(prev => {
        const next = new Set(prev);
        next.delete(shipment.id);
        return next;
      });
    }
  }, [processShipment]);

  return {
    isReanalyzing,
    reanalyzingShipments,
    reanalyzeShipments,
    applyServiceCorrections,
    fixOrphanedShipment
  };
}

// Helper function to map service names to UPS service codes using universal categories
function getServiceCode(serviceName: string | UniversalServiceCategory): string {
  // If it's already a UniversalServiceCategory, use it directly
  let universalCategory: UniversalServiceCategory;
  
  if (typeof serviceName === 'string') {
    // If it's a string, check if it's a valid enum value first
    if (Object.values(UniversalServiceCategory).includes(serviceName as UniversalServiceCategory)) {
      universalCategory = serviceName as UniversalServiceCategory;
    } else {
      // Otherwise, map the service name to a universal category
      const mapping = mapServiceToServiceCode(serviceName);
      universalCategory = mapping.standardizedService;
    }
  } else {
    universalCategory = serviceName;
  }
  
  console.log('🔧 Service code mapping:', { input: serviceName, universalCategory });
  
  // Convert the universal category to UPS service code
  const upsCode = getCarrierServiceCode(CarrierType.UPS, universalCategory);
  
  console.log('🔧 UPS service code result:', { universalCategory, upsCode });
  
  return upsCode || '03'; // Default to Ground if not found
}

// Helper function to update analysis in database
async function updateAnalysisInDatabase(analysisId: string, updatedShipments: any[]) {
  const { data: currentAnalysis } = await supabase
    .from('shipping_analyses')
    .select('processed_shipments, processing_metadata')
    .eq('id', analysisId)
    .single();

  if (!currentAnalysis) {
    throw new Error('Analysis not found');
  }

  const currentShipments = Array.isArray(currentAnalysis.processed_shipments) 
    ? currentAnalysis.processed_shipments as any[]
    : [];
  
  // Update existing shipments with re-analyzed data
  const mergedShipments = currentShipments.map((existing: any) => {
    const updated = updatedShipments.find(u => u.id === existing.id);
    return updated ? { ...existing, ...updated } : existing;
  });

  // Update metadata
  const currentMetadata = typeof currentAnalysis.processing_metadata === 'object' && currentAnalysis.processing_metadata !== null
    ? currentAnalysis.processing_metadata as Record<string, any>
    : {};
    
  const updatedMetadata = {
    ...currentMetadata,
    lastReanalysis: new Date().toISOString(),
    reanalyzedShipments: updatedShipments.length
  };

  const { error } = await supabase
    .from('shipping_analyses')
    .update({
      processed_shipments: mergedShipments as any,
      processing_metadata: updatedMetadata as any
    })
    .eq('id', analysisId);

  if (error) {
    throw new Error(`Failed to update analysis: ${error.message}`);
  }
}

// Helper function to move orphaned shipment to processed
async function moveOrphanToProcessed(analysisId: string, shipmentId: number, fixedShipment: any) {
  const { data: currentAnalysis } = await supabase
    .from('shipping_analyses')
    .select('processed_shipments, orphaned_shipments')
    .eq('id', analysisId)
    .single();

  if (!currentAnalysis) {
    throw new Error('Analysis not found');
  }

  const processedShipments = Array.isArray(currentAnalysis.processed_shipments)
    ? currentAnalysis.processed_shipments as any[]
    : [];
  const orphanedShipments = Array.isArray(currentAnalysis.orphaned_shipments)
    ? currentAnalysis.orphaned_shipments as any[]
    : [];

  // Remove from orphaned and add to processed
  const updatedOrphaned = orphanedShipments.filter((orphan: any) => orphan.id !== shipmentId);
  const updatedProcessed = [...processedShipments, fixedShipment];

  const { error } = await supabase
    .from('shipping_analyses')
    .update({
      processed_shipments: updatedProcessed as any,
      orphaned_shipments: updatedOrphaned as any,
      total_shipments: updatedProcessed.length + updatedOrphaned.length
    })
    .eq('id', analysisId);

  if (error) {
    throw new Error(`Failed to update analysis: ${error.message}`);
  }
}