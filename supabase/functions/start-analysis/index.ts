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

interface RateResult {
  carrier_config_id: string;
  account_name: string;
  carrier_type: string;
  service_code: string;
  service_name: string;
  rate_amount: number;
  is_negotiated: boolean;
  source: string;
  rate_response?: any;
  weight_break?: number;
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

    // Load all carrier configs for this user (both rate cards and API accounts)
    const { data: carrierConfigs, error: configError } = await supabase
      .from('carrier_configs')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (configError) {
      throw new Error(`Failed to load carrier configs: ${configError.message}`);
    }

    console.log(`Loaded ${carrierConfigs?.length || 0} carrier configurations`);

    // Separate rate card configs from API configs
    const rateCardConfigs = carrierConfigs?.filter(config => config.is_rate_card) || [];
    const apiConfigs = carrierConfigs?.filter(config => !config.is_rate_card) || [];

    console.log(`Rate card configs: ${rateCardConfigs.length}, API configs: ${apiConfigs.length}`);

    // Load rate card data if we have rate card configs
    let rateCards: any[] = [];
    if (rateCardConfigs.length > 0) {
      const { data: rateCardData, error: rateCardError } = await supabase
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
        .eq('carrier_configs.user_id', userId)
        .in('carrier_config_id', rateCardConfigs.map(c => c.id));

      if (rateCardError) {
        console.error('Error loading rate cards:', rateCardError);
      } else {
        rateCards = rateCardData || [];
        console.log(`Loaded ${rateCards.length} rate card entries`);
      }
    }

    // Process shipments in smaller batches for API calls
    const batchSize = 50;
    let processedCount = 0;

    for (let i = 0; i < shipments.length; i += batchSize) {
      const batch = shipments.slice(i, i + batchSize);
      const shipmentRates: any[] = [];

      console.log(`Processing batch ${Math.floor(i / batchSize) + 1} with ${batch.length} shipments`);

      for (const shipment of batch) {
        try {
          console.log(`Processing shipment ${shipment.id}: ${shipment.customerService}, ${shipment.weight}lbs`);
          
          // Get rates from rate cards
          const rateCardRates = findApplicableRates(shipment, rateCards);
          
          // Get rates from APIs  
          const apiRates = await getApiRates(shipment, apiConfigs, supabase);
          
          // Combine all rates
          const allRates = [...rateCardRates, ...apiRates];
          
          if (allRates.length > 0) {
            // Find the best (cheapest) rate
            const bestRate = allRates.reduce((best, current) => 
              current.rate_amount < best.rate_amount ? current : best
            );
            
            console.log(`Best rate for shipment ${shipment.id}: $${bestRate.rate_amount} from ${bestRate.account_name}`);
            
            shipmentRates.push({
              analysis_id: analysisId,
              shipment_index: shipment.id,
              carrier_config_id: bestRate.carrier_config_id,
              account_name: bestRate.account_name,
              carrier_type: bestRate.carrier_type,
              service_code: bestRate.service_code,
              service_name: bestRate.service_name,
              rate_amount: bestRate.rate_amount,
              is_negotiated: bestRate.is_negotiated || false,
              shipment_data: shipment,
              rate_response: bestRate.rate_response || {
                source: bestRate.source || 'unknown'
              }
            });
          } else {
            console.log(`No rates found for shipment ${shipment.id}`);
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

    // Also update the shipping analysis status
    await supabase
      .from('shipping_analyses')
      .update({ 
        status: 'completed',
        updated_at: new Date().toISOString(),
        processing_metadata: {
          analysis_job_id: jobId,
          completed_at: new Date().toISOString()
        }
      })
      .eq('id', analysisId);

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

function findApplicableRates(shipment: ShipmentData, rateCards: any[]): RateResult[] {
  const applicableRates: RateResult[] = [];
  
  // Normalize customer service for better matching
  const customerService = (shipment.customerService || '').toLowerCase();
  console.log(`Finding rate card rates for shipment ${shipment.id}: ${customerService}, weight: ${shipment.weight}`);
  
  for (const rateCard of rateCards) {
    // Check if weight is within the rate card's weight break
    if (shipment.weight && shipment.weight <= rateCard.weight_break) {
      
      // Improved service matching logic
      let serviceMatches = false;
      const rateCardService = (rateCard.service_code || '').toLowerCase();
      const rateCardName = (rateCard.service_name || '').toLowerCase();
      
      // Direct matches
      if (customerService.includes(rateCardService) || customerService.includes(rateCardName)) {
        serviceMatches = true;
      }
      // Ground service matching
      else if ((customerService.includes('ground') || customerService.includes('standard')) && 
               (rateCardService === 'ground' || rateCardName.includes('ground'))) {
        serviceMatches = true;
      }
      // Express service matching  
      else if (customerService.includes('express') && 
               (rateCardService.includes('express') || rateCardName.includes('express'))) {
        serviceMatches = true;
      }
      // 2-day service matching
      else if ((customerService.includes('2day') || customerService.includes('2 day')) && 
               (rateCardService.includes('2day') || rateCardName.includes('2day'))) {
        serviceMatches = true;
      }
      
      if (serviceMatches) {
        applicableRates.push({
          carrier_config_id: rateCard.carrier_config_id,
          account_name: rateCard.carrier_configs.account_name,
          carrier_type: rateCard.carrier_configs.carrier_type,
          service_code: rateCard.service_code,
          service_name: rateCard.service_name,
          rate_amount: parseFloat(rateCard.rate_amount || '0'),
          is_negotiated: true,
          source: 'rate_card',
          weight_break: rateCard.weight_break,
          zone: rateCard.zone
        });
      }
    }
  }
  
  // Return only the BEST (cheapest) rate card rate
  if (applicableRates.length > 0) {
    const bestRate = applicableRates.reduce((best, current) => 
      current.rate_amount < best.rate_amount ? current : best
    );
    console.log(`Found best rate card rate for shipment ${shipment.id}: $${bestRate.rate_amount} from ${bestRate.account_name}`);
    return [bestRate];
  }
  
  return [];
}

async function getApiRates(shipment: ShipmentData, apiConfigs: any[], supabase: any): Promise<RateResult[]> {
  const apiRates: RateResult[] = [];
  
  console.log(`Getting API rates for shipment ${shipment.id} from ${apiConfigs.length} API configs`);
  
  for (const config of apiConfigs) {
    try {
      if (config.carrier_type === 'ups') {
        const upsRate = await getUpsRate(shipment, config, supabase);
        if (upsRate) apiRates.push(upsRate);
      } else if (config.carrier_type === 'fedex') {
        const fedexRate = await getFedexRate(shipment, config, supabase);
        if (fedexRate) apiRates.push(fedexRate);
      }
    } catch (error) {
      console.error(`Error getting ${config.carrier_type} rate for shipment ${shipment.id}:`, error);
    }
  }
  
  // Return only the best API rate
  if (apiRates.length > 0) {
    const bestRate = apiRates.reduce((best, current) => 
      current.rate_amount < best.rate_amount ? current : best
    );
    console.log(`Found best API rate for shipment ${shipment.id}: $${bestRate.rate_amount} from ${bestRate.account_name}`);
    return [bestRate];
  }
  
  return [];
}

async function getUpsRate(shipment: ShipmentData, config: any, supabase: any): Promise<RateResult | null> {
  try {
    console.log(`Getting UPS rate for shipment ${shipment.id} using account ${config.account_name}`);
    
    // Get authentication token first
    const authResponse = await supabase.functions.invoke('ups-auth', {
      body: {
        action: 'get_token',
        config_id: config.id
      }
    });

    if (authResponse.error) {
      console.error(`UPS auth failed for shipment ${shipment.id}:`, authResponse.error);
      return null;
    }

    const authData = authResponse.data;
    if (!authData || !authData.access_token) {
      console.error(`No auth token received for shipment ${shipment.id}`);
      return null;
    }
    
    // Build proper request structure that matches the UPS rate function
    const upsRequest = {
      shipment: {
        shipFrom: {
          name: 'Shipper',
          address: '123 Main St',
          city: 'Any City',
          state: 'FL',
          zipCode: shipment.originZip,
          country: 'US'
        },
        shipTo: {
          name: 'Recipient',
          address: '123 Main St',
          city: 'Any City', 
          state: 'TX',
          zipCode: shipment.destinationZip,
          country: 'US'
        },
        package: {
          weight: shipment.weight,
          weightUnit: 'LBS',
          length: shipment.length || 12,
          width: shipment.width || 12,
          height: shipment.height || 6,
          dimensionUnit: 'IN',
          packageType: '02'
        },
        serviceTypes: ['03'], // UPS Ground as default
        equivalentServiceCode: '03',
        isResidential: false
      },
      configId: config.id
    };

    console.log(`UPS API request structure for shipment ${shipment.id}:`, upsRequest);

    const response = await supabase.functions.invoke('ups-rate-quote', {
      body: upsRequest
    });

    if (response.error) {
      console.error(`UPS API error for shipment ${shipment.id}:`, response.error);
      return null;
    }

    const data = response.data;
    if (data?.rates && data.rates.length > 0) {
      // Find the best matching service
      const bestRate = data.rates.reduce((best: any, current: any) => 
        current.totalCharges < best.totalCharges ? current : best
      );
      
      return {
        carrier_config_id: config.id,
        account_name: config.account_name,
        carrier_type: 'ups',
        service_code: bestRate.serviceCode || '03',
        service_name: bestRate.serviceName || 'UPS Ground',
        rate_amount: bestRate.totalCharges,
        is_negotiated: bestRate.hasNegotiatedRates || false,
        source: 'ups_api',
        rate_response: bestRate
      };
    }
    
    return null;
  } catch (error) {
    console.error(`Error calling UPS API for shipment ${shipment.id}:`, error);
    return null;
  }
}

async function getFedexRate(shipment: ShipmentData, config: any, supabase: any): Promise<RateResult | null> {
  try {
    console.log(`Getting FedEx rate for shipment ${shipment.id} using account ${config.account_name}`);
    
    // Get authentication token first
    const authResponse = await supabase.functions.invoke('fedex-auth', {
      body: {
        action: 'get_token',
        config_id: config.id
      }
    });

    if (authResponse.error) {
      console.error(`FedEx auth failed for shipment ${shipment.id}:`, authResponse.error);
      return null;
    }

    const authData = authResponse.data;
    if (!authData || !authData.access_token) {
      console.error(`No auth token received for shipment ${shipment.id}`);
      return null;
    }
    
    // Build proper request structure that matches the FedEx rate function
    const fedexRequest = {
      shipment: {
        shipFrom: {
          name: 'Shipper',
          address: '123 Main St',
          city: 'Any City',
          state: 'FL',
          zipCode: shipment.originZip,
          country: 'US'
        },
        shipTo: {
          name: 'Recipient',
          address: '123 Main St',
          city: 'Any City',
          state: 'TX', 
          zipCode: shipment.destinationZip,
          country: 'US'
        },
        package: {
          weight: shipment.weight,
          weightUnit: 'LBS',
          length: shipment.length || 12,
          width: shipment.width || 12,
          height: shipment.height || 6,
          dimensionUnit: 'IN',
          packageType: '02'
        },
        serviceTypes: ['FEDEX_GROUND'], // FedEx Ground as default
        equivalentServiceCode: 'FEDEX_GROUND',
        isResidential: false
      },
      configId: config.id
    };

    console.log(`FedEx API request structure for shipment ${shipment.id}:`, fedexRequest);

    const response = await supabase.functions.invoke('fedex-rate-quote', {
      body: fedexRequest
    });

    if (response.error) {
      console.error(`FedEx API error for shipment ${shipment.id}:`, response.error);
      return null;
    }

    const data = response.data;
    if (data?.rates && data.rates.length > 0) {
      // Find the best matching service
      const bestRate = data.rates.reduce((best: any, current: any) => 
        current.totalCharges < best.totalCharges ? current : best
      );
      
      return {
        carrier_config_id: config.id,
        account_name: config.account_name,
        carrier_type: 'fedex',
        service_code: bestRate.serviceCode || 'FEDEX_GROUND',
        service_name: bestRate.serviceName || 'FedEx Ground',
        rate_amount: bestRate.totalCharges,
        is_negotiated: bestRate.hasAccountRates || false,
        source: 'fedex_api',
        rate_response: bestRate
      };
    }
    
    return null;
  } catch (error) {
    console.error(`Error calling FedEx API for shipment ${shipment.id}:`, error);
    return null;
  }
}