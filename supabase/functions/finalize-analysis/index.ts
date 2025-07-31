
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AnalysisPayload {
  fileName: string;
  totalShipments: number;
  completedShipments: number;
  errorShipments: number;
  totalCurrentCost: number;
  totalPotentialSavings: number;
  recommendations: any[];
  orphanedShipments: any[];
  originalData: any[];
  carrierConfigsUsed: string[];
  serviceMappings?: any[];
  batchInfo?: {
    batchIndex: number;
    totalBatches: number;
    analysisId: string;
  };
}

interface BatchProcessingResult {
  analysisId: string;
  batchIndex: number;
  totalBatches: number;
  isComplete: boolean;
}

// Split carriers by type (rate cards vs API)
async function splitCarriersByType(carrierConfigIds: string[], supabase: any) {
  const { data: carrierConfigs, error } = await supabase
    .from('carrier_configs')
    .select('id, is_rate_card, account_name, carrier_type')
    .in('id', carrierConfigIds);
    
  if (error || !carrierConfigs) {
    console.log('⚠️ Could not determine carrier types, defaulting to API processing');
    return { rateCardCarriers: [], apiCarriers: carrierConfigIds, allRateCards: false };
  }
  
  const rateCardCarriers = carrierConfigs.filter(config => config.is_rate_card === true).map(c => c.id);
  const apiCarriers = carrierConfigs.filter(config => config.is_rate_card !== true).map(c => c.id);
  const allRateCards = carrierConfigs.every(config => config.is_rate_card === true);
  
  console.log('🔍 Carrier split analysis:', {
    totalCarriers: carrierConfigs.length,
    rateCardCarriers: rateCardCarriers.length,
    apiCarriers: apiCarriers.length,
    allRateCards,
    carrierDetails: carrierConfigs.map(c => ({ 
      id: c.id, 
      name: c.account_name, 
      type: c.carrier_type,
      isRateCard: c.is_rate_card 
    }))
  });
  
  return { rateCardCarriers, apiCarriers, allRateCards };
}

// Check if analysis uses only rate cards (no API calls needed)
async function isRateCardOnlyAnalysis(carrierConfigIds: string[], supabase: any) {
  const { allRateCards } = await splitCarriersByType(carrierConfigIds, supabase);
  return allRateCards;
}

// Bulk process rate card carriers instantly from original data
async function processBulkRateCards(payload: AnalysisPayload, rateCardCarrierIds: string[], user: any, supabase: any, analysisId?: string) {
  console.log('⚡ Starting bulk rate card processing from original data');
  
  // Check if we have recommendations or need to process from originalData
  let shipmentsToProcess: any[] = [];
  
  if (payload.recommendations && payload.recommendations.length > 0) {
    // Use existing recommendations if available
    shipmentsToProcess = payload.recommendations.filter(rec => 
      rec.allRates && rec.allRates.some((rate: any) => 
        rateCardCarrierIds.includes(rate.carrierId)
      )
    );
    console.log(`📋 Processing ${shipmentsToProcess.length} existing recommendations`);
  } else if (payload.originalData && payload.originalData.length > 0) {
    // Process from original data - this is the bulk processing case
    console.log(`📋 Processing ${payload.originalData.length} shipments from original data`);
    shipmentsToProcess = payload.originalData;
  }
  
  if (shipmentsToProcess.length === 0) {
    console.log('📝 No shipments found for bulk processing');
    return { processedShipments: [], shipmentRates: [] };
  }
  
  const processedShipments: any[] = [];
  const shipmentRates: any[] = [];
  
  // Get rate card configs for lookups
  const { data: rateCardConfigs, error: configError } = await supabase
    .from('carrier_configs')
    .select('*')
    .in('id', rateCardCarrierIds)
    .eq('is_rate_card', true);
    
  if (configError || !rateCardConfigs) {
    console.log('❌ Error fetching rate card configs:', configError);
    return { processedShipments: [], shipmentRates: [] };
  }
  
  console.log(`📋 Found ${rateCardConfigs.length} rate card configs for processing`);
  
  // Process shipments using direct rate card lookups
  for (let index = 0; index < shipmentsToProcess.length; index++) {
    const shipment = shipmentsToProcess[index];
    
    // Handle both recommendation format and original data format
    let shipmentData: any;
    let currentCost = 0;
    
    if (shipment.shipment) {
      // Recommendation format
      shipmentData = shipment.shipment;
      currentCost = parseFloat(shipment.currentCost || 0);
    } else {
      // Original data format
      shipmentData = shipment;
      currentCost = parseFloat(shipment.total_charges || shipment.amount || shipment.cost || 0);
    }
    
    if (!shipmentData.originZip || !shipmentData.destZip || !shipmentData.weight) {
      console.log(`⚠️ Skipping shipment ${index} - missing required data`);
      continue;
    }
    
    const allRatesForShipment: any[] = [];
    
    // Process each rate card config
    for (const config of rateCardConfigs) {
      try {
        const rate = await calculateRateCardRate(shipmentData, config, supabase);
        if (rate) {
          allRatesForShipment.push({
            ...rate,
            carrierId: config.id,
            carrierName: config.account_name,
            carrierType: config.carrier_type
          });
        }
      } catch (error) {
        console.log(`⚠️ Error calculating rate for config ${config.id}:`, error);
      }
    }
    
    if (allRatesForShipment.length === 0) {
      console.log(`⚠️ No rates found for shipment ${index}`);
      continue;
    }
    
    // Find best rate among rate cards
    let bestRate = allRatesForShipment[0];
    let lowestCost = parseFloat(bestRate.totalCharges || bestRate.rate_amount || Infinity);
    
    allRatesForShipment.forEach((rate: any) => {
      const rateCost = parseFloat(rate.totalCharges || rate.rate_amount || Infinity);
      if (rateCost < lowestCost) {
        lowestCost = rateCost;
        bestRate = rate;
      }
    });
    
    const newRate = lowestCost;
    const savings = currentCost - newRate;
    
    // Create processed shipment
    processedShipments.push({
      id: index + 1,
      trackingId: shipmentData.trackingId || shipmentData.tracking_number || `Shipment-${index + 1}`,
      originZip: shipmentData.originZip || shipmentData.origin_zip || '',
      destinationZip: shipmentData.destZip || shipmentData.destination_zip || '',
      weight: parseFloat(shipmentData.weight || '0'),
      length: parseFloat(shipmentData.length || '0'),
      width: parseFloat(shipmentData.width || '0'),
      height: parseFloat(shipmentData.height || '0'),
      dimensions: shipmentData.dimensions || `${shipmentData.length || 0}x${shipmentData.width || 0}x${shipmentData.height || 0}`,
      carrier: shipmentData.carrier || 'Rate Card',
      customer_service: shipmentData.service || shipmentData.customer_service || 'Ground',
      ShipPros_service: bestRate.serviceName || 'Ground',
      currentRate: currentCost,
      ShipPros_cost: newRate,
      savings: savings,
      savingsPercent: currentCost > 0 ? (savings / currentCost) * 100 : 0,
      analyzedWithAccount: bestRate.carrierName || 'Unknown',
      accountName: bestRate.carrierName || 'Unknown'
    });
    
    // Create shipment rates for all rate card carriers
    allRatesForShipment.forEach((rate: any) => {
      shipmentRates.push({
        analysis_id: analysisId,
        shipment_index: index,
        carrier_config_id: rate.carrierId || '',
        account_name: rate.carrierName || 'Unknown',
        carrier_type: rate.carrierType || 'rate_card',
        service_code: rate.serviceCode || 'GROUND',
        service_name: rate.serviceName || 'Ground',
        rate_amount: parseFloat(rate.totalCharges || rate.rate_amount || 0),
        currency: rate.currency || 'USD',
        transit_days: rate.transitDays || null,
        delivery_date: rate.deliveryDate || null,
        is_best_rate: rate === bestRate,
        source: 'rate_card'
      });
    });
  }
  
  console.log(`🎉 Bulk rate card processing complete: ${processedShipments.length} shipments processed`);
  return { processedShipments, shipmentRates };
}

