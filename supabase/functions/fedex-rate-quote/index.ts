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
  serviceTypes?: string[];
  equivalentServiceCode?: string;
  isResidential?: boolean;
  residentialSource?: string;
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

    const { shipment, configId }: { shipment: ShipmentRequest, configId?: string } = await req.json();
    console.log('📦 FedEx Rate Quote request:', { 
      shipFrom: shipment?.shipFrom?.zipCode,
      shipTo: shipment?.shipTo?.zipCode,
      weight: shipment?.package?.weight,
      configId: configId
    });

    // Track API call metrics for performance monitoring
    const apiCallStart = Date.now();

    // Validate shipment data before building request
    if (!shipment?.shipFrom?.zipCode || !shipment?.shipTo?.zipCode) {
      return new Response(JSON.stringify({ error: 'Missing required ZIP codes' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!shipment?.package?.weight || shipment.package.weight <= 0) {
      return new Response(JSON.stringify({ error: 'Invalid package weight' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Clean and format addresses
    const cleanZip = (zip: string) => zip.trim().substring(0, 5);

    // Get specific FedEx account configuration using configId
    let query = supabase
      .from('carrier_configs')
      .select('fedex_account_number, fedex_key, fedex_password, is_sandbox')
      .eq('user_id', user.id)
      .eq('carrier_type', 'fedex')
      .eq('is_active', true);

    // If configId is provided, use specific config
    if (configId) {
      query = query.eq('id', configId);
    }
    
    const { data: config } = await query.maybeSingle();

    if (!config?.fedex_account_number) {
      return new Response(JSON.stringify({ 
        error: configId 
          ? `FedEx configuration not found for configId: ${configId}` 
          : 'FedEx account number is required for rate quotes' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get access token for this specific config
    const { data: authData, error: fedexAuthError } = await supabase.functions.invoke('fedex-auth', {
      body: { action: 'get_token', config_id: configId }
    });

    if (fedexAuthError || !authData?.access_token) {
      console.error('FedEx auth error:', fedexAuthError);
      return new Response(JSON.stringify({ error: 'Failed to authenticate with FedEx' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { access_token, is_sandbox } = authData;

    // Build FedEx Rating API request with proper endpoint
    const ratingEndpoint = is_sandbox
      ? 'https://apis-sandbox.fedex.com/rate/v1/rates/quotes'
      : 'https://apis.fedex.com/rate/v1/rates/quotes';

    console.log('FedEx Rating API Configuration:', {
      endpoint: ratingEndpoint,
      is_sandbox,
      has_access_token: !!access_token,
      configId
    });

    const ratingRequest = {
      accountNumber: {
        value: config.fedex_account_number
      },
      requestedShipment: {
        shipper: {
          address: {
            postalCode: cleanZip(shipment.shipFrom.zipCode),
            countryCode: shipment.shipFrom.country || 'US'
          }
        },
        recipient: {
          address: {
            postalCode: cleanZip(shipment.shipTo.zipCode),
            countryCode: shipment.shipTo.country || 'US',
            residential: shipment.isResidential || false
          }
        },
        shipDateStamp: new Date().toISOString().split('T')[0],
        rateRequestType: ["ACCOUNT", "LIST"],
        pickupType: "DROPOFF_AT_FEDEX_LOCATION",
        requestedPackageLineItems: [{
          weight: {
            units: shipment.package.weightUnit?.toUpperCase() === 'LBS' ? 'LB' : 'KG',
            value: shipment.package.weight
          },
          dimensions: {
            length: shipment.package.length || 12,
            width: shipment.package.width || 12,
            height: shipment.package.height || 6,
            units: shipment.package.dimensionUnit?.toUpperCase() === 'IN' ? 'IN' : 'CM'
          }
        }]
      }
    };

    if (!shipment.serviceTypes || shipment.serviceTypes.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'No service codes provided. All shipments must have confirmed service mappings.' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const serviceCodes = shipment.serviceTypes;
    const equivalentServiceCode = shipment.equivalentServiceCode || serviceCodes[0];
    const rates = [];

    // Get rates for each service type
    for (const serviceCode of serviceCodes) {
      try {
        ratingRequest.requestedShipment.serviceType = serviceCode;

        console.log(`Requesting rate for service ${serviceCode} with config ${configId}...`);

        const response = await fetch(ratingEndpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${access_token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-locale': 'en_US'
          },
          body: JSON.stringify(ratingRequest)
        });

        console.log(`FedEx API Response Status for service ${serviceCode} (config ${configId}):`, response.status);

        if (response.ok) {
          const rateData = await response.json();
          console.log(`FedEx Rate Response for service ${serviceCode} (config ${configId}):`, JSON.stringify(rateData, null, 2));
          
          if (rateData.output?.rateReplyDetails) {
            const rateReplyDetails = Array.isArray(rateData.output.rateReplyDetails) 
              ? rateData.output.rateReplyDetails[0] 
              : rateData.output.rateReplyDetails;
            
            // Get service name
            const { data: service } = await supabase
              .from('carrier_services')
              .select('service_name, description')
              .eq('service_code', serviceCode)
              .eq('carrier_type', 'fedex')
              .maybeSingle();

            const ratedShipmentDetails = rateReplyDetails.ratedShipmentDetails || [];
            
            if (ratedShipmentDetails.length > 0) {
              const accountRateDetail = ratedShipmentDetails.find((detail: any) => detail.rateType === 'ACCOUNT');
              const listRateDetail = ratedShipmentDetails.find((detail: any) => detail.rateType === 'LIST');
              
              const accountRate = accountRateDetail?.totalNetCharge || 0;
              const listRate = listRateDetail?.totalNetCharge || 0;
              
              const hasAccountRates = accountRate > 0 && config?.fedex_account_number;
              const finalCharges = hasAccountRates ? accountRate : listRate;
              const rateType = hasAccountRates ? 'account' : 'list';
              
              const savingsAmount = hasAccountRates && listRate > 0 ? listRate - accountRate : 0;
              const savingsPercentage = savingsAmount > 0 ? ((savingsAmount / listRate) * 100) : 0;

              if (finalCharges > 0) {
                rates.push({
                  serviceCode,
                  serviceName: service?.service_name || `FedEx ${serviceCode}`,
                  description: service?.description || '',
                  totalCharges: finalCharges,
                  currency: (hasAccountRates ? accountRateDetail : listRateDetail)?.currency || 'USD',
                  baseCharges: (hasAccountRates ? accountRateDetail : listRateDetail)?.totalBaseCharge || 0,
                  transitTime: rateReplyDetails.operationalDetail?.transitTime || null,
                  deliveryDate: rateReplyDetails.operationalDetail?.deliveryDate || null,
                  rateType,
                  hasAccountRates,
                  listRate: listRate,
                  accountRate: accountRate,
                  savingsAmount,
                  savingsPercentage,
                  isEquivalentService: serviceCode === equivalentServiceCode
                });
              }
            }
          }
        } else {
          const errorText = await response.text();
          console.error(`FedEx API Error for service ${serviceCode}:`, {
            status: response.status,
            error: errorText,
            configId: configId
          });
          continue;
        }
      } catch (error) {
        console.error(`Error requesting rate for service ${serviceCode}:`, error);
        continue;
      }
    }

    const apiCallEnd = Date.now();
    const apiCallDuration = apiCallEnd - apiCallStart;

    return new Response(JSON.stringify({
      rates,
      requestedServices: serviceCodes,
      equivalentServiceCode
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in fedex-rate-quote function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});