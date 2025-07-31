import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface BulkAnalysisRequest {
  shipments: any[];
  carrierConfigIds: string[];
  fileName: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Bulk rate analysis function started');
    const startTime = performance.now();

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

    const payload: BulkAnalysisRequest = await req.json()
    console.log(`📊 Processing ${payload.shipments.length} shipments with ${payload.carrierConfigIds.length} carriers`);

    // Get all carrier configs and rate cards in one query
    const { data: carrierConfigs, error: configError } = await supabase
      .from('carrier_configs')
      .select(`
        *,
        rate_cards (
          id,
          service_code,
          service_name,
          zone,
          weight_break,
          rate,
          fuel_surcharge_percent,
          residential_surcharge,
          delivery_area_surcharge
        )
      `)
      .eq('user_id', user.id)
      .in('id', payload.carrierConfigIds)
      .eq('is_active', true);

    if (configError || !carrierConfigs) {
      throw new Error(`Failed to load carrier configs: ${configError?.message}`);
    }

    console.log(`📋 Loaded ${carrierConfigs.length} carrier configs with rate cards`);

    // Create analysis record
    const { data: analysis, error: analysisError } = await supabase
      .from('shipping_analyses')
      .insert({
        user_id: user.id,
        file_name: payload.fileName,
        original_data: payload.shipments,
        total_shipments: payload.shipments.length,
        status: 'processing',
        carrier_configs_used: payload.carrierConfigIds
      })
      .select('id')
      .single();

    if (analysisError || !analysis) {
      throw new Error(`Failed to create analysis: ${analysisError?.message}`);
    }

    // Process all shipments in memory
    const processedShipments: any[] = [];
    const shipmentRates: any[] = [];
    let totalCurrentCost = 0;
    let totalSavings = 0;
    let completedCount = 0;
    let errorCount = 0;

    console.log('🔄 Starting bulk processing...');

    for (let i = 0; i < payload.shipments.length; i++) {
      const shipment = payload.shipments[i];
      
      try {
        const originZip = shipment.originZip || shipment.origin_zip || '';
        const destZip = shipment.destinationZip || shipment.dest_zip || shipment.destZip || '';
        const weight = parseFloat(shipment.weight || '1');
        const currentRate = parseFloat(shipment.currentRate || shipment.cost || '0');
        
        // Find best rate across all carriers
        let bestRate: any = null;
        let bestCost = Infinity;
        const allRates: any[] = [];

        for (const config of carrierConfigs) {
          if (!config.rate_cards || config.rate_cards.length === 0) continue;

          // Calculate dimensional weight
          const length = parseFloat(shipment.length || '12');
          const width = parseFloat(shipment.width || '12'); 
          const height = parseFloat(shipment.height || '12');
          const dimWeight = (length * width * height) / 139; // UPS/FedEx factor
          const billableWeight = Math.max(weight, dimWeight);

          // Get zone from shipment data (should be pre-calculated)
          const zone = shipment.zone || '2';

          // Find matching rate card entry
          const rateCard = config.rate_cards.find((card: any) => 
            card.service_code === 'GROUND' && 
            card.zone === zone &&
            billableWeight <= card.weight_break
          );

          if (rateCard) {
            const baseRate = parseFloat(rateCard.rate || '0');
            const fuelSurcharge = baseRate * (parseFloat(rateCard.fuel_surcharge_percent || '0') / 100);
            const totalCost = baseRate + fuelSurcharge;

            const rate = {
              serviceCode: rateCard.service_code,
              serviceName: rateCard.service_name || `${config.account_name} Ground`,
              totalCharges: totalCost.toFixed(2),
              currency: 'USD',
              carrierId: config.id,
              carrierName: config.account_name,
              carrierType: config.carrier_type,
              source: 'rate_card',
              zone: zone,
              weightBreak: rateCard.weight_break,
              baseRate: baseRate,
              fuelSurcharge: fuelSurcharge,
              billableWeight: billableWeight.toFixed(1)
            };

            allRates.push(rate);

            if (totalCost < bestCost) {
              bestCost = totalCost;
              bestRate = rate;
            }
          }
        }

        if (bestRate) {
          const savings = currentRate - bestCost;
          
          // Add to processed shipments
          processedShipments.push({
            id: i + 1,
            analysis_id: analysis.id,
            trackingId: shipment.trackingId || `Shipment-${i + 1}`,
            originZip: originZip,
            destinationZip: destZip,
            weight: weight,
            length: parseFloat(shipment.length || '0'),
            width: parseFloat(shipment.width || '0'),
            height: parseFloat(shipment.height || '0'),
            dimensions: `${shipment.length || 0}x${shipment.width || 0}x${shipment.height || 0}`,
            carrier: 'multi-carrier',
            customer_service: shipment.service || 'Ground',
            shippros_service: bestRate.serviceName,
            currentRate: currentRate,
            shippros_cost: bestCost,
            savings: savings,
            savingsPercent: currentRate > 0 ? (savings / currentRate) * 100 : 0,
            analyzedWithAccount: bestRate.carrierName,
            accountName: bestRate.carrierName
          });

          // Add all rates for this shipment
          allRates.forEach(rate => {
            shipmentRates.push({
              analysis_id: analysis.id,
              shipment_index: i,
              carrier_config_id: rate.carrierId,
              account_name: rate.carrierName,
              carrier_type: rate.carrierType,
              service_code: rate.serviceCode,
              service_name: rate.serviceName,
              rate_amount: parseFloat(rate.totalCharges),
              currency: rate.currency,
              is_negotiated: false,
              shipment_data: shipment
            });
          });

          totalCurrentCost += currentRate;
          totalSavings += savings;
          completedCount++;
        } else {
          errorCount++;
        }

      } catch (error) {
        console.error(`Error processing shipment ${i}:`, error);
        errorCount++;
      }

      // Log progress every 1000 shipments
      if ((i + 1) % 1000 === 0) {
        console.log(`📊 Processed ${i + 1}/${payload.shipments.length} shipments`);
      }
    }

    console.log(`📊 Bulk processing complete: ${completedCount} successful, ${errorCount} errors`);

    // Bulk insert processed shipments (in batches to avoid limits)
    const BATCH_SIZE = 1000;
    
    if (processedShipments.length > 0) {
      for (let i = 0; i < processedShipments.length; i += BATCH_SIZE) {
        const batch = processedShipments.slice(i, i + BATCH_SIZE);
        const { error: shipmentError } = await supabase
          .from('processed_shipments')
          .insert(batch);

        if (shipmentError) {
          console.error('Error inserting processed shipments batch:', shipmentError);
        }
      }
    }

    // Bulk insert shipment rates
    if (shipmentRates.length > 0) {
      for (let i = 0; i < shipmentRates.length; i += BATCH_SIZE) {
        const batch = shipmentRates.slice(i, i + BATCH_SIZE);
        const { error: ratesError } = await supabase
          .from('shipment_rates')
          .insert(batch);

        if (ratesError) {
          console.error('Error inserting shipment rates batch:', ratesError);
        }
      }
    }

    // Update analysis with final results
    const { error: updateError } = await supabase
      .from('shipping_analyses')
      .update({
        status: 'completed',
        total_savings: totalSavings,
        savings_analysis: {
          totalCurrentCost: totalCurrentCost,
          totalPotentialSavings: totalSavings,
          savingsPercentage: totalCurrentCost > 0 ? (totalSavings / totalCurrentCost) * 100 : 0,
          totalShipments: payload.shipments.length,
          completedShipments: completedCount,
          errorShipments: errorCount
        }
      })
      .eq('id', analysis.id);

    if (updateError) {
      console.error('Error updating analysis:', updateError);
    }

    const processingTime = performance.now() - startTime;
    console.log(`✅ Bulk analysis complete in ${processingTime.toFixed(2)}ms for ${payload.shipments.length} shipments`);

    return new Response(
      JSON.stringify({ 
        success: true,
        analysisId: analysis.id,
        processedShipments: completedCount,
        errorShipments: errorCount,
        totalSavings: totalSavings,
        processingTimeMs: processingTime
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Bulk analysis error:', error);
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