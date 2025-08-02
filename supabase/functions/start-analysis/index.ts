import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ShipmentData {
  id: number;
  trackingId?: string;
  originZip: string;
  destinationZip: string;
  weight: number;
  length?: number;
  width?: number;
  height?: number;
  customerService: string;
  currentRate?: number;
  carrier?: string;
  [key: string]: any;
}

interface RateCardRate {
  carrier_config_id: string;
  account_name: string;
  service_code: string;
  service_name: string;
  weight_break: number;
  rate_amount: number;
  zone?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get the user from the auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: corsHeaders }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authorization token' }),
        { status: 401, headers: corsHeaders }
      );
    }

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: corsHeaders }
      );
    }

    const { shipments } = await req.json();
    
    if (!shipments || !Array.isArray(shipments)) {
      return new Response(
        JSON.stringify({ error: 'Invalid shipments data' }),
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`Starting analysis for ${shipments.length} shipments for user ${user.id}`);

    // Create analysis job
    const { data: job, error: jobError } = await supabase
      .from('analysis_jobs')
      .insert({
        user_id: user.id,
        total_shipments: shipments.length,
        status: 'pending'
      })
      .select()
      .single();

    if (jobError || !job) {
      console.error('Error creating analysis job:', jobError);
      return new Response(
        JSON.stringify({ error: 'Failed to create analysis job' }),
        { status: 500, headers: corsHeaders }
      );
    }

    console.log(`Created analysis job ${job.id}`);

    // Return immediately with job ID - ensure proper format
    const response = new Response(
      JSON.stringify({ jobId: job.id }),
      { 
        status: 202, 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );

    // Start background processing
    EdgeRuntime.waitUntil(processAnalysisInBackground(supabase, job.id, user.id, shipments));

    return response;

  } catch (error) {
    console.error('Error in start-analysis function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    );
  }
});

async function processAnalysisInBackground(
  supabase: any,
  jobId: string,
  userId: string,
  shipments: ShipmentData[]
) {
  try {
    console.log(`Starting background processing for job ${jobId}`);

    // Create a shipping analysis record for compatibility with existing foreign keys
    const { data: shippingAnalysis, error: analysisError } = await supabase
      .from('shipping_analyses')
      .insert({
        user_id: userId,
        file_name: 'Background Analysis',
        total_shipments: shipments.length,
        status: 'processing',
        original_data: { job_id: jobId, shipments_sample: shipments.slice(0, 3) },
        processing_metadata: {
          analysis_job_id: jobId,
          started_at: new Date().toISOString()
        }
      })
      .select()
      .single();

    if (analysisError || !shippingAnalysis) {
      console.error('Failed to create shipping analysis record:', analysisError);
      throw new Error('Failed to create analysis record');
    }

    const analysisId = shippingAnalysis.id;
    console.log(`Created shipping analysis record: ${analysisId}`);

    // Update job status to in_progress
    await supabase
      .from('analysis_jobs')
      .update({ status: 'in_progress' })
      .eq('id', jobId);

    // Load all rate card data once
    const { data: rateCards, error: rateCardError } = await supabase
      .from('rate_card_rates')
      .select(`
        *,
        carrier_configs!inner(
          id,
          account_name,
          carrier_type,
          user_id
        )
      `)
      .eq('carrier_configs.user_id', userId);

    if (rateCardError) {
      throw new Error(`Failed to load rate cards: ${rateCardError.message}`);
    }

    console.log(`Loaded ${rateCards?.length || 0} rate card entries`);

    // Process shipments in batches of 1000
    const batchSize = 1000;
    let processedCount = 0;

    for (let i = 0; i < shipments.length; i += batchSize) {
      const batch = shipments.slice(i, i + batchSize);
      const shipmentRates: any[] = [];

      console.log(`Processing batch ${Math.floor(i / batchSize) + 1} with ${batch.length} shipments`);

      for (const shipment of batch) {
        try {
          // Find applicable rate cards for this shipment
          const applicableRates = findApplicableRates(shipment, rateCards || []);
          
          for (const rate of applicableRates) {
            shipmentRates.push({
              analysis_id: analysisId, // Use shipping_analyses.id for foreign key compatibility
              shipment_index: shipment.id,
              carrier_config_id: rate.carrier_config_id,
              account_name: rate.account_name,
              carrier_type: rate.carrier_type,
              service_code: rate.service_code,
              service_name: rate.service_name,
              rate_amount: rate.rate_amount,
              is_negotiated: true,
              shipment_data: shipment,
              rate_response: {
                source: 'rate_card',
                weight_break: rate.weight_break,
                zone: rate.zone
              }
            });
          }
        } catch (error) {
          console.error(`Error processing shipment ${shipment.id}:`, error);
        }
      }

      // Bulk insert shipment rates
      if (shipmentRates.length > 0) {
        const { error: insertError } = await supabase
          .from('shipment_rates')
          .insert(shipmentRates);

        if (insertError) {
          console.error('Error inserting shipment rates:', insertError);
        } else {
          console.log(`Inserted ${shipmentRates.length} rates for batch`);
        }
      }

      processedCount += batch.length;

      // Update progress
      await supabase
        .from('analysis_jobs')
        .update({ processed_shipments: processedCount })
        .eq('id', jobId);

      console.log(`Progress: ${processedCount}/${shipments.length} shipments processed`);
    }

    // Mark job as completed
    await supabase
      .from('analysis_jobs')
      .update({ 
        status: 'completed',
        processed_shipments: shipments.length,
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);

    console.log(`Analysis job ${jobId} completed successfully`);

  } catch (error) {
    console.error(`Error in background processing for job ${jobId}:`, error);
    
    // Mark job as failed
    await supabase
      .from('analysis_jobs')
      .update({ 
        status: 'failed',
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);
  }
}

function findApplicableRates(shipment: ShipmentData, rateCards: any[]): any[] {
  const applicableRates: any[] = [];
  
  for (const rateCard of rateCards) {
    // Check if weight is within the rate card's weight break
    if (shipment.weight && shipment.weight <= rateCard.weight_break) {
      // More flexible service matching - normalize service names for comparison
      const customerService = (shipment.customerService || '').toLowerCase().replace(/[\s-]/g, '');
      const rateCardServiceCode = (rateCard.service_code || '').toLowerCase().replace(/[\s-]/g, '');
      const rateCardServiceName = (rateCard.service_name || '').toLowerCase().replace(/[\s-]/g, '');
      
      // Check for service matches with more flexible matching
      const serviceMatches = 
        customerService.includes('ground') && (rateCardServiceCode.includes('ground') || rateCardServiceName.includes('ground')) ||
        customerService.includes('express') && (rateCardServiceCode.includes('express') || rateCardServiceName.includes('express')) ||
        customerService.includes('2day') && (rateCardServiceCode.includes('2day') || rateCardServiceName.includes('2day')) ||
        customerService.includes('nextday') && (rateCardServiceCode.includes('nextday') || rateCardServiceName.includes('nextday')) ||
        customerService === rateCardServiceCode ||
        customerService === rateCardServiceName;
      
      if (serviceMatches) {
        applicableRates.push({
          carrier_config_id: rateCard.carrier_config_id,
          account_name: rateCard.carrier_configs.account_name,
          carrier_type: rateCard.carrier_configs.carrier_type,
          service_code: rateCard.service_code,
          service_name: rateCard.service_name,
          rate_amount: rateCard.rate_amount,
          weight_break: rateCard.weight_break,
          zone: rateCard.zone
        });
      }
    }
  }
  
  return applicableRates;
}