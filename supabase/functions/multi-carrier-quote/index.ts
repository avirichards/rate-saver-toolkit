
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SimpleShipmentRequest {
  carrierConfigs: string[];
  shipFromZip: string;
  shipToZip: string;
  weight: number;
  length?: number;
  width?: number;
  height?: number;
  serviceTypes?: string[];
  isResidential?: boolean;
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
}

serve(async (req) => {
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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse the request body - handle both old and new formats
    const requestBody = await req.json();
    console.log('🚚 RAW REQUEST BODY:', requestBody);

    let shipmentData: SimpleShipmentRequest;
    
    // Handle the format Analysis.tsx is actually sending
    if (requestBody.carrierConfigs) {
      shipmentData = requestBody as SimpleShipmentRequest;
    } else if (requestBody.shipment) {
      // Handle legacy nested format if needed
      shipmentData = {
        carrierConfigs: requestBody.shipment.carrierConfigIds || [],
        shipFromZip: requestBody.shipment.shipFrom?.zipCode || '',
        shipToZip: requestBody.shipment.shipTo?.zipCode || '',
        weight: requestBody.shipment.package?.weight || 0,
        length: requestBody.shipment.package?.length,
        width: requestBody.shipment.package?.width,
        height: requestBody.shipment.package?.height,
        serviceTypes: requestBody.shipment.serviceTypes,
        isResidential: requestBody.shipment.isResidential
      };
    } else {
      return new Response(JSON.stringify({ error: 'Invalid request format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!shipmentData.carrierConfigs || shipmentData.carrierConfigs.length === 0) {
      return new Response(JSON.stringify({ error: 'No carrier configurations specified' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('🚚 PROCESSED SHIPMENT DATA:', {
      carrierConfigCount: shipmentData.carrierConfigs.length,
      carrierConfigs: shipmentData.carrierConfigs,
      shipFromZip: shipmentData.shipFromZip,
      shipToZip: shipmentData.shipToZip,
      weight: shipmentData.weight,
      serviceTypes: shipmentData.serviceTypes
    });

    // Get carrier configurations for the user
    const { data: carrierConfigs, error: configError } = await supabase
      .from('carrier_configs')
      .select('*')
      .eq('user_id', user.id)
      .in('id', shipmentData.carrierConfigs)
      .eq('is_active', true);

    if (configError || !carrierConfigs || carrierConfigs.length === 0) {
      console.error('❌ Carrier config error:', configError);
      return new Response(JSON.stringify({ error: 'No valid carrier configurations found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const allRates: any[] = [];
    const carrierResults: any[] = [];

    // Process each carrier configuration
    for (const config of carrierConfigs as CarrierConfig[]) {
      try {
        console.log(`📦 Processing carrier: ${config.carrier_type} (${config.account_name})`);
        
        let rates: any[] = [];
        
        if (config.carrier_type === 'ups') {
          // Skip if missing critical data
          if (!shipmentData.shipFromZip || !shipmentData.shipToZip || !shipmentData.weight || shipmentData.weight === null) {
            console.log(`⚠️ Skipping UPS rates for ${config.account_name}: Missing required data`);
            continue;
          }

          // Convert simple data to UPS format
          const upsShipment = {
            shipFrom: {
              name: 'Shipper',
              address: '123 Main St',
              city: 'City',
              state: 'CA',
              zipCode: shipmentData.shipFromZip,
              country: 'US'
            },
            shipTo: {
              name: 'Consignee',
              address: '456 Oak Ave',
              city: 'City',
              state: 'NY',
              zipCode: shipmentData.shipToZip,
              country: 'US'
            },
            package: {
              weight: shipmentData.weight,
              weightUnit: 'LBS',
              length: shipmentData.length || 12,
              width: shipmentData.width || 12,
              height: shipmentData.height || 6,
              dimensionUnit: 'IN',
              packageType: '02'
            },
            serviceTypes: shipmentData.serviceTypes || ['03'],
            isResidential: shipmentData.isResidential || false
          };

          rates = await getUpsRates(supabase, upsShipment, config);
        } else if (config.carrier_type === 'fedex') {
          rates = await getFedexRates(supabase, shipmentData, config);
        } else if (config.carrier_type === 'dhl') {
          rates = await getDhlRates(supabase, shipmentData, config);
        } else if (config.carrier_type === 'usps') {
          rates = await getUspsRates(supabase, shipmentData, config);
        }

        if (rates.length > 0) {
          // Standardize rate format with complete account information
          const standardizedRates = rates.map(rate => ({
            // Core rate data
            carrierId: config.id,
            carrierType: config.carrier_type.toUpperCase(),
            accountName: config.account_name,
            displayName: `${config.carrier_type.toUpperCase()} – ${config.account_name}`,
            serviceName: rate.serviceName || rate.serviceCode || 'Standard',
            serviceCode: rate.serviceCode || rate.serviceName || 'STD',
            
            // Pricing
            rate: parseFloat(rate.totalCharges || rate.cost || rate.price || '0'),
            totalCharges: parseFloat(rate.totalCharges || rate.cost || rate.price || '0'),
            cost: parseFloat(rate.totalCharges || rate.cost || rate.price || '0'),
            price: parseFloat(rate.totalCharges || rate.cost || rate.price || '0'),
            
            // Metadata
            isSandbox: config.is_sandbox,
            transitTime: rate.transitTime || rate.deliveryTime || 'N/A',
            guaranteedDelivery: rate.guaranteedDelivery || false,
            
            // Original response data for debugging
            originalResponse: rate
          }));

          allRates.push(...standardizedRates);
          carrierResults.push({
            carrierId: config.id,
            carrierName: config.account_name,
            carrierType: config.carrier_type,
            displayName: `${config.carrier_type.toUpperCase()} – ${config.account_name}`,
            success: true,
            rateCount: standardizedRates.length,
            rates: standardizedRates
          });
        } else {
          carrierResults.push({
            carrierId: config.id,
            carrierName: config.account_name,
            carrierType: config.carrier_type,
            displayName: `${config.carrier_type.toUpperCase()} – ${config.account_name}`,
            success: false,
            error: 'No rates returned',
            rates: []
          });
        }

      } catch (error: any) {
        console.error(`❌ Error getting rates for ${config.carrier_type}:`, error);
        carrierResults.push({
          carrierId: config.id,
          carrierName: config.account_name,
          carrierType: config.carrier_type,
          displayName: `${config.carrier_type.toUpperCase()} – ${config.account_name}`,
          success: false,
          error: error.message,
          rates: []
        });
      }
    }

    // Find best rates by service type
    const bestRates = findBestRatesByService(allRates);

    console.log('📊 MULTI-CARRIER RESULTS:', {
      totalCarriers: carrierConfigs.length,
      successfulCarriers: carrierResults.filter(r => r.success).length,
      totalRates: allRates.length,
      bestRatesCount: bestRates.length
    });

    return new Response(JSON.stringify({
      success: true,
      carrierResults,
      allRates,
      bestRates,
      // Enhanced response with account data for easy access
      accountData: carrierConfigs.map(config => ({
        carrierId: config.id,
        carrierType: config.carrier_type.toUpperCase(),
        accountName: config.account_name,
        displayName: `${config.carrier_type.toUpperCase()} – ${config.account_name}`,
        isSandbox: config.is_sandbox
      })),
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

async function getUpsRates(supabase: any, shipment: any, config: CarrierConfig) {
  console.log('📦 Getting UPS rates...');
  
  const { data, error } = await supabase.functions.invoke('ups-rate-quote', {
    body: { 
      shipment: shipment,
      configId: config.id
    }
  });

  if (error) {
    console.error('UPS rate error:', error);
    throw new Error(`UPS rate error: ${error.message}`);
  }

  return data?.rates || [];
}

async function getFedexRates(supabase: any, shipment: SimpleShipmentRequest, config: CarrierConfig) {
  console.log('🚚 Getting FedEx rates... (placeholder)');
  return [];
}

async function getDhlRates(supabase: any, shipment: SimpleShipmentRequest, config: CarrierConfig) {
  console.log('✈️ Getting DHL rates... (placeholder)');
  return [];
}

async function getUspsRates(supabase: any, shipment: SimpleShipmentRequest, config: CarrierConfig) {
  console.log('📮 Getting USPS rates... (placeholder)');
  return [];
}

function findBestRatesByService(allRates: any[]) {
  if (!allRates || allRates.length === 0) return [];

  const ratesByService: { [key: string]: any[] } = {};
  
  allRates.forEach(rate => {
    const serviceKey = rate.serviceName || rate.serviceCode || 'Unknown';
    if (!ratesByService[serviceKey]) {
      ratesByService[serviceKey] = [];
    }
    ratesByService[serviceKey].push(rate);
  });

  const bestRates: any[] = [];
  
  Object.entries(ratesByService).forEach(([serviceType, rates]) => {
    const sortedRates = rates.sort((a, b) => 
      (a.totalCharges || a.cost || a.rate || 0) - (b.totalCharges || b.cost || b.rate || 0)
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

  return bestRates.sort((a, b) => (a.totalCharges || a.cost || a.rate || 0) - (b.totalCharges || b.cost || b.rate || 0));
}