// Calculate rate card rate for a single shipment
async function calculateRateCardRate(shipmentData: any, config: any, supabase: any) {
  try {
    const weight = parseFloat(shipmentData.weight || '0');
    const length = parseFloat(shipmentData.length || '0');
    const width = parseFloat(shipmentData.width || '0');
    const height = parseFloat(shipmentData.height || '0');
    
    // Calculate dimensional weight (length * width * height / 166)
    const dimWeight = (length * width * height) / 166;
    const billableWeight = Math.max(weight, dimWeight);
    
    const originZip = shipmentData.originZip || shipmentData.origin_zip || '';
    const destZip = shipmentData.destZip || shipmentData.destination_zip || '';
    
    if (!originZip || !destZip) {
      console.log('⚠️ Missing origin or destination zip');
      return null;
    }
    
    // Look up zone from rate card mapping
    const { data: zoneData } = await supabase
      .from('rate_card_zones')
      .select('zone')
      .eq('carrier_config_id', config.id)
      .eq('origin_zip', originZip.substring(0, 3))
      .eq('destination_zip', destZip.substring(0, 3))
      .single();
    
    if (!zoneData) {
      console.log(`⚠️ No zone found for ${originZip} -> ${destZip}`);
      return null;
    }
    
    // Look up rate from rate card
    const { data: rateData } = await supabase
      .from('rate_card_rates')
      .select('*')
      .eq('carrier_config_id', config.id)
      .eq('service_code', 'GROUND')
      .eq('zone', zoneData.zone)
      .lte('weight_min', billableWeight)
      .gte('weight_max', billableWeight)
      .single();
    
    if (!rateData) {
      console.log(`⚠️ No rate found for zone ${zoneData.zone}, weight ${billableWeight}`);
      return null;
    }
    
    return {
      serviceCode: 'GROUND',
      serviceName: `${config.carrier_type.toUpperCase()} Ground`,
      totalCharges: rateData.rate.toString(),
      rate_amount: rateData.rate,
      currency: 'USD',
      transitDays: null,
      source: 'rate_card',
      zone: zoneData.zone,
      billableWeight: billableWeight.toString()
    };
  } catch (error) {
    console.log('⚠️ Error calculating rate card rate:', error);
    return null;
  }
}

async function processBulkRateCards(shipments: any[], carriers: any[], analysisId: string, supabase: any) {
  console.log(`🚀 Processing ${shipments.length} shipments with rate cards`);
  const processedShipments = [];
  const shipmentRates = [];

  for (let i = 0; i < shipments.length; i++) {
    const shipment = shipments[i];
    
    for (const carrier of carriers) {
      const rate = await calculateRateCardRate(shipment, carrier, supabase);
      if (rate) {
        shipmentRates.push({
          analysis_id: analysisId,
          shipment_index: i,
          carrier_config_id: carrier.id,
          account_name: carrier.account_name,
          carrier_type: carrier.carrier_type,
          service_code: rate.serviceCode,
          service_name: rate.serviceName,
          rate_amount: rate.rate_amount,
          currency: rate.currency,
          transit_days: rate.transitDays,
          shipment_data: shipment,
          rate_response: { source: 'rate_card' }
        });
      }
    }
    
    processedShipments.push(shipment);
  }

  if (analysisId && shipmentRates.length > 0) {
    console.log(`💾 Bulk inserting ${shipmentRates.length} rate card rates`);
    const BULK_INSERT_SIZE = 1000;
    for (let i = 0; i < shipmentRates.length; i += BULK_INSERT_SIZE) {
      const chunk = shipmentRates.slice(i, i + BULK_INSERT_SIZE);
      await supabase.from('shipment_rates').insert(chunk);
    }
  }
  
  console.log(`✅ Bulk processed ${processedShipments.length} rate card shipments`);
  return { processedShipments, shipmentRates };
}

// Hybrid processing: Rate cards instantly + API carriers separately
async function handleHybridProcessing(payload: AnalysisPayload, user: any, supabase: any) {
  console.log('🔀 Starting hybrid carrier processing');
  
  const { rateCardCarriers, apiCarriers } = await splitCarriersByType(payload.carrierConfigsUsed, supabase);
  
  // Create initial analysis record
  const initialAnalysisRecord = {
    user_id: user.id,
    file_name: payload.fileName,
    original_data: payload.originalData,
    carrier_configs_used: payload.carrierConfigsUsed,
    service_mappings: payload.serviceMappings || [],
    savings_analysis: {
      totalCurrentCost: payload.totalCurrentCost,
      totalPotentialSavings: payload.totalPotentialSavings,
      savingsPercentage: payload.totalCurrentCost > 0 ? (payload.totalPotentialSavings / payload.totalCurrentCost) * 100 : 0,
      totalShipments: payload.totalShipments,
      completedShipments: payload.completedShipments,
      errorShipments: payload.errorShipments,
      orphanedShipments: payload.orphanedShipments
    },
    total_shipments: payload.totalShipments,
    total_savings: payload.totalPotentialSavings,
    status: 'processing',
    processing_metadata: {
      savedAt: new Date().toISOString(),
      processingType: 'hybrid',
      rateCardCarriers: rateCardCarriers.length,
      apiCarriers: apiCarriers.length,
      dataSource: 'hybrid_processing'
    }
  };
  
  const { data: analysisData, error: analysisError } = await supabase
    .from('shipping_analyses')
    .insert(initialAnalysisRecord)
    .select('id')
    .single();
    
  if (analysisError) {
    throw new Error(`Failed to create initial analysis record: ${analysisError.message}`);
  }
  
  console.log(`✅ Created analysis record ${analysisData.id}, starting hybrid processing`);
  
  // Process rate cards instantly
  const rateCardResults = await processBulkRateCards(payload, rateCardCarriers, user, supabase, analysisData.id);
  
  console.log(`⚡ Rate card processing completed instantly: ${rateCardResults.processedShipments.length} shipments`);
  
  // Update analysis with rate card results immediately
  const partialAnalysisData = {
    processed_shipments: rateCardResults.processedShipments,
    savings_analysis: {
      ...initialAnalysisRecord.savings_analysis,
      rateCardProcessingCompleted: new Date().toISOString(),
      rateCardShipmentsProcessed: rateCardResults.processedShipments.length
    },
    processing_metadata: {
      ...initialAnalysisRecord.processing_metadata,
      rateCardCompletedAt: new Date().toISOString(),
      rateCardStatus: 'completed'
    }
  };
  
  await supabase
    .from('shipping_analyses')
    .update(partialAnalysisData)
    .eq('id', analysisData.id);
  
  // Process API carriers in background if any exist
  if (apiCarriers.length > 0) {
    console.log(`🔄 Starting background API processing for ${apiCarriers.length} API carriers`);
    
    const processApiCarriersInBackground = async () => {
      try {
        // Filter payload to only include API carrier recommendations
        const apiRecommendations = payload.recommendations.filter(rec => 
          rec.allRates && rec.allRates.some((rate: any) => 
            apiCarriers.includes(rate.carrierId)
          )
        );
        
        if (apiRecommendations.length > 0) {
          const apiPayload = {
            ...payload,
            recommendations: apiRecommendations,
            carrierConfigsUsed: apiCarriers,
            batchInfo: {
              batchIndex: 0,
              totalBatches: 1,
              analysisId: analysisData.id
            }
          };
          
          console.log(`🔄 Processing ${apiRecommendations.length} API shipments`);
          await processBatch(apiPayload, user, supabase);
          
          // Mark API processing as completed
          await supabase
            .from('shipping_analyses')
            .update({ 
              status: 'completed',
              processing_metadata: {
                ...initialAnalysisRecord.processing_metadata,
                apiCompletedAt: new Date().toISOString(),
                apiStatus: 'completed',
                completedAt: new Date().toISOString()
              }
            })
            .eq('id', analysisData.id);
            
          console.log(`✅ API carrier processing completed for analysis ${analysisData.id}`);
        } else {
          // No API recommendations, mark as completed
          await supabase
            .from('shipping_analyses')
            .update({ 
              status: 'completed',
              processing_metadata: {
                ...initialAnalysisRecord.processing_metadata,
                completedAt: new Date().toISOString(),
                apiStatus: 'no_api_shipments'
              }
            })
            .eq('id', analysisData.id);
        }
      } catch (error) {
        console.error('❌ Error during API carrier processing:', error);
        
        await supabase
          .from('shipping_analyses')
          .update({ 
            status: 'partial_complete', // Rate cards completed, API failed
            processing_metadata: {
              ...initialAnalysisRecord.processing_metadata,
              apiError: error.message,
              apiFailedAt: new Date().toISOString()
            }
          })
          .eq('id', analysisData.id);
      }
    };
    
    // Start API processing in background
    EdgeRuntime.waitUntil(processApiCarriersInBackground());
  } else {
    // No API carriers, mark as fully completed
    await supabase
      .from('shipping_analyses')
      .update({ 
        status: 'completed',
        processing_metadata: {
          ...initialAnalysisRecord.processing_metadata,
          completedAt: new Date().toISOString(),
          apiStatus: 'no_api_carriers'
        }
      })
      .eq('id', analysisData.id);
  }
  
  // Return immediate response with rate card results
  return new Response(
    JSON.stringify({ 
      success: true, 
      analysisId: analysisData.id,
      message: rateCardCarriers.length > 0 
        ? `Rate card results ready instantly! ${apiCarriers.length > 0 ? 'API carriers processing in background.' : ''}`
        : 'Analysis started - processing in background',
      processingInfo: {
        rateCardCarriers: rateCardCarriers.length,
        apiCarriers: apiCarriers.length,
        rateCardShipmentsProcessed: rateCardResults.processedShipments.length,
        processingType: 'hybrid',
        status: rateCardCarriers.length > 0 ? 'rate_cards_ready' : 'processing'
      }
    }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}

// Parallel processing for rate card analyses (pure rate card only)
async function handleRateCardParallelProcessing(payload: AnalysisPayload, user: any, supabase: any) {
  console.log('🚀 Starting parallel rate card processing');
  
  const PARALLEL_CHUNK_SIZE = 500; // Smaller chunks for parallel processing
  const MAX_PARALLEL_CHUNKS = 10; // Maximum parallel operations
  const totalChunks = Math.ceil(payload.recommendations.length / PARALLEL_CHUNK_SIZE);
  
  // Create initial analysis record
  const initialAnalysisRecord = {
    user_id: user.id,
    file_name: payload.fileName,
    original_data: payload.originalData,
    carrier_configs_used: payload.carrierConfigsUsed,
    service_mappings: payload.serviceMappings || [],
    savings_analysis: {
      totalCurrentCost: payload.totalCurrentCost,
      totalPotentialSavings: payload.totalPotentialSavings,
      savingsPercentage: payload.totalCurrentCost > 0 ? (payload.totalPotentialSavings / payload.totalCurrentCost) * 100 : 0,
      totalShipments: payload.totalShipments,
      completedShipments: payload.completedShipments,
      errorShipments: payload.errorShipments,
      orphanedShipments: payload.orphanedShipments
    },
    total_shipments: payload.totalShipments,
    total_savings: payload.totalPotentialSavings,
    status: 'processing',
    processing_metadata: {
      savedAt: new Date().toISOString(),
      totalChunks: totalChunks,
      processingType: 'parallel_rate_card',
      dataSource: 'parallel_processing'
    }
  };
  
  const { data: analysisData, error: analysisError } = await supabase
    .from('shipping_analyses')
    .insert(initialAnalysisRecord)
    .select('id')
    .single();
    
  if (analysisError) {
    throw new Error(`Failed to create initial analysis record: ${analysisError.message}`);
  }
  
  console.log(`✅ Created analysis record ${analysisData.id}, starting parallel processing`);
  
  // Process chunks in parallel using EdgeRuntime.waitUntil
  const processParallelChunks = async () => {
    try {
      const allProcessedShipments: any[] = [];
      const allShipmentRates: any[] = [];
      
      // Process chunks in batches to avoid overwhelming the system
      for (let i = 0; i < totalChunks; i += MAX_PARALLEL_CHUNKS) {
        const chunkPromises: Promise<{ shipments: any[], rates: any[] }>[] = [];
        
        // Create parallel chunk processors
        for (let j = 0; j < MAX_PARALLEL_CHUNKS && (i + j) < totalChunks; j++) {
          const chunkIndex = i + j;
          const startIndex = chunkIndex * PARALLEL_CHUNK_SIZE;
          const endIndex = Math.min(startIndex + PARALLEL_CHUNK_SIZE, payload.recommendations.length);
          const chunkRecommendations = payload.recommendations.slice(startIndex, endIndex);
          
          console.log(`🔄 Starting parallel chunk ${chunkIndex + 1}/${totalChunks} (${chunkRecommendations.length} shipments)`);
          
          chunkPromises.push(processRateCardChunk(chunkRecommendations, chunkIndex, analysisData.id, PARALLEL_CHUNK_SIZE));
        }
        
        // Wait for this batch of parallel chunks to complete
        const chunkResults = await Promise.all(chunkPromises);
        
        // Collect results
        chunkResults.forEach(result => {
          allProcessedShipments.push(...result.shipments);
          allShipmentRates.push(...result.rates);
        });
        
        console.log(`✅ Completed parallel batch ${Math.floor(i / MAX_PARALLEL_CHUNKS) + 1}, processed ${allProcessedShipments.length} total shipments`);
      }
      
      // Calculate final account totals and service mappings
      const { accountTotals, serviceToAccountMapping, bestOverallAccount } = calculateOptimizedMappings(allProcessedShipments);
      
      // Bulk insert all shipment rates
      if (allShipmentRates.length > 0) {
        console.log(`💾 Bulk inserting ${allShipmentRates.length} shipment rates`);
        const BULK_INSERT_SIZE = 1000;
        for (let i = 0; i < allShipmentRates.length; i += BULK_INSERT_SIZE) {
          const chunk = allShipmentRates.slice(i, i + BULK_INSERT_SIZE);
          await supabase.from('shipment_rates').insert(chunk);
        }
      }
      
      // Update final analysis with all data
      const finalAnalysisData = {
        status: 'completed',
        processed_shipments: allProcessedShipments,
        savings_analysis: {
          ...initialAnalysisRecord.savings_analysis,
          accountTotals,
          serviceToAccountMapping,
          bestOverallAccount,
          finalizedAt: new Date().toISOString()
        },
        processing_metadata: {
          ...initialAnalysisRecord.processing_metadata,
          completedAt: new Date().toISOString(),
          totalProcessedShipments: allProcessedShipments.length,
          processingSpeed: `${Math.round(allProcessedShipments.length / ((Date.now() - new Date(initialAnalysisRecord.processing_metadata.savedAt).getTime()) / 1000))} shipments/sec`
        }
      };
      
      await supabase
        .from('shipping_analyses')
        .update(finalAnalysisData)
        .eq('id', analysisData.id);
        
      console.log(`🎉 Parallel rate card analysis completed for ${allProcessedShipments.length} shipments`);
    } catch (error) {
      console.error('❌ Error during parallel rate card processing:', error);
      
      await supabase
        .from('shipping_analyses')
        .update({ 
          status: 'failed',
          processing_metadata: {
            ...initialAnalysisRecord.processing_metadata,
            error: error.message,
            failedAt: new Date().toISOString()
          }
        })
        .eq('id', analysisData.id);
    }
  };
  
  // Start parallel processing in background
  EdgeRuntime.waitUntil(processParallelChunks());
  
  // Return immediate response
  return new Response(
    JSON.stringify({ 
      success: true, 
      analysisId: analysisData.id,
      message: 'Rate card analysis started - processing in parallel for optimal speed',
      processingInfo: {
        totalChunks: totalChunks,
        chunkSize: PARALLEL_CHUNK_SIZE,
        processingType: 'parallel',
        status: 'processing'
      }
    }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}

// Process a single chunk of rate card recommendations
async function processRateCardChunk(recommendations: any[], chunkIndex: number, analysisId: string, chunkSize: number): Promise<{ shipments: any[], rates: any[] }> {
  const processedShipments: any[] = [];
  const shipmentRates: any[] = [];
  
  recommendations.forEach((rec, localIndex) => {
    const globalIndex = chunkIndex * chunkSize + localIndex;
    
    if (!rec.allRates || !Array.isArray(rec.allRates) || rec.allRates.length === 0) {
      return;
    }
    
    // Find best rate for this shipment
    let bestRate = rec.allRates[0];
    let lowestCost = parseFloat(bestRate.totalCharges || bestRate.negotiatedRate || bestRate.rate_amount || Infinity);
    
    rec.allRates.forEach((rate: any) => {
      const rateCost = parseFloat(rate.totalCharges || rate.negotiatedRate || rate.rate_amount || Infinity);
      if (rateCost < lowestCost) {
        lowestCost = rateCost;
        bestRate = rate;
      }
    });
    
    const currentRate = parseFloat(rec.currentCost || 0);
    const newRate = lowestCost;
    const savings = currentRate - newRate;
    
    // Create processed shipment
    processedShipments.push({
      id: globalIndex + 1,
      trackingId: rec.shipment.trackingId || `Shipment-${globalIndex + 1}`,
      originZip: rec.shipment.originZip || '',
      destinationZip: rec.shipment.destZip || '',
      weight: parseFloat(rec.shipment.weight || '0'),
      length: parseFloat(rec.shipment.length || '0'),
      width: parseFloat(rec.shipment.width || '0'),
      height: parseFloat(rec.shipment.height || '0'),
      dimensions: rec.shipment.dimensions,
      carrier: rec.carrier || 'Rate Card',
      customer_service: rec.customer_service || rec.shipment.service || 'Unknown',
      ShipPros_service: bestRate.serviceName || bestRate.description || 'Ground',
      currentRate: currentRate,
      ShipPros_cost: newRate,
      savings: savings,
      savingsPercent: currentRate > 0 ? (savings / currentRate) * 100 : 0,
      analyzedWithAccount: bestRate.carrierName || bestRate.accountName || 'Unknown',
      accountName: bestRate.carrierName || bestRate.accountName || 'Unknown'
    });
    
    // Create shipment rates
    rec.allRates.forEach((rate: any) => {
      shipmentRates.push({
        analysis_id: analysisId,
        shipment_index: globalIndex,
        carrier_config_id: rate.carrierId || '',
        account_name: rate.carrierName || rate.accountName || 'Unknown',
        carrier_type: rate.carrierType || 'rate_card',
        service_code: rate.serviceCode || '',
        service_name: rate.serviceName || rate.description || '',
        rate_amount: rate.totalCharges || rate.negotiatedRate || rate.rate_amount || 0,
        currency: rate.currency || 'USD',
        transit_days: rate.transitTime || null,
        is_negotiated: rate.rateType === 'negotiated' || rate.hasNegotiatedRates || false,
        published_rate: rate.publishedRate || null,
        shipment_data: rec.shipment || {}
      });
    });
  });
  
  return { shipments: processedShipments, rates: shipmentRates };
}

// Calculate optimized account mappings from all processed shipments
function calculateOptimizedMappings(allShipments: any[]) {
  const accountTotals: { [key: string]: { totalCost: number; shipmentCount: number } } = {};
  const serviceCategoryStats: { [serviceCategory: string]: { [accountName: string]: { totalCost: number; rateCount: number } } } = {};
  
  // Aggregate data from all shipments
  allShipments.forEach(shipment => {
    const accountName = shipment.accountName;
    const serviceCategory = shipment.customer_service;
    const cost = shipment.ShipPros_cost;
    
    // Account totals
    if (!accountTotals[accountName]) {
      accountTotals[accountName] = { totalCost: 0, shipmentCount: 0 };
    }
    accountTotals[accountName].totalCost += cost;
    accountTotals[accountName].shipmentCount += 1;
    
    // Service category stats
    if (!serviceCategoryStats[serviceCategory]) {
      serviceCategoryStats[serviceCategory] = {};
    }
    if (!serviceCategoryStats[serviceCategory][accountName]) {
      serviceCategoryStats[serviceCategory][accountName] = { totalCost: 0, rateCount: 0 };
    }
    serviceCategoryStats[serviceCategory][accountName].totalCost += cost;
    serviceCategoryStats[serviceCategory][accountName].rateCount += 1;
  });
  
  // Find best overall account
  let bestOverallAccount = '';
  let lowestTotalCost = Infinity;
  
  Object.entries(accountTotals).forEach(([accountName, totals]) => {
    if (totals.totalCost < lowestTotalCost) {
      lowestTotalCost = totals.totalCost;
      bestOverallAccount = accountName;
    }
  });
  
  // Create service-to-account mapping
  const serviceToAccountMapping: { [serviceCategory: string]: string } = {};
  
  Object.keys(serviceCategoryStats).forEach(serviceCategory => {
    const accounts = serviceCategoryStats[serviceCategory];
    
    if (accounts[bestOverallAccount] && accounts[bestOverallAccount].rateCount > 0) {
      serviceToAccountMapping[serviceCategory] = bestOverallAccount;
    } else {
      let bestAccountForService = '';
      let lowestAverageCost = Infinity;
      
      Object.entries(accounts).forEach(([accountName, stats]) => {
        const averageCost = stats.totalCost / stats.rateCount;
        if (averageCost < lowestAverageCost) {
          lowestAverageCost = averageCost;
          bestAccountForService = accountName;
        }
      });
      
      serviceToAccountMapping[serviceCategory] = bestAccountForService || bestOverallAccount;
    }
  });
  
  return { accountTotals, serviceToAccountMapping, bestOverallAccount };
}

// Batch processing functions
async function handleLargeDatasetBatching(payload: AnalysisPayload, user: any, supabase: any) {
  console.log('🔄 Initiating batch processing for large dataset');
  
  const BATCH_SIZE = 2000;
  const totalBatches = Math.ceil(payload.recommendations.length / BATCH_SIZE);
  
  // Create initial analysis record with processing status
  const initialAnalysisRecord = {
    user_id: user.id,
    file_name: payload.fileName,
    original_data: payload.originalData,
    carrier_configs_used: payload.carrierConfigsUsed,
    service_mappings: payload.serviceMappings || [],
    savings_analysis: {
      totalCurrentCost: payload.totalCurrentCost,
      totalPotentialSavings: payload.totalPotentialSavings,
      savingsPercentage: payload.totalCurrentCost > 0 ? (payload.totalPotentialSavings / payload.totalCurrentCost) * 100 : 0,
      totalShipments: payload.totalShipments,
      completedShipments: payload.completedShipments,
      errorShipments: payload.errorShipments,
      orphanedShipments: payload.orphanedShipments
    },
    total_shipments: payload.totalShipments,
    total_savings: payload.totalPotentialSavings,
    status: 'processing',
    processing_metadata: {
      savedAt: new Date().toISOString(),
      totalBatches: totalBatches,
      completedBatches: 0,
      dataSource: 'batch_processing'
    }
  };
  
  const { data: analysisData, error: analysisError } = await supabase
    .from('shipping_analyses')
    .insert(initialAnalysisRecord)
    .select('id')
    .single();
    
  if (analysisError) {
    throw new Error(`Failed to create initial analysis record: ${analysisError.message}`);
  }
  
  console.log(`✅ Created analysis record ${analysisData.id}, starting background batch processing`);
  
  // Process batches in background using EdgeRuntime.waitUntil
  const processBatchesInBackground = async () => {
    try {
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const startIndex = batchIndex * BATCH_SIZE;
        const endIndex = Math.min(startIndex + BATCH_SIZE, payload.recommendations.length);
        const batchRecommendations = payload.recommendations.slice(startIndex, endIndex);
        
        // Create batch payload
        const batchPayload = {
          ...payload,
          recommendations: batchRecommendations,
          batchInfo: {
            batchIndex: batchIndex,
            totalBatches: totalBatches,
            analysisId: analysisData.id
          }
        };
        
        console.log(`🔄 Processing batch ${batchIndex + 1}/${totalBatches} with ${batchRecommendations.length} shipments`);
        
        // Process this batch (recursive call but with batch info)
        await processBatch(batchPayload, user, supabase);
        
        console.log(`✅ Completed batch ${batchIndex + 1}/${totalBatches}`);
      }
      
      // Mark analysis as completed
      await supabase
        .from('shipping_analyses')
        .update({ 
          status: 'completed',
          processing_metadata: {
            ...initialAnalysisRecord.processing_metadata,
            completedBatches: totalBatches,
            completedAt: new Date().toISOString()
          }
        })
        .eq('id', analysisData.id);
        
      console.log(`🎉 All batches completed for analysis ${analysisData.id}`);
    } catch (error) {
      console.error('❌ Error during batch processing:', error);
      
      // Mark analysis as failed
      await supabase
        .from('shipping_analyses')
        .update({ 
          status: 'failed',
          processing_metadata: {
            ...initialAnalysisRecord.processing_metadata,
            error: error.message,
            failedAt: new Date().toISOString()
          }
        })
        .eq('id', analysisData.id);
    }
  };
  
  // Start background processing
  EdgeRuntime.waitUntil(processBatchesInBackground());
  
  // Return immediate response with analysis ID
  return new Response(
    JSON.stringify({ 
      success: true, 
      analysisId: analysisData.id,
      message: 'Large dataset analysis started - processing in background',
      batchInfo: {
        totalBatches: totalBatches,
        status: 'processing'
      }
    }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}

async function handleBatchRequest(payload: AnalysisPayload, user: any, supabase: any) {
  console.log(`🔄 Processing batch ${payload.batchInfo!.batchIndex + 1}/${payload.batchInfo!.totalBatches}`);
  
  return await processBatch(payload, user, supabase);
}

async function processBatch(payload: AnalysisPayload, user: any, supabase: any) {
  // This function contains the core processing logic
  // (moved from the main handler to be reusable for batches)
  
  // Filter valid recommendations for this batch
  const validRecommendations = payload.recommendations.filter(rec => {
    const service = rec.customer_service || rec.shipment.service || '';
    const hasValidService = service && service.trim() !== '' && service !== 'Unknown';
    const hasRates = rec.allRates && rec.allRates.length > 0;
    return hasValidService && hasRates;
  });

  // Calculate account totals for this batch
  const accountTotals: { [key: string]: { totalCost: number; shipmentCount: number } } = {};
  
  validRecommendations.forEach(rec => {
    if (rec.allRates && Array.isArray(rec.allRates)) {
      rec.allRates.forEach((rate: any) => {
        const accountName = rate.carrierName || rate.accountName || 'Unknown';
        const carrierType = rate.carrierType || 'unknown';
        const serviceName = rate.serviceName || '';
        
        if (carrierType.toLowerCase() === 'amazon' && 
            serviceName.toLowerCase() !== 'ground' && 
            !serviceName.toLowerCase().includes('ground')) {
          return;
        }
        
        if (!accountTotals[accountName]) {
          accountTotals[accountName] = { totalCost: 0, shipmentCount: 0 };
        }
        const rateAmount = parseFloat(rate.totalCharges || rate.negotiatedRate || rate.rate_amount || 0);
        accountTotals[accountName].totalCost += rateAmount;
        accountTotals[accountName].shipmentCount += 1;
      });
    }
  });

  // Find best account for this batch
  let bestOverallAccount = '';
  let lowestTotalCost = Infinity;
  
  Object.entries(accountTotals).forEach(([accountName, totals]) => {
    if (totals.totalCost < lowestTotalCost) {
      lowestTotalCost = totals.totalCost;
      bestOverallAccount = accountName;
    }
  });

  // Create service-to-account mapping for this batch
  const serviceToAccountMapping: { [serviceCategory: string]: string } = {};
  const serviceCategoryStats: { [serviceCategory: string]: { [accountName: string]: { totalCost: number; rateCount: number } } } = {};
  
  validRecommendations.forEach(rec => {
    if (rec.allRates && Array.isArray(rec.allRates)) {
      const serviceCategory = rec.customer_service || rec.shipment.service || 'Unknown';
      
      if (!serviceCategoryStats[serviceCategory]) {
        serviceCategoryStats[serviceCategory] = {};
      }
      
      rec.allRates.forEach((rate: any) => {
        const accountName = rate.carrierName || rate.accountName || 'Unknown';
        const carrierType = rate.carrierType || 'unknown';
        const serviceName = rate.serviceName || '';
        
        if (carrierType.toLowerCase() === 'amazon' && 
            serviceName.toLowerCase() !== 'ground' && 
            !serviceName.toLowerCase().includes('ground')) {
          return;
        }
        
        if (!serviceCategoryStats[serviceCategory][accountName]) {
          serviceCategoryStats[serviceCategory][accountName] = { totalCost: 0, rateCount: 0 };
        }
        
        const rateAmount = parseFloat(rate.totalCharges || rate.negotiatedRate || rate.rate_amount || 0);
        serviceCategoryStats[serviceCategory][accountName].totalCost += rateAmount;
        serviceCategoryStats[serviceCategory][accountName].rateCount += 1;
      });
    }
  });

  Object.keys(serviceCategoryStats).forEach(serviceCategory => {
    const accounts = serviceCategoryStats[serviceCategory];
    
    if (accounts[bestOverallAccount] && accounts[bestOverallAccount].rateCount > 0) {
      serviceToAccountMapping[serviceCategory] = bestOverallAccount;
    } else {
      let bestAccountForService = '';
      let lowestAverageCost = Infinity;
      
      Object.entries(accounts).forEach(([accountName, stats]) => {
        const averageCost = stats.totalCost / stats.rateCount;
        if (averageCost < lowestAverageCost) {
          lowestAverageCost = averageCost;
          bestAccountForService = accountName;
        }
      });
      
      serviceToAccountMapping[serviceCategory] = bestAccountForService || bestOverallAccount;
    }
  });

  // Process shipments for this batch
  const processedShipments = validRecommendations.map((rec, index) => {
    const serviceCategory = rec.customer_service || rec.shipment.service || 'Unknown';
    const assignedAccount = serviceToAccountMapping[serviceCategory] || bestOverallAccount;
    
    let assignedAccountRate = null;
    if (rec.allRates && Array.isArray(rec.allRates)) {
      assignedAccountRate = rec.allRates.find((rate: any) => {
        const accountName = rate.carrierName || rate.accountName || 'Unknown';
        return accountName === assignedAccount;
      });
    }

    const newRate = assignedAccountRate ? 
      parseFloat(assignedAccountRate.totalCharges || assignedAccountRate.negotiatedRate || assignedAccountRate.rate_amount || 0) : 
      parseFloat(rec.recommendedCost || 0);
    const currentRate = parseFloat(rec.currentCost || 0);
    const savings = currentRate - newRate;

    // Calculate batch-aware ID
    const batchStartIndex = payload.batchInfo ? payload.batchInfo.batchIndex * 2000 : 0;

    return {
      id: batchStartIndex + index + 1,
      trackingId: rec.shipment.trackingId || `Shipment-${batchStartIndex + index + 1}`,
      originZip: rec.shipment.originZip || '',
      destinationZip: rec.shipment.destZip || '',
      weight: parseFloat(rec.shipment.weight || '0'),
      length: parseFloat(rec.shipment.length || '0'),
      width: parseFloat(rec.shipment.width || '0'),
      height: parseFloat(rec.shipment.height || '0'),
      dimensions: rec.shipment.dimensions,
      carrier: rec.carrier || 'UPS',
      customer_service: rec.customer_service || rec.shipment.service || 'Unknown',
      ShipPros_service: assignedAccountRate ? (assignedAccountRate.serviceName || assignedAccountRate.description || 'Ground') : 'Ground',
      currentRate: currentRate,
      ShipPros_cost: newRate,
      savings: savings,
      savingsPercent: currentRate > 0 ? (savings / currentRate) * 100 : 0,
      analyzedWithAccount: assignedAccount,
      accountName: assignedAccount
    }
  });

  // Handle batch data insertion
  if (payload.batchInfo) {
    // For batches, append data instead of replacing
    const analysisId = payload.batchInfo.analysisId;
    
    // Get current analysis data
    const { data: currentAnalysis } = await supabase
      .from('shipping_analyses')
      .select('processed_shipments, processing_metadata')
      .eq('id', analysisId)
      .single();
      
    const existingShipments = currentAnalysis?.processed_shipments || [];
    const updatedShipments = [...existingShipments, ...processedShipments];
    
    // Update processing metadata
    const updatedMetadata = {
      ...currentAnalysis?.processing_metadata,
      completedBatches: payload.batchInfo.batchIndex + 1,
      lastBatchCompletedAt: new Date().toISOString()
    };
    
    // Update analysis with batch data
    const { error: updateError } = await supabase
      .from('shipping_analyses')
      .update({
        processed_shipments: updatedShipments,
        processing_metadata: updatedMetadata
      })
      .eq('id', analysisId);
      
    if (updateError) {
      throw new Error(`Failed to update batch data: ${updateError.message}`);
    }
    
    // Insert shipment rates for this batch
    const shipmentRatesToInsert: any[] = [];
    const batchStartIndex = payload.batchInfo.batchIndex * 2000;
    
    payload.recommendations.forEach((rec, localIndex) => {
      if (rec.allRates && Array.isArray(rec.allRates)) {
        rec.allRates.forEach((rate: any) => {
          shipmentRatesToInsert.push({
            analysis_id: analysisId,
            shipment_index: batchStartIndex + localIndex,
            carrier_config_id: rate.carrierId || '',
            account_name: rate.carrierName || rate.accountName || 'Unknown',
            carrier_type: rate.carrierType || 'ups',
            service_code: rate.serviceCode || '',
            service_name: rate.serviceName || rate.description || '',
            rate_amount: rate.totalCharges || rate.negotiatedRate || rate.rate_amount || 0,
            currency: rate.currency || 'USD',
            transit_days: rate.transitTime || null,
            is_negotiated: rate.rateType === 'negotiated' || rate.hasNegotiatedRates || false,
            published_rate: rate.publishedRate || null,
            shipment_data: rec.shipment || {}
          });
        });
      }
    });
    
    if (shipmentRatesToInsert.length > 0) {
      await supabase
        .from('shipment_rates')
        .insert(shipmentRatesToInsert);
    }
    
    console.log(`✅ Batch ${payload.batchInfo.batchIndex + 1}/${payload.batchInfo.totalBatches} completed`);
    
    return new Response(
      JSON.stringify({
        success: true,
        batchIndex: payload.batchInfo.batchIndex,
        totalBatches: payload.batchInfo.totalBatches,
        isComplete: payload.batchInfo.batchIndex === payload.batchInfo.totalBatches - 1
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  // This should not happen in batch mode, but included for completeness
  return new Response(
    JSON.stringify({ success: true, message: 'Batch processed' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get user from JWT token
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      throw new Error('Invalid authentication')
    }

    const payload: AnalysisPayload = await req.json()
    
    console.log('Finalizing analysis:', {
      fileName: payload.fileName,
      totalShipments: payload.totalShipments,
      completedShipments: payload.completedShipments,
      errorShipments: payload.errorShipments,
      totalSavings: payload.totalPotentialSavings,
      isBatch: !!payload.batchInfo
    })

// Check carrier types and determine processing strategy
    const { rateCardCarriers, apiCarriers, allRateCards } = await splitCarriersByType(payload.carrierConfigsUsed, supabase);
    
    // Smart size detection - datasets over 5000 shipments should use batch processing (except rate cards)
    const BATCH_THRESHOLD = 5000;
    const BATCH_SIZE = 2000;
    const isLargeDataset = payload.totalShipments > BATCH_THRESHOLD;
    
    // Use hybrid processing for mixed carrier scenarios (rate cards + APIs)
    if (rateCardCarriers.length > 0 && apiCarriers.length > 0 && !payload.batchInfo) {
      console.log('🔀 Mixed carrier analysis detected - using hybrid processing (rate cards instant + API background)');
      return await handleHybridProcessing(payload, user, supabase);
    }
    
    // Pure rate card analyses use parallel processing for speed optimization
    if (allRateCards && isLargeDataset && !payload.batchInfo) {
      console.log('⚡ Large rate card analysis detected - using parallel processing for optimization');
      return await handleRateCardParallelProcessing(payload, user, supabase);
    } else if (allRateCards) {
      console.log('⚡ Rate card-only analysis detected - processing immediately (no batching needed)');
    } else if (isLargeDataset && !payload.batchInfo) {
      console.log('📊 Large dataset with API calls detected - using batch processing');
      return await handleLargeDatasetBatching(payload, user, supabase);
    }
    
    // If this is a batch request, handle it appropriately
    if (payload.batchInfo) {
      return await handleBatchRequest(payload, user, supabase);
    }

    // Check for existing analysis with smart duplicate detection
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const { data: existingAnalyses } = await supabase
      .from('shipping_analyses')
      .select('id, file_name, created_at, total_shipments, processed_shipments, recommendations, status')
      .eq('user_id', user.id)
      .eq('file_name', payload.fileName)
      .eq('total_shipments', payload.totalShipments)
      .gte('created_at', fiveMinutesAgo)
      .order('created_at', { ascending: false })

    if (existingAnalyses && existingAnalyses.length > 0) {
      const existingAnalysis = existingAnalyses[0]
      console.log('Found existing analysis:', {
        id: existingAnalysis.id,
        status: existingAnalysis.status,
        hasProcessedShipments: existingAnalysis.processed_shipments && Array.isArray(existingAnalysis.processed_shipments) && existingAnalysis.processed_shipments.length > 0,
        hasRecommendations: existingAnalysis.recommendations && Array.isArray(existingAnalysis.recommendations) && existingAnalysis.recommendations.length > 0
      })

      // Check if existing analysis has complete data
      const hasCompleteData = (
        existingAnalysis.processed_shipments && 
        Array.isArray(existingAnalysis.processed_shipments) && 
        existingAnalysis.processed_shipments.length > 0
      ) || (
        existingAnalysis.recommendations && 
        Array.isArray(existingAnalysis.recommendations) && 
        existingAnalysis.recommendations.length > 0
      )

      if (hasCompleteData) {
        console.log('Existing analysis has complete data, returning existing ID:', existingAnalysis.id)
        return new Response(
          JSON.stringify({ 
            success: true, 
            analysisId: existingAnalysis.id,
            message: 'Analysis already exists with complete data'
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      } else {
        console.log('Existing analysis is incomplete, will update with complete data')
        // Continue to update the incomplete analysis with complete data
      }
    }

    // Filter out shipments that should be orphaned (missing service type or no rates)
    const validRecommendations = payload.recommendations.filter(rec => {
      const service = rec.customer_service || rec.shipment.service || '';
      const hasValidService = service && service.trim() !== '' && service !== 'Unknown';
      const hasRates = rec.allRates && rec.allRates.length > 0;
      return hasValidService && hasRates;
    });

    // Determine the best overall account before processing shipments
    // Calculate total cost for each account across all shipments
    const accountTotals: { [key: string]: { totalCost: number; shipmentCount: number } } = {};
    
    validRecommendations.forEach(rec => {
      if (rec.allRates && Array.isArray(rec.allRates)) {
        rec.allRates.forEach((rate: any) => {
          const accountName = rate.carrierName || rate.accountName || 'Unknown';
          const carrierType = rate.carrierType || 'unknown';
          const serviceName = rate.serviceName || '';
          
          // Filter out Amazon rates for non-Ground services (these should not exist but are invalid if they do)
          if (carrierType.toLowerCase() === 'amazon' && 
              serviceName.toLowerCase() !== 'ground' && 
              !serviceName.toLowerCase().includes('ground')) {
            console.log(`⚠️ Filtering out invalid Amazon rate for non-Ground service: ${serviceName}`);
            return;
          }
          
          if (!accountTotals[accountName]) {
            accountTotals[accountName] = { totalCost: 0, shipmentCount: 0 };
          }
          const rateAmount = parseFloat(rate.totalCharges || rate.negotiatedRate || rate.rate_amount || 0);
          accountTotals[accountName].totalCost += rateAmount;
          accountTotals[accountName].shipmentCount += 1;
        });
      }
    });

    // Find the account with the lowest total cost
    let bestOverallAccount = '';
    let lowestTotalCost = Infinity;
    
    Object.entries(accountTotals).forEach(([accountName, totals]) => {
      if (totals.totalCost < lowestTotalCost) {
        lowestTotalCost = totals.totalCost;
        bestOverallAccount = accountName;
      }
    });

    console.log('Best overall account determined:', bestOverallAccount, 'with total cost:', lowestTotalCost);
    console.log('Account totals:', accountTotals);

    // Group rates by service categories to create service-to-account mapping
    const serviceToAccountMapping: { [serviceCategory: string]: string } = {};
    const serviceCategoryStats: { [serviceCategory: string]: { [accountName: string]: { totalCost: number; rateCount: number } } } = {};
    
    // First, collect all rates grouped by service category and account
    validRecommendations.forEach(rec => {
      if (rec.allRates && Array.isArray(rec.allRates)) {
        const serviceCategory = rec.customer_service || rec.shipment.service || 'Unknown';
        
        if (!serviceCategoryStats[serviceCategory]) {
          serviceCategoryStats[serviceCategory] = {};
        }
        
        rec.allRates.forEach((rate: any) => {
          const accountName = rate.carrierName || rate.accountName || 'Unknown';
          const carrierType = rate.carrierType || 'unknown';
          const serviceName = rate.serviceName || '';
          
          // Filter out Amazon rates for non-Ground services
          if (carrierType.toLowerCase() === 'amazon' && 
              serviceName.toLowerCase() !== 'ground' && 
              !serviceName.toLowerCase().includes('ground')) {
            return;
          }
          
          if (!serviceCategoryStats[serviceCategory][accountName]) {
            serviceCategoryStats[serviceCategory][accountName] = { totalCost: 0, rateCount: 0 };
          }
          
          const rateAmount = parseFloat(rate.totalCharges || rate.negotiatedRate || rate.rate_amount || 0);
          serviceCategoryStats[serviceCategory][accountName].totalCost += rateAmount;
          serviceCategoryStats[serviceCategory][accountName].rateCount += 1;
        });
      }
    });

    // Create service-to-account mapping: primary account first, then best per service category
    Object.keys(serviceCategoryStats).forEach(serviceCategory => {
      const accounts = serviceCategoryStats[serviceCategory];
      
      // Check if best overall account supports this service category
      if (accounts[bestOverallAccount] && accounts[bestOverallAccount].rateCount > 0) {
        serviceToAccountMapping[serviceCategory] = bestOverallAccount;
      } else {
        // Find the account with the lowest average cost for this service category
        let bestAccountForService = '';
        let lowestAverageCost = Infinity;
        
        Object.entries(accounts).forEach(([accountName, stats]) => {
          const averageCost = stats.totalCost / stats.rateCount;
          if (averageCost < lowestAverageCost) {
            lowestAverageCost = averageCost;
            bestAccountForService = accountName;
          }
        });
        
        serviceToAccountMapping[serviceCategory] = bestAccountForService || bestOverallAccount;
      }
    });

    console.log('Service-to-account mapping:', serviceToAccountMapping);
    console.log('Best overall account:', bestOverallAccount);

    // Format processed shipments using service-based account selection
    const processedShipments = validRecommendations.map((rec, index) => {
      const serviceCategory = rec.customer_service || rec.shipment.service || 'Unknown';
      const assignedAccount = serviceToAccountMapping[serviceCategory] || bestOverallAccount;
      
      // Find the rate from the assigned account for this shipment
      let assignedAccountRate = null;
      if (rec.allRates && Array.isArray(rec.allRates)) {
        assignedAccountRate = rec.allRates.find((rate: any) => {
          const accountName = rate.carrierName || rate.accountName || 'Unknown';
          return accountName === assignedAccount;
        });
      }

      // Use the assigned account rate or fallback to best available rate
      const newRate = assignedAccountRate ? 
        parseFloat(assignedAccountRate.totalCharges || assignedAccountRate.negotiatedRate || assignedAccountRate.rate_amount || 0) : 
        parseFloat(rec.recommendedCost || 0);
      const currentRate = parseFloat(rec.currentCost || 0);
      const savings = currentRate - newRate;

      return {
        id: index + 1,
        trackingId: rec.shipment.trackingId || `Shipment-${index + 1}`,
        originZip: rec.shipment.originZip || '',
        destinationZip: rec.shipment.destZip || '',
        weight: parseFloat(rec.shipment.weight || '0'),
        length: parseFloat(rec.shipment.length || '0'),
        width: parseFloat(rec.shipment.width || '0'),
        height: parseFloat(rec.shipment.height || '0'),
        dimensions: rec.shipment.dimensions,
        carrier: rec.carrier || 'UPS',
        customer_service: rec.customer_service || rec.shipment.service || 'Unknown',
        ShipPros_service: assignedAccountRate ? (assignedAccountRate.serviceName || assignedAccountRate.description || 'Ground') : 'Ground',
        currentRate: currentRate,
        ShipPros_cost: newRate,
        savings: savings,
        savingsPercent: currentRate > 0 ? (savings / currentRate) * 100 : 0,
        analyzedWithAccount: assignedAccount, // Use the account assigned for this service category
        accountName: assignedAccount // Also store as accountName for easier access
      }
    })

    // Format orphaned shipments for centralized storage
    const orphanedShipmentsFormatted = payload.orphanedShipments.map((orphan, index) => {
      // Extract currentRate from original data
      const originalEntry = payload.originalData?.find((orig: any) => 
        orig.shipment?.trackingId === orphan.shipment.trackingId || 
        orig.trackingId === orphan.shipment.trackingId ||
        orig.tracking_id === orphan.shipment.trackingId
      );
      
      const currentRate = originalEntry ? 
        originalEntry.shipment?.currentRate || 
        originalEntry.currentRate || 
        originalEntry.current_rate || 
        originalEntry.cost || 
        originalEntry.rate || 
        originalEntry.amount || 
        originalEntry.price || 0 : 0;

      return {
        id: payload.completedShipments + index + 1,
        trackingId: orphan.shipment.trackingId || `Orphan-${index + 1}`,
        originZip: orphan.shipment.originZip || '',
        destinationZip: orphan.shipment.destZip || '',
        weight: parseFloat(orphan.shipment.weight || '0'),
        length: parseFloat(orphan.shipment.length || '0'),
        width: parseFloat(orphan.shipment.width || '0'),
        height: parseFloat(orphan.shipment.height || '0'),
        dimensions: orphan.shipment.dimensions,
        service: orphan.customer_service || orphan.shipment.service || 'Unknown',
        currentRate: parseFloat(currentRate) || 0,
        error: orphan.error || 'Processing failed',
        errorType: orphan.errorType || 'Unknown',
        errorCategory: 'Processing Error'
      }
    })

    // Prepare processing metadata
    const processingMetadata = {
      savedAt: new Date().toISOString(),
      totalSavings: payload.totalPotentialSavings,
      completedShipments: payload.completedShipments,
      errorShipments: payload.errorShipments,
      totalShipments: payload.totalShipments,
      dataSource: 'finalize_analysis_endpoint'
    }

    // Prepare savings analysis
    const savingsAnalysis = {
      totalCurrentCost: payload.totalCurrentCost,
      totalPotentialSavings: payload.totalPotentialSavings,
      savingsPercentage: payload.totalCurrentCost > 0 ? (payload.totalPotentialSavings / payload.totalCurrentCost) * 100 : 0,
      totalShipments: payload.totalShipments,
      completedShipments: payload.completedShipments,
      errorShipments: payload.errorShipments,
      orphanedShipments: payload.orphanedShipments
    }

    // Create the complete analysis record
    const analysisRecord = {
      user_id: user.id,
      file_name: payload.fileName,
      original_data: payload.originalData,
      carrier_configs_used: payload.carrierConfigsUsed,
      service_mappings: payload.serviceMappings || [],
      ups_quotes: payload.recommendations.map(r => r.allRates || r.upsRates || []),
      savings_analysis: savingsAnalysis,
      recommendations: payload.recommendations,
      processed_shipments: processedShipments,
      orphaned_shipments: orphanedShipmentsFormatted,
      processing_metadata: {
        ...processingMetadata,
        bestOverallAccount: bestOverallAccount,
        accountTotals: accountTotals,
        selectedCarrierConfigs: payload.carrierConfigsUsed
      },
      total_shipments: payload.totalShipments,
      total_savings: payload.totalPotentialSavings,
      status: 'completed'
    }

    console.log('Saving analysis record:', {
      totalShipments: analysisRecord.total_shipments,
      originalDataCount: payload.originalData.length,
      recommendationsCount: payload.recommendations.length,
      orphanedCount: payload.orphanedShipments.length,
      processedShipmentsCount: processedShipments.length
    })

    let data, error

    // If we have an existing incomplete analysis, update it; otherwise insert new
    if (existingAnalyses && existingAnalyses.length > 0) {
      console.log('Updating existing incomplete analysis with ID:', existingAnalyses[0].id)
      
      const result = await supabase
        .from('shipping_analyses')
        .update(analysisRecord)
        .eq('id', existingAnalyses[0].id)
        .select('id')
        .single()
      
      data = result.data
      error = result.error
    } else {
      console.log('Creating new analysis record')
      
      const result = await supabase
        .from('shipping_analyses')
        .insert(analysisRecord)
        .select('id')
        .single()
      
      data = result.data
      error = result.error
    }

    if (error) {
      console.error('Database error:', error)
      throw new Error(`Failed to save analysis: ${error.message}`)
    }

    console.log('Analysis successfully saved with ID:', data.id)

    // Now populate the shipment_rates table for account comparison view
    try {
      const shipmentRatesToInsert = []
      
      // Extract rates from the original data for each shipment
      payload.originalData.forEach((shipmentResult, index) => {
        if (shipmentResult.status === 'completed' && shipmentResult.allRates) {
          shipmentResult.allRates.forEach((rate: any) => {
            shipmentRatesToInsert.push({
              analysis_id: data.id,
              shipment_index: index,
              carrier_config_id: rate.carrierId || '',
              account_name: rate.carrierName || rate.accountName || 'Unknown',
              carrier_type: rate.carrierType || 'ups',
              service_code: rate.serviceCode || '',
              service_name: rate.serviceName || rate.description || '',
              rate_amount: rate.totalCharges || rate.negotiatedRate || rate.rate_amount || 0,
              currency: rate.currency || 'USD',
              transit_days: rate.transitTime || null,
              is_negotiated: rate.rateType === 'negotiated' || rate.hasNegotiatedRates || false,
              published_rate: rate.publishedRate || null,
              shipment_data: shipmentResult.shipment || {}
            })
          })
        }
      })

      if (shipmentRatesToInsert.length > 0) {
        console.log(`Inserting ${shipmentRatesToInsert.length} shipment rates`)
        const { error: ratesError } = await supabase
          .from('shipment_rates')
          .insert(shipmentRatesToInsert)

        if (ratesError) {
          console.error('Error inserting shipment rates:', ratesError)
          // Don't fail the entire operation for this, but log it
        } else {
          console.log('Successfully inserted shipment rates for account comparison')
        }
      }
    } catch (ratesInsertError) {
      console.error('Error during shipment rates insertion:', ratesInsertError)
      // Don't fail the entire operation, just log the error
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        analysisId: data.id,
        message: 'Analysis finalized successfully'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error finalizing analysis:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
