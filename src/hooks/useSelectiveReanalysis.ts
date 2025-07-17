import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
  isResidential?: string | boolean;
}

interface ServiceMappingCorrection {
  from: string;
  to: string;
  affectedCount: number;
}

export function useSelectiveReanalysis() {
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [reanalyzingShipments, setReanalyzingShipments] = useState<Set<number>>(new Set());

  // Process a single shipment (similar to Analysis.tsx processShipment function)
  const processShipment = useCallback(async (shipment: ReanalysisShipment & { newService?: string; bestService?: string }) => {
    console.log('🔄 Re-analyzing shipment:', shipment.id);

    // Validate UPS configuration
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Please log in to run analysis');
    }

    const { data: config } = await supabase
      .from('ups_configs')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!config) {
      throw new Error('UPS configuration not found. Please configure UPS API in Settings.');
    }

    // Prepare shipment data for UPS API - match the expected interface
    // Use the corrected service if available, check both newService and bestService fields
    const targetService = shipment.newService || shipment.bestService || 'UPS Ground';
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
      isResidential: shipment.isResidential === 'true' || shipment.isResidential === true
    };

    console.log('Sending shipment data to UPS API:', shipmentData);

    // Call UPS rate quote API
    const { data, error } = await supabase.functions.invoke('ups-rate-quote', {
      body: { 
        shipment: shipmentData 
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

    return {
      shipment: shipment,
      originalRate: 0, // We don't know the original rate in re-analysis
      newRate: bestRate.totalCharges,
      savings: 0, // Will be calculated when we know the original rate
      recommendedService: bestRate.serviceName,
      upsRates: data.rates
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
            newRate: result.newRate,
            newService: result.recommendedService,
            bestService: result.recommendedService, // Ensure both fields are updated
            upsRates: result.upsRates,
            reanalyzed: true,
            reanalyzedAt: new Date().toISOString()
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
        const currentService = updatedShipment.service || updatedShipment.originalService || '';
        if (currentService === correction.from) {
          // Update the Ship Pros service (newService), NOT the current service
          updatedShipment.newService = correction.to;
          updatedShipment.bestService = correction.to; // Also update bestService for consistency
          updatedShipment.corrected = true;
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
      await moveOrphanToProcessed(analysisId, shipment.id, {
        ...shipment,
        newRate: result.newRate,
        newService: result.recommendedService,
        upsRates: result.upsRates,
        fixed: true,
        fixedAt: new Date().toISOString()
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

// Helper function to map service names to UPS service codes
function getServiceCode(serviceName: string): string {
  const serviceMap: Record<string, string> = {
    'UPS Ground': '03',
    'UPS 3 Day Select': '12',
    'UPS 2nd Day Air': '02',
    'UPS 2nd Day Air A.M.': '59',
    'UPS Next Day Air': '01',
    'UPS Next Day Air Saver': '13',
    'UPS Next Day Air Early': '14',
    'UPS Worldwide Express': '07',
    'UPS Worldwide Expedited': '08',
    'UPS Standard': '11',
    'UPS Worldwide Express Plus': '54',
    'UPS Worldwide Saver': '65'
  };
  
  return serviceMap[serviceName] || '03'; // Default to Ground if not found
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