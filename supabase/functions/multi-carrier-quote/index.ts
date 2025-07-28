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
  zone?: string; // CSV-mapped zone data
}

interface CarrierConfig {
  id: string;
  carrier_type: 'ups' | 'fedex' | 'dhl' | 'usps' | 'amazon';
  account_name: string;
  is_sandbox: boolean;
  is_rate_card?: boolean;
  dimensional_divisor?: number;
  fuel_surcharge_percent?: number;
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
      serviceTypes: shipment.serviceTypes,
      csvMappedZone: shipment.zone
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
        
        // Convert universal service categories to carrier-specific codes
        let servicesToRequest = shipment.serviceTypes || [];
        
        // If service codes are provided, convert them to carrier-specific codes
        if (servicesToRequest.length > 0) {
          const carrierType = config.carrier_type.toUpperCase();
          
          // Map service codes to carrier-specific codes
          servicesToRequest = servicesToRequest.map(serviceType => {
            // If it's already a carrier-specific code for this carrier, use it
            if ((carrierType === 'UPS' && serviceType.length <= 3 && /^\d+$/.test(serviceType)) ||
                (carrierType === 'FEDEX' && serviceType.includes('_')) ||
                (carrierType === 'DHL' && serviceType.includes('_')) ||
                (carrierType === 'AMAZON' && serviceType === 'GROUND')) {
              return serviceType;
            }
            
            // Convert UPS service codes to other carriers
            const serviceCodeMapping: Record<string, Record<string, string>> = {
              'UPS': {
                '01': '01', '13': '13', '14': '14', '02': '02', '59': '59',
                '12': '12', '03': '03', '07': '07', '08': '08', '11': '11', '65': '65'
              },
              'FEDEX': {
                '01': 'PRIORITY_OVERNIGHT',
                '13': 'STANDARD_OVERNIGHT',
                '14': 'FIRST_OVERNIGHT',
                '02': 'FEDEX_2_DAY',
                '59': 'FEDEX_2_DAY_AM',
                '12': 'FEDEX_EXPRESS_SAVER',
                '03': 'FEDEX_GROUND',
                '07': 'INTERNATIONAL_PRIORITY',
                '08': 'INTERNATIONAL_ECONOMY'
              },
              'AMAZON': {
                '01': 'GROUND', // Map overnight to ground for Amazon
                '13': 'GROUND', // Map overnight saver to ground for Amazon
                '14': 'GROUND', // Map overnight early to ground for Amazon
                '02': 'GROUND', // Map 2-day to ground for Amazon
                '59': 'GROUND', // Map 2-day AM to ground for Amazon
                '12': 'GROUND', // Map 3-day to ground for Amazon
                '03': 'GROUND'  // Map ground to ground for Amazon
              },
              'DHL': {
                '01': 'EXPRESS_10_30',
                '14': 'EXPRESS_9_00',
                '02': 'EXPRESS_12_00',
                '07': 'EXPRESS_WORLDWIDE',
                '08': 'EXPRESS_EASY'
              }
            };
            
            return serviceCodeMapping[carrierType]?.[serviceType] || serviceType;
          }).filter(Boolean);
        }
        
        // Filter service types based on enabled services in carrier config
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
        
