import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ShipmentRequest {
  shipFrom: {
    name: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  shipTo: {
    name: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  package: {
    weight: number;
    weightUnit: string;
    length?: number;
    width?: number;
    height?: number;
    dimensionUnit?: string;
    packageType?: string;
  };
  carrierConfigIds: string[];
  serviceTypes?: string[];
  isResidential?: boolean;
  analysisId?: string; // For saving individual rates
  shipmentIndex?: number; // For saving individual rates
}

interface CarrierConfig {
  id: string;
  carrier_type: 'ups' | 'fedex' | 'dhl' | 'usps';
  account_name: string;
  is_sandbox: boolean;
  ups_client_id?: string;
  ups_client_secret?: string;
  ups_account_number?: string;
  fedex_account_number?: string;
  fedex_meter_number?: string;
  fedex_key?: string;
  fedex_password?: string;
  enabled_services?: string[]; // For service filtering
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { shipment }: { shipment: ShipmentRequest } = await req.json();

    if (!shipment.carrierConfigIds || shipment.carrierConfigIds.length === 0) {
      return new Response(JSON.stringify({ error: 'No carrier configurations specified' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('🚚 MULTI-CARRIER QUOTE REQUEST:', {
      carrierConfigCount: shipment.carrierConfigIds.length,
      carrierConfigs: shipment.carrierConfigIds,
      shipFromZip: shipment.shipFrom.zipCode,
      shipToZip: shipment.shipTo.zipCode,
      weight: shipment.package.weight,
      serviceTypes: shipment.serviceTypes
    });

    // API monitoring metrics for tracking performance issues
    const apiMetrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      rateLimitErrors: 0,
      timeoutErrors: 0,
      authErrors: 0,
      averageResponseTime: 0,
      startTime: Date.now()
    };

    // Get carrier configurations for the user
    const { data: carrierConfigs, error: configError } = await supabase
      .from('carrier_configs')
      .select('*')
      .eq('user_id', user.id)
      .in('id', shipment.carrierConfigIds)
      .eq('is_active', true);

    if (configError || !carrierConfigs || carrierConfigs.length === 0) {
      return new Response(JSON.stringify({ error: 'No valid carrier configurations found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const allRates: any[] = [];
    const carrierResults: any[] = [];

    // Process each carrier configuration
    for (const config of carrierConfigs as CarrierConfig[]) {
      const requestStart = Date.now();
      apiMetrics.totalRequests++;
      
      try {
        console.log(`📦 Processing carrier: ${config.carrier_type} (${config.account_name})`);
        
        // Filter service types based on enabled services in carrier config
        let servicesToRequest = shipment.serviceTypes || [];
        if (config.enabled_services && config.enabled_services.length > 0) {
          servicesToRequest = servicesToRequest.filter(service => 
            config.enabled_services!.includes(service)
          );
          console.log(`🔧 Filtered services for ${config.account_name}:`, {
            original: shipment.serviceTypes,
            filtered: servicesToRequest,
            enabledServices: config.enabled_services
          });
        }

        // Skip if no services are enabled for this carrier
        if (servicesToRequest.length === 0) {
          console.log(`⏭️ Skipping ${config.account_name}: No enabled services`);
          carrierResults.push({
            carrierId: config.id,
            carrierName: config.account_name,
            carrierType: config.carrier_type,
            success: false,
            error: 'No enabled services for this carrier',
            rates: []
          });
          continue;
        }
        
        let rates: any[] = [];
        
        if (config.carrier_type === 'ups') {
          rates = await getUpsRates(supabase, shipment, config, servicesToRequest);
        } else if (config.carrier_type === 'fedex') {
          rates = await getFedexRates(supabase, shipment, config, servicesToRequest);
        } else if (config.carrier_type === 'dhl') {
          rates = await getDhlRates(supabase, shipment, config, servicesToRequest);
        } else if (config.carrier_type === 'usps') {
          rates = await getUspsRates(supabase, shipment, config, servicesToRequest);
        }

        if (rates.length > 0) {
          // Add carrier information to each rate
          const carrierRates = rates.map(rate => ({
            ...rate,
            carrierId: config.id,
            carrierName: config.account_name,
            carrierType: config.carrier_type,
            isSandbox: config.is_sandbox
          }));

          // Save individual rates to database if analysisId and shipmentIndex provided
          if (shipment.analysisId && shipment.shipmentIndex !== undefined) {
            await saveShipmentRates(supabase, shipment, config, carrierRates);
          }

          allRates.push(...carrierRates);
          carrierResults.push({
            carrierId: config.id,
            carrierName: config.account_name,
            carrierType: config.carrier_type,
            success: true,
            rateCount: rates.length,
            rates: carrierRates
          });
          
          // Track successful request
          apiMetrics.successfulRequests++;
          const responseTime = Date.now() - requestStart;
          apiMetrics.averageResponseTime = (apiMetrics.averageResponseTime * (apiMetrics.successfulRequests - 1) + responseTime) / apiMetrics.successfulRequests;
          
        } else {
          carrierResults.push({
            carrierId: config.id,
            carrierName: config.account_name,
            carrierType: config.carrier_type,
            success: false,
            error: 'No rates returned',
            rates: []
          });
        }

      } catch (error: any) {
        console.error(`❌ Error getting rates for ${config.carrier_type}:`, error);
        
        // Track failed request and categorize error
        apiMetrics.failedRequests++;
        const errorMessage = error.message || 'Unknown error';
        
        if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
          apiMetrics.rateLimitErrors++;
          console.log('🚨 RATE LIMIT ERROR detected');
        } else if (errorMessage.includes('timeout') || errorMessage.includes('ECONNRESET')) {
          apiMetrics.timeoutErrors++;
          console.log('⏰ TIMEOUT ERROR detected');
        } else if (errorMessage.includes('auth') || errorMessage.includes('401') || errorMessage.includes('403')) {
          apiMetrics.authErrors++;
          console.log('🔐 AUTH ERROR detected');
        }
        
        carrierResults.push({
          carrierId: config.id,
          carrierName: config.account_name,
          carrierType: config.carrier_type,
          success: false,
          error: errorMessage,
          rates: []
        });
      }
    }

    // Find best rates by service type
    const bestRates = findBestRatesByService(allRates);

  // Log comprehensive API monitoring metrics
  const totalTime = Date.now() - apiMetrics.startTime;
  console.log('📊 MULTI-CARRIER RESULTS:', {
    totalCarriers: carrierConfigs.length,
    successfulCarriers: carrierResults.filter(r => r.success).length,
    totalRates: allRates.length,
    bestRatesCount: bestRates.length
  });
  
  console.log('📈 API PERFORMANCE METRICS:', {
    totalRequests: apiMetrics.totalRequests,
    successfulRequests: apiMetrics.successfulRequests,
    failedRequests: apiMetrics.failedRequests,
    successRate: `${((apiMetrics.successfulRequests / apiMetrics.totalRequests) * 100).toFixed(1)}%`,
    rateLimitErrors: apiMetrics.rateLimitErrors,
    timeoutErrors: apiMetrics.timeoutErrors,
    authErrors: apiMetrics.authErrors,
    averageResponseTime: `${apiMetrics.averageResponseTime.toFixed(0)}ms`,
    totalProcessingTime: `${totalTime}ms`,
    requestsPerSecond: (apiMetrics.totalRequests / (totalTime / 1000)).toFixed(2)
  });

    return new Response(JSON.stringify({
      success: true,
      carrierResults,
      allRates,
      bestRates,
      summary: {
        totalCarriers: carrierConfigs.length,
        successfulCarriers: carrierResults.filter(r => r.success).length,
        totalRates: allRates.length,
        bestRatesCount: bestRates.length
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('❌ Multi-carrier quote error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function getUpsRates(supabase: any, shipment: ShipmentRequest, config: CarrierConfig, serviceTypes?: string[]) {
  console.log('📦 Getting UPS rates...');
  
  // Call existing UPS rate quote function
  const { data, error } = await supabase.functions.invoke('ups-rate-quote', {
    body: { 
      shipment: {
        ...shipment,
        serviceTypes: serviceTypes || shipment.serviceTypes
      },
      configId: config.id // Pass specific config ID for this carrier
    }
  });

  if (error) {
    console.error('UPS rate error:', error);
    throw new Error(`UPS rate error: ${error.message}`);
  }

  return data?.rates || [];
}

async function getFedexRates(supabase: any, shipment: ShipmentRequest, config: CarrierConfig, serviceTypes?: string[]) {
  console.log('🚚 Getting FedEx rates... (placeholder)');
  
  // TODO: Implement FedEx API integration
  // For now, return empty array
  return [];
}

async function getDhlRates(supabase: any, shipment: ShipmentRequest, config: CarrierConfig, serviceTypes?: string[]) {
  console.log('✈️ Getting DHL rates... (placeholder)');
  
  // TODO: Implement DHL API integration
  // For now, return empty array
  return [];
}

async function getUspsRates(supabase: any, shipment: ShipmentRequest, config: CarrierConfig, serviceTypes?: string[]) {
  console.log('📮 Getting USPS rates... (placeholder)');
  
  // TODO: Implement USPS API integration
  // For now, return empty array
  return [];
}

async function saveShipmentRates(supabase: any, shipment: ShipmentRequest, config: CarrierConfig, rates: any[]) {
  try {
    console.log(`💾 Saving ${rates.length} rates for shipment ${shipment.shipmentIndex} from ${config.account_name}`);
    
    const rateRecords = rates.map(rate => ({
      analysis_id: shipment.analysisId,
      shipment_index: shipment.shipmentIndex,
      carrier_config_id: config.id,
      account_name: config.account_name,
      carrier_type: config.carrier_type,
      service_code: rate.serviceCode || rate.service_code || 'UNKNOWN',
      service_name: rate.serviceName || rate.service_name || rate.description || null,
      rate_amount: parseFloat(rate.totalCharges || rate.rate_amount || rate.cost || 0),
      currency: rate.currency || 'USD',
      transit_days: rate.transitDays || rate.transit_days || null,
      is_negotiated: rate.negotiatedRate ? true : false,
      published_rate: rate.publishedRate ? parseFloat(rate.publishedRate) : null,
      shipment_data: {
        shipFrom: shipment.shipFrom,
        shipTo: shipment.shipTo,
        package: shipment.package,
        isResidential: shipment.isResidential
      },
      rate_response: rate
    }));

    const { error } = await supabase
      .from('shipment_rates')
      .insert(rateRecords);

    if (error) {
      console.error('Error saving shipment rates:', error);
    } else {
      console.log(`✅ Successfully saved ${rateRecords.length} rates for shipment ${shipment.shipmentIndex}`);
    }
  } catch (error) {
    console.error('Error in saveShipmentRates:', error);
  }
}

function findBestRatesByService(allRates: any[]) {
  if (!allRates || allRates.length === 0) return [];

  // Group rates by service type/category
  const ratesByService: { [key: string]: any[] } = {};
  
  allRates.forEach(rate => {
    const serviceKey = rate.serviceName || rate.serviceCode || 'Unknown';
    if (!ratesByService[serviceKey]) {
      ratesByService[serviceKey] = [];
    }
    ratesByService[serviceKey].push(rate);
  });

  // Find lowest cost rate for each service type
  const bestRates: any[] = [];
  
  Object.entries(ratesByService).forEach(([serviceType, rates]) => {
    const sortedRates = rates.sort((a, b) => 
      (a.totalCharges || 0) - (b.totalCharges || 0)
    );
    
    if (sortedRates.length > 0) {
      bestRates.push({
        ...sortedRates[0],
        isBestRate: true,
        serviceType,
        competitorCount: sortedRates.length - 1
      });
    }
  });

  return bestRates.sort((a, b) => (a.totalCharges || 0) - (b.totalCharges || 0));
}