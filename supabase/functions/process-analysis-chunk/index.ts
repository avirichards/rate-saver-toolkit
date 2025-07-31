import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ChunkPayload {
  chunkIndex: number;
  totalChunks: number;
  analysisId: string;
  recommendations: any[];
  processingType: 'streaming_chunk';
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔧 Process analysis chunk function started');

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

    const payload: ChunkPayload = await req.json()
    
    console.log(`📦 Processing chunk ${payload.chunkIndex + 1}/${payload.totalChunks} with ${payload.recommendations.length} items`);

    // Process recommendations into efficient format
    const processedShipments: any[] = [];
    const shipmentRates: any[] = [];
    
    payload.recommendations.forEach((rec, localIndex) => {
      const globalIndex = payload.chunkIndex * payload.recommendations.length + localIndex;
      
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
        carrier: rec.carrier || 'UPS',
        customer_service: rec.customer_service || rec.shipment.service || 'Unknown',
        ShipPros_service: bestRate.serviceName || bestRate.description || 'Ground',
        currentRate: currentRate,
        ShipPros_cost: newRate,
        savings: savings,
        savingsPercent: currentRate > 0 ? (savings / currentRate) * 100 : 0,
        analyzedWithAccount: bestRate.carrierName || bestRate.accountName || 'Unknown',
        accountName: bestRate.carrierName || bestRate.accountName || 'Unknown'
      });
      
      // Create shipment rates for detailed comparison
      rec.allRates.forEach((rate: any) => {
        shipmentRates.push({
          analysis_id: payload.analysisId,
          shipment_index: globalIndex,
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
    });

    console.log(`📊 Processed ${processedShipments.length} shipments with ${shipmentRates.length} rates`);

    // Insert processed shipments in batches to avoid memory issues
    const BATCH_SIZE = 500;
    
    if (processedShipments.length > 0) {
      for (let i = 0; i < processedShipments.length; i += BATCH_SIZE) {
        const batch = processedShipments.slice(i, i + BATCH_SIZE);
        
        const { error: shipmentError } = await supabase
          .from('processed_shipments')
          .insert(batch.map(shipment => ({
            ...shipment,
            analysis_id: payload.analysisId
          })));

        if (shipmentError) {
          console.error('Error inserting processed shipments batch:', shipmentError);
          throw new Error(`Failed to insert processed shipments: ${shipmentError.message}`);
        }
      }
    }

    // Insert shipment rates in batches
    if (shipmentRates.length > 0) {
      for (let i = 0; i < shipmentRates.length; i += BATCH_SIZE) {
        const batch = shipmentRates.slice(i, i + BATCH_SIZE);
        
        const { error: ratesError } = await supabase
          .from('shipment_rates')
          .insert(batch);

        if (ratesError) {
          console.error('Error inserting shipment rates batch:', ratesError);
          // Don't fail the entire operation for rates insertion
        }
      }
    }

    // Update analysis record with chunk progress
    const { error: updateError } = await supabase
      .from('shipping_analyses')
      .update({
        processing_metadata: {
          processingType: 'streaming',
          processedChunks: payload.chunkIndex + 1,
          totalChunks: payload.totalChunks,
          lastChunkProcessed: new Date().toISOString()
        }
      })
      .eq('id', payload.analysisId);

    if (updateError) {
      console.error('Error updating analysis progress:', updateError);
    }

    console.log(`✅ Chunk ${payload.chunkIndex + 1}/${payload.totalChunks} processed successfully`);

    return new Response(
      JSON.stringify({ 
        success: true,
        chunkIndex: payload.chunkIndex,
        totalChunks: payload.totalChunks,
        processedShipments: processedShipments.length,
        message: `Chunk ${payload.chunkIndex + 1}/${payload.totalChunks} processed successfully`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing chunk:', error);
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