import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BulkAnalysisPayload {
  analysisId: string;
  shipments: any[];
  carrierConfigs: string[];
  serviceMappings: any[];
  columnMappings: any;
  originZipOverride?: string;
  fileName: string;
  chunkIndex?: number;
  totalChunks?: number;
}

interface RateCardData {
  carrier_config_id: string;
  service_code: string;
  service_name: string;
  zone: string;
  weight_break: number;
  rate_amount: number;
  account_name: string;
  carrier_type: string;
}

// Cache for rate card data
let rateCardCache: Map<string, RateCardData[]> = new Map();
let carrierConfigCache: Map<string, any> = new Map();

async function loadRateCardsIntoMemory(carrierConfigIds: string[], supabase: any) {
  console.log('🗂️ Loading rate cards into memory for carriers:', carrierConfigIds);
  
  // Load carrier configs first
  const { data: configs, error: configError } = await supabase
    .from('carrier_configs')
    .select('*')
    .in('id', carrierConfigIds);

  if (configError) {
    console.error('Error loading carrier configs:', configError);
    return;
  }

  // Cache carrier configs
  configs?.forEach(config => {
    carrierConfigCache.set(config.id, config);
  });

  // Load all rate card data for these carriers
  const { data: rateCardData, error: rateError } = await supabase
    .from('rate_card_rates')
    .select(`
      *,
      carrier_configs!inner(account_name, carrier_type)
    `)
    .in('carrier_config_id', carrierConfigIds);

  if (rateError) {
    console.error('Error loading rate card data:', rateError);
    return;
  }

  // Organize rate cards by carrier config ID
  rateCardData?.forEach(rate => {
    const configId = rate.carrier_config_id;
    if (!rateCardCache.has(configId)) {
      rateCardCache.set(configId, []);
    }
    
    rateCardCache.get(configId)!.push({
      carrier_config_id: rate.carrier_config_id,
      service_code: rate.service_code,
      service_name: rate.service_name,
      zone: rate.zone || 'default',
      weight_break: rate.weight_break,
      rate_amount: rate.rate_amount,
      account_name: rate.carrier_configs.account_name,
      carrier_type: rate.carrier_configs.carrier_type
    });
  });

  console.log('✅ Loaded rate cards for', rateCardCache.size, 'carrier configs');
}

function calculateRateCardCost(shipment: any, carrierConfigId: string, serviceCode: string): number | null {
  const rateCards = rateCardCache.get(carrierConfigId);
  if (!rateCards) return null;

  const weight = parseFloat(shipment.weight || '0');
  
  // Use zone if available, otherwise default to 'default' or derive from ZIP codes
  let zone = shipment.zone || 'default';
  
  // If no zone is provided, you might want to compute it from ZIP codes
  // For now, we'll use 'default' as a fallback
  if (!shipment.zone && shipment.originZip && shipment.destZip) {
    // TODO: Implement zone calculation based on ZIP codes
    // For rate cards that use zones, this would need proper zone mapping
    zone = 'default';
  }

  // Find matching rate card
  const matchingRates = rateCards.filter(rate => 
    rate.service_code === serviceCode && 
    rate.zone === zone &&
    weight >= rate.weight_break
  );

  if (matchingRates.length === 0) {
    console.warn(`⚠️ No rate card match for: service=${serviceCode}, zone=${zone}, weight=${weight}, carrierConfig=${carrierConfigId}`);
    return null;
  }

  // Get the rate for the highest weight break that doesn't exceed the shipment weight
  const bestRate = matchingRates
    .sort((a, b) => b.weight_break - a.weight_break)[0];

  return bestRate.rate_amount;
}

async function processBulkRates(shipments: any[], carrierConfigIds: string[], supabase: any): Promise<any[]> {
  console.log(`🚀 Processing ${shipments.length} shipments with ${carrierConfigIds.length} carriers`);
  
  const results = [];
  const CONCURRENCY_LIMIT = 100;
  
  // Pre-load all rate card data into memory
  await loadRateCardsIntoMemory(carrierConfigIds, supabase);
  
  // Determine which carriers are rate-card based vs API-based
  const rateCardCarriers = carrierConfigIds.filter(id => {
    const config = carrierConfigCache.get(id);
    return config?.is_rate_card && rateCardCache.has(id);
  });
  
  const apiCarriers = carrierConfigIds.filter(id => !rateCardCarriers.includes(id));
  
  console.log(`📊 Processing: ${rateCardCarriers.length} rate card carriers, ${apiCarriers.length} API carriers`);

  // Process shipments in chunks for controlled concurrency
  const chunkSize = CONCURRENCY_LIMIT;
  for (let i = 0; i < shipments.length; i += chunkSize) {
    const chunk = shipments.slice(i, i + chunkSize);
    
    const chunkPromises = chunk.map(async (shipment, index) => {
      const globalIndex = i + index;
      
      try {
        const allRates = [];
        
        // Process rate card carriers (instant, in-memory)
        for (const carrierId of rateCardCarriers) {
          const config = carrierConfigCache.get(carrierId);
          if (!config) continue;
          
          // Extract service name from various possible fields
          const serviceName = shipment.service || shipment.customer_service || shipment.Service || 'Ground';
          
          // Map service to carrier-specific service code
          const serviceCode = mapServiceToCarrierCode(serviceName, config.carrier_type);
          if (!serviceCode) {
            console.warn(`⚠️ No service code mapping for service "${serviceName}" and carrier "${config.carrier_type}"`);
            continue;
          }
          
          const cost = calculateRateCardCost(shipment, carrierId, serviceCode);
          if (cost !== null) {
            allRates.push({
              carrierId,
              carrierType: config.carrier_type,
              accountName: config.account_name,
              carrierName: config.account_name,
              serviceCode,
              serviceName: serviceCode,
              rate_amount: cost,
              totalCharges: cost,
              currency: 'USD',
              rateType: 'rate_card',
              transitTime: null
            });
          } else {
            console.warn(`⚠️ No rate found for shipment ${globalIndex} with service "${serviceName}", weight ${shipment.weight}, zone ${shipment.zone || 'default'}`);
          }
        }
        
        // Process API carriers (if any)
        if (apiCarriers.length > 0) {
          try {
            const apiResponse = await supabase.functions.invoke('multi-carrier-quote', {
              body: {
                shipment,
                carrierConfigs: apiCarriers,
                serviceMappings: []
              }
            });
            
            if (apiResponse.data?.success && apiResponse.data.rates) {
              allRates.push(...apiResponse.data.rates);
            }
          } catch (apiError) {
            console.warn(`⚠️ API call failed for shipment ${globalIndex}:`, apiError);
          }
        }
        
        // Calculate best rate and savings
        const currentCost = parseFloat(shipment.currentRate || shipment.current_rate || '0');
        let bestRate = null;
        let savings = 0;
        
        if (allRates.length > 0) {
          bestRate = allRates.reduce((best, rate) => {
            const rateCost = parseFloat(rate.totalCharges || rate.rate_amount || '0');
            const bestCost = parseFloat(best?.totalCharges || best?.rate_amount || '999999');
            return rateCost < bestCost ? rate : best;
          });
          
          const bestCost = parseFloat(bestRate.totalCharges || bestRate.rate_amount || '0');
          savings = currentCost - bestCost;
        }
        
        return {
          shipment,
          status: 'completed',
          currentCost,
          allRates,
          bestRate,
          savings,
          maxSavings: savings,
          originalService: shipment.service
        };
        
      } catch (error) {
        console.error(`❌ Error processing shipment ${globalIndex}:`, error);
        return {
          shipment,
          status: 'error',
          error: error.message,
          currentCost: parseFloat(shipment.currentRate || '0'),
          allRates: [],
          savings: 0
        };
      }
    });
    
    const chunkResults = await Promise.allSettled(chunkPromises);
    const processedResults = chunkResults.map(result => 
      result.status === 'fulfilled' ? result.value : {
        shipment: chunk[chunkResults.indexOf(result)],
        status: 'error',
        error: 'Processing failed',
        allRates: [],
        savings: 0
      }
    );
    
    results.push(...processedResults);
    
    console.log(`✅ Processed chunk ${Math.floor(i / chunkSize) + 1}/${Math.ceil(shipments.length / chunkSize)} (${results.length}/${shipments.length} total)`);
  }
  
  return results;
}

function mapServiceToCarrierCode(serviceName: string, carrierType: string): string | null {
  if (!serviceName) return null;
  
  const service = serviceName.toLowerCase();
  
  // Basic service mapping - expand this based on your service registry
  if (carrierType === 'ups') {
    if (service.includes('ground')) return '03';
    if (service.includes('next day') || service.includes('overnight')) return '01';
    if (service.includes('2 day') || service.includes('2nd day')) return '02';
    return '03'; // Default to ground
  }
  
  if (carrierType === 'fedex') {
    if (service.includes('ground')) return 'FEDEX_GROUND';
    if (service.includes('overnight')) return 'PRIORITY_OVERNIGHT';
    if (service.includes('2 day')) return 'FEDEX_2_DAY';
    return 'FEDEX_GROUND'; // Default to ground
  }
  
  if (carrierType === 'amazon') {
    // Amazon typically only offers ground services
    return 'GROUND';
  }
  
  return null;
}

async function saveResultsInBulk(analysisId: string, results: any[], supabase: any) {
  console.log(`💾 Saving ${results.length} results in bulk for analysis ${analysisId}`);
  
  // Prepare bulk insert data for shipment_rates
  const shipmentRates = [];
  
  results.forEach((result, index) => {
    if (result.allRates && result.allRates.length > 0) {
      result.allRates.forEach(rate => {
        shipmentRates.push({
          analysis_id: analysisId,
          shipment_index: index,
          carrier_config_id: rate.carrierId || '',
          account_name: rate.accountName || rate.carrierName || 'Unknown',
          carrier_type: rate.carrierType || 'ups',
          service_code: rate.serviceCode || '',
          service_name: rate.serviceName || '',
          rate_amount: rate.totalCharges || rate.rate_amount || 0,
          currency: rate.currency || 'USD',
          transit_days: rate.transitTime || null,
          is_negotiated: rate.rateType === 'negotiated',
          published_rate: rate.publishedRate || null,
          shipment_data: result.shipment || {}
        });
      });
    }
  });
  
  // Bulk insert shipment rates
  if (shipmentRates.length > 0) {
    const { error: ratesError } = await supabase
      .from('shipment_rates')
      .insert(shipmentRates);
      
    if (ratesError) {
      console.error('Error inserting shipment rates:', ratesError);
    } else {
      console.log(`✅ Inserted ${shipmentRates.length} shipment rates`);
    }
  }
  
  // Prepare processed shipments data
  const processedShipments = results.map((result, index) => ({
    id: index + 1,
    trackingId: result.shipment.trackingId || `Shipment-${index + 1}`,
    originZip: result.shipment.originZip || '',
    destinationZip: result.shipment.destZip || '',
    weight: parseFloat(result.shipment.weight || '0'),
    currentRate: result.currentCost || 0,
    ShipPros_cost: result.bestRate ? parseFloat(result.bestRate.totalCharges || result.bestRate.rate_amount || '0') : 0,
    savings: result.savings || 0,
    savingsPercent: result.currentCost > 0 ? ((result.savings || 0) / result.currentCost) * 100 : 0,
    customer_service: result.originalService || 'Unknown',
    ShipPros_service: result.bestRate?.serviceName || 'Ground',
    analyzedWithAccount: result.bestRate?.accountName || 'Unknown',
    accountName: result.bestRate?.accountName || 'Unknown'
  }));
  
  // Calculate totals
  const totalSavings = results.reduce((sum, result) => sum + (result.savings || 0), 0);
  const totalCurrentCost = results.reduce((sum, result) => sum + (result.currentCost || 0), 0);
  
  // Update analysis record with final results
  const { error: updateError } = await supabase
    .from('shipping_analyses')
    .update({
      processed_shipments: processedShipments,
      total_savings: totalSavings,
      total_shipments: results.length,
      status: 'completed',
      savings_analysis: {
        totalCurrentCost,
        totalPotentialSavings: totalSavings,
        savingsPercentage: totalCurrentCost > 0 ? (totalSavings / totalCurrentCost) * 100 : 0,
        completedShipments: results.filter(r => r.status === 'completed').length,
        errorShipments: results.filter(r => r.status === 'error').length
      },
      processing_metadata: {
        completedAt: new Date().toISOString(),
        processingMethod: 'bulk_analysis'
      }
    })
    .eq('id', analysisId);
    
  if (updateError) {
    console.error('Error updating analysis:', updateError);
    throw updateError;
  }
  
  console.log(`✅ Updated analysis ${analysisId} with ${results.length} shipments, $${totalSavings.toFixed(2)} total savings`);
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Bulk rate analysis started');
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from JWT token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Invalid authentication');
    }

    const payload: BulkAnalysisPayload = await req.json();
    
    console.log(`📊 Processing ${payload.shipments.length} shipments for analysis ${payload.analysisId}`);
    
    // Process all shipments using in-memory rate cards + controlled API concurrency
    const backgroundProcessing = async () => {
      try {
        const results = await processBulkRates(
          payload.shipments, 
          payload.carrierConfigs, 
          supabase
        );
        
        // Save all results in bulk
        await saveResultsInBulk(payload.analysisId, results, supabase);
        
        console.log(`🎉 Bulk analysis completed successfully for ${payload.analysisId}`);
      } catch (error) {
        console.error('❌ Bulk analysis failed:', error);
        
        // Mark analysis as failed
        await supabase
          .from('shipping_analyses')
          .update({ 
            status: 'failed',
            processing_metadata: {
              error: error.message,
              failedAt: new Date().toISOString()
            }
          })
          .eq('id', payload.analysisId);
      }
    };
    
    // Use EdgeRuntime.waitUntil for background processing
    EdgeRuntime.waitUntil(backgroundProcessing());
    
    // Return immediate response
    return new Response(
      JSON.stringify({ 
        success: true, 
        analysisId: payload.analysisId,
        message: `Started bulk analysis of ${payload.shipments.length} shipments`,
        estimatedTime: Math.ceil(payload.shipments.length / 100) // rough estimate in minutes
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
    
  } catch (error) {
    console.error('❌ Bulk analysis error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});