        // Check if this is a rate card configuration
        if (config.is_rate_card) {
          console.log(`📋 Using rate card for ${config.account_name}`);
          rates = await calculateRateCardRate(supabase, shipment, config, servicesToRequest);
        } else if (config.carrier_type === 'ups') {
          rates = await getUpsRates(supabase, shipment, config, servicesToRequest);
        } else if (config.carrier_type === 'fedex') {
          rates = await getFedexRates(supabase, shipment, config, servicesToRequest);
        } else if (config.carrier_type === 'dhl') {
          rates = await getDhlRates(supabase, shipment, config, servicesToRequest);
        } else if (config.carrier_type === 'usps') {
          rates = await getUspsRates(supabase, shipment, config, servicesToRequest);
        } else if (config.carrier_type === 'amazon') {
          // Amazon could be either API or rate card based
          if (config.is_rate_card) {
            rates = await calculateRateCardRate(supabase, shipment, config, servicesToRequest);
          } else {
            rates = await getAmazonRates(supabase, shipment, config, servicesToRequest);
          }
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

async function getAmazonRates(supabase: any, shipment: ShipmentRequest, config: CarrierConfig, serviceTypes?: string[]) {
  console.log('📦 Getting Amazon rates... (placeholder)');
  
  // TODO: Implement Amazon API integration
  // For now, return empty array
  return [];
}

// Zone mapping from zip codes - based on existing Results.tsx logic
function calculateShippingZone(originZip: string, destZip: string): string {
  // Convert to state abbreviations first
  const originState = getStateFromZip(originZip);
  const destState = getStateFromZip(destZip);
  
  if (!originState || !destState) {
    return '8'; // Default to highest zone for unknown states
  }
  
  if (originState === destState) {
    return '2'; // Same state
  }
  
  // Zone mapping logic based on geographic proximity
  const zoneMap: Record<string, Record<string, string>> = {
    'CA': {
      'OR': '2', 'WA': '2', 'NV': '2', 'AZ': '3',
      'UT': '4', 'ID': '4', 'CO': '5', 'TX': '6'
    },
    'TX': {
      'OK': '2', 'LA': '2', 'AR': '2', 'NM': '3',
      'CO': '4', 'KS': '4', 'MO': '5', 'TN': '5'
    },
    'FL': {
      'GA': '2', 'AL': '2', 'SC': '3', 'NC': '4',
      'TN': '4', 'KY': '5', 'VA': '5', 'WV': '6'
    },
    'NY': {
      'NJ': '2', 'CT': '2', 'PA': '2', 'MA': '3',
      'VT': '3', 'NH': '3', 'ME': '4', 'RI': '3'
    }
  };
  
  const zone = zoneMap[originState]?.[destState];
  if (zone) return zone;
  
  // Default zone calculation based on distance approximation
  const eastCoast = ['ME', 'NH', 'VT', 'MA', 'RI', 'CT', 'NY', 'NJ', 'PA', 'DE', 'MD', 'VA', 'WV', 'NC', 'SC', 'GA', 'FL'];
  const westCoast = ['CA', 'OR', 'WA', 'NV', 'AZ'];
  const central = ['TX', 'OK', 'AR', 'LA', 'MS', 'AL', 'TN', 'KY', 'MO', 'IA', 'IL', 'IN', 'OH', 'MI', 'WI', 'MN'];
  
  const originRegion = eastCoast.includes(originState) ? 'east' : westCoast.includes(originState) ? 'west' : 'central';
  const destRegion = eastCoast.includes(destState) ? 'east' : westCoast.includes(destState) ? 'west' : 'central';
  
  if (originRegion === destRegion) return '4';
  if ((originRegion === 'east' && destRegion === 'central') || (originRegion === 'central' && destRegion === 'east')) return '5';
  if ((originRegion === 'west' && destRegion === 'central') || (originRegion === 'central' && destRegion === 'west')) return '6';
  if ((originRegion === 'east' && destRegion === 'west') || (originRegion === 'west' && destRegion === 'east')) return '8';
  
  return '6'; // Default zone
}

function getStateFromZip(zipCode: string): string | null {
  const zip = parseInt(zipCode.substring(0, 5));
  
  if (zip >= 99501 && zip <= 99950) return 'AK';
  if (zip >= 35000 && zip <= 36999) return 'AL';
  if (zip >= 71600 && zip <= 72999) return 'AR';
  if (zip >= 85000 && zip <= 86999) return 'AZ';
  if (zip >= 90000 && zip <= 96699) return 'CA';
  if (zip >= 80000 && zip <= 81999) return 'CO';
  if (zip >= 6000 && zip <= 6999) return 'CT';
  if (zip >= 19700 && zip <= 19999) return 'DE';
  if (zip >= 32000 && zip <= 34999) return 'FL';
  if (zip >= 30000 && zip <= 31999) return 'GA';
  if (zip >= 96700 && zip <= 96999) return 'HI';
  if (zip >= 83200 && zip <= 83999) return 'ID';
  if (zip >= 60000 && zip <= 62999) return 'IL';
  if (zip >= 46000 && zip <= 47999) return 'IN';
  if (zip >= 50000 && zip <= 52999) return 'IA';
  if (zip >= 66000 && zip <= 67999) return 'KS';
  if (zip >= 40000 && zip <= 42999) return 'KY';
  if (zip >= 70000 && zip <= 71599) return 'LA';
  if (zip >= 3900 && zip <= 4999) return 'ME';
  if (zip >= 20600 && zip <= 21999) return 'MD';
  if (zip >= 1000 && zip <= 2799) return 'MA';
  if (zip >= 48000 && zip <= 49999) return 'MI';
  if (zip >= 55000 && zip <= 56999) return 'MN';
  if (zip >= 38600 && zip <= 39999) return 'MS';
  if (zip >= 63000 && zip <= 65999) return 'MO';
  if (zip >= 59000 && zip <= 59999) return 'MT';
  if (zip >= 27000 && zip <= 28999) return 'NC';
  if (zip >= 58000 && zip <= 58999) return 'ND';
  if (zip >= 68000 && zip <= 69999) return 'NE';
  if (zip >= 88900 && zip <= 89999) return 'NV';
  if (zip >= 3000 && zip <= 3899) return 'NH';
  if (zip >= 7000 && zip <= 8999) return 'NJ';
  if (zip >= 87000 && zip <= 88499) return 'NM';
  if (zip >= 10000 && zip <= 14999) return 'NY';
  if (zip >= 43000 && zip <= 45999) return 'OH';
  if (zip >= 73000 && zip <= 74999) return 'OK';
  if (zip >= 97000 && zip <= 97999) return 'OR';
  if (zip >= 15000 && zip <= 19699) return 'PA';
  if (zip >= 2800 && zip <= 2999) return 'RI';
  if (zip >= 29000 && zip <= 29999) return 'SC';
  if (zip >= 57000 && zip <= 57999) return 'SD';
  if (zip >= 37000 && zip <= 38599) return 'TN';
  if (zip >= 75000 && zip <= 79999 || zip >= 73301 && zip <= 73399 || zip >= 88500 && zip <= 88599) return 'TX';
  if (zip >= 84000 && zip <= 84999) return 'UT';
  if (zip >= 5000 && zip <= 5999) return 'VT';
  if (zip >= 22000 && zip <= 24699) return 'VA';
  if (zip >= 98000 && zip <= 99499) return 'WA';
  if (zip >= 24700 && zip <= 26999) return 'WV';
  if (zip >= 53000 && zip <= 54999) return 'WI';
  if (zip >= 82000 && zip <= 83199) return 'WY';
  
  return null;
}

async function calculateRateCardRate(supabase: any, shipment: ShipmentRequest, config: CarrierConfig, serviceTypes: string[]) {
  try {
    console.log(`📋 Calculating rate card rates for ${config.account_name}`, {
      carrierType: config.carrier_type,
      serviceTypes,
      weight: shipment.package.weight
    });

    // Use CSV-mapped zone if available, otherwise calculate automatically
    let zone: string;
    if (shipment.zone) {
      zone = shipment.zone;
      console.log(`🗺️ Using CSV-mapped zone: ${zone} (${shipment.shipFrom.zipCode} → ${shipment.shipTo.zipCode})`);
    } else {
      zone = calculateShippingZone(shipment.shipFrom.zipCode, shipment.shipTo.zipCode);
      console.log(`🗺️ Auto-calculated zone: ${zone} (${shipment.shipFrom.zipCode} → ${shipment.shipTo.zipCode})`);
    }

    // Calculate billable weight (considering dimensional weight)
    let billableWeight = shipment.package.weight;
    if (shipment.package.length && shipment.package.width && shipment.package.height && config.dimensional_divisor) {
      const dimensionalWeight = (shipment.package.length * shipment.package.width * shipment.package.height) / config.dimensional_divisor;
      billableWeight = Math.max(billableWeight, dimensionalWeight);
      console.log(`📏 Dimensional weight: ${dimensionalWeight.toFixed(1)} lbs, Billable weight: ${billableWeight.toFixed(1)} lbs`);
    }

    const rates: any[] = [];

    // Process each service type
    for (const serviceCode of serviceTypes) {
      console.log(`🔍 Looking up rate for service: ${serviceCode}, zone: ${zone}, weight: ${billableWeight}`);

      // Query rate card rates
      const { data: rateCardRates, error } = await supabase
        .from('rate_card_rates')
        .select('*')
        .eq('carrier_config_id', config.id)
        .eq('service_code', serviceCode)
        .eq('zone', zone)
        .order('weight_break', { ascending: true });

      if (error) {
        console.error('Error querying rate card rates:', error);
        continue;
      }

      if (!rateCardRates || rateCardRates.length === 0) {
        console.log(`⚠️ No rate found for service ${serviceCode}, zone ${zone}`);
        continue;
      }

      // Find the appropriate weight break (next weight up logic)
      let selectedRate = null;
      for (const rate of rateCardRates) {
        if (billableWeight <= rate.weight_break) {
          selectedRate = rate;
          break;
        }
      }

      // If no weight break found, use the highest one
      if (!selectedRate && rateCardRates.length > 0) {
        selectedRate = rateCardRates[rateCardRates.length - 1];
      }

      if (selectedRate) {
        let finalRate = selectedRate.rate_amount;

        // Apply fuel surcharge if configured
        if (config.fuel_surcharge_percent && config.fuel_surcharge_percent > 0) {
          const fuelSurcharge = finalRate * (config.fuel_surcharge_percent / 100);
          finalRate += fuelSurcharge;
          console.log(`⛽ Applied fuel surcharge: ${config.fuel_surcharge_percent}% (+$${fuelSurcharge.toFixed(2)})`);
        }

        // Determine service name
        let serviceName = selectedRate.service_name || serviceCode;
        if (config.carrier_type === 'amazon' && serviceCode === 'GROUND') {
          serviceName = 'Amazon Ground';
        }

        const rateResult = {
          serviceCode: serviceCode,
          serviceName: serviceName,
          totalCharges: finalRate.toFixed(2),
          currency: 'USD',
          transitDays: null, // Rate cards typically don't include transit times
          source: 'rate_card',
          zone: zone,
          weightBreak: selectedRate.weight_break,
          baseRate: selectedRate.rate_amount,
          fuelSurcharge: config.fuel_surcharge_percent || 0,
          billableWeight: billableWeight.toFixed(1)
        };

        rates.push(rateResult);
        console.log(`✅ Rate card calculation complete:`, rateResult);
      } else {
        console.log(`⚠️ No suitable weight break found for ${billableWeight} lbs in service ${serviceCode}`);
      }
    }

    console.log(`📋 Rate card lookup complete: ${rates.length} rates found`);
    return rates;

  } catch (error) {
    console.error('Error in calculateRateCardRate:', error);
    throw error;
  }
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