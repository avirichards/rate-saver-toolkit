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

    // Clean and format addresses with comprehensive ZIP to state mapping
    const cleanZip = (zip: string) => zip.trim().substring(0, 5); // Use 5-digit ZIP for FedEx
    const formatAddress = (addr: string) => addr.trim().substring(0, 50); // FedEx address line limit
    
    // ZIP to state mapping function
    const getStateFromZip = (zipCode: string): string => {
      if (!zipCode) return '';
      
      const cleanZip = zipCode.trim().substring(0, 5);
      const zipNum = parseInt(cleanZip);
      
      if (isNaN(zipNum)) return '';

      // Comprehensive ZIP code ranges by state
      if (zipNum >= 35000 && zipNum <= 36999) return 'AL';
      if (zipNum >= 99500 && zipNum <= 99999) return 'AK';
      if (zipNum >= 85000 && zipNum <= 86999) return 'AZ';
      if (zipNum >= 71600 && zipNum <= 72999) return 'AR';
      if (zipNum >= 90000 && zipNum <= 96699) return 'CA';
      if (zipNum >= 80000 && zipNum <= 81999) return 'CO';
      if (zipNum >= 6000 && zipNum <= 6999) return 'CT';
      if (zipNum >= 19700 && zipNum <= 19999) return 'DE';
      if (zipNum >= 20000 && zipNum <= 20599) return 'DC';
      if (zipNum >= 32000 && zipNum <= 34999) return 'FL';
      if (zipNum >= 30000 && zipNum <= 31999) return 'GA';
      if (zipNum >= 96700 && zipNum <= 96999) return 'HI';
      if (zipNum >= 83200 && zipNum <= 83999) return 'ID';
      if (zipNum >= 60000 && zipNum <= 62999) return 'IL';
      if (zipNum >= 46000 && zipNum <= 47999) return 'IN';
      if (zipNum >= 50000 && zipNum <= 52999) return 'IA';
      if (zipNum >= 66000 && zipNum <= 67999) return 'KS';
      if (zipNum >= 40000 && zipNum <= 42999) return 'KY';
      if (zipNum >= 70000 && zipNum <= 71599) return 'LA';
      if (zipNum >= 3900 && zipNum <= 4999) return 'ME';
      if (zipNum >= 20600 && zipNum <= 21999) return 'MD';
      if (zipNum >= 1000 && zipNum <= 2799) return 'MA';
      if (zipNum >= 48000 && zipNum <= 49999) return 'MI';
      if (zipNum >= 55000 && zipNum <= 56999) return 'MN';
      if (zipNum >= 38600 && zipNum <= 39999) return 'MS';
      if (zipNum >= 63000 && zipNum <= 65999) return 'MO';
      if (zipNum >= 59000 && zipNum <= 59999) return 'MT';
      if (zipNum >= 68000 && zipNum <= 69999) return 'NE';
      if (zipNum >= 88900 && zipNum <= 89999) return 'NV';
      if (zipNum >= 3000 && zipNum <= 3899) return 'NH';
      if (zipNum >= 7000 && zipNum <= 8999) return 'NJ';
      if (zipNum >= 87000 && zipNum <= 88499) return 'NM';
      if (zipNum >= 10000 && zipNum <= 14999) return 'NY';
      if (zipNum >= 27000 && zipNum <= 28999) return 'NC';
      if (zipNum >= 58000 && zipNum <= 58999) return 'ND';
      if (zipNum >= 43000 && zipNum <= 45999) return 'OH';
      if (zipNum >= 73000 && zipNum <= 74999) return 'OK';
      if (zipNum >= 97000 && zipNum <= 97999) return 'OR';
      if (zipNum >= 15000 && zipNum <= 19699) return 'PA';
      if (zipNum >= 2800 && zipNum <= 2999) return 'RI';
      if (zipNum >= 29000 && zipNum <= 29999) return 'SC';
      if (zipNum >= 57000 && zipNum <= 57999) return 'SD';
      if (zipNum >= 37000 && zipNum <= 38599) return 'TN';
      if (zipNum >= 75000 && zipNum <= 79999) return 'TX';
      if (zipNum >= 84000 && zipNum <= 84999) return 'UT';
      if (zipNum >= 5000 && zipNum <= 5999) return 'VT';
      if (zipNum >= 22000 && zipNum <= 24699) return 'VA';
      if (zipNum >= 98000 && zipNum <= 99499) return 'WA';
      if (zipNum >= 24700 && zipNum <= 26999) return 'WV';
      if (zipNum >= 53000 && zipNum <= 54999) return 'WI';
      if (zipNum >= 82000 && zipNum <= 83199) return 'WY';
      
      // Territories
      if (zipNum >= 600 && zipNum <= 999) return 'PR';
      if (zipNum >= 800 && zipNum <= 899) return 'VI';
      if (zipNum >= 96900 && zipNum <= 96999) return 'GU';
      
      return ''; // Unknown ZIP code
    };

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

    // Map package type to FedEx packaging codes
    const getFedExPackagingCode = (packageType?: string): string => {
      const packageMap: { [key: string]: string } = {
        '02': 'YOUR_PACKAGING', // Customer Supplied Package
        '01': 'FEDEX_ENVELOPE',
        '03': 'FEDEX_TUBE',
        '04': 'FEDEX_BOX',
        '21': 'FEDEX_SMALL_BOX',
        '24': 'FEDEX_MEDIUM_BOX',
        '25': 'FEDEX_LARGE_BOX',
        '30': 'FEDEX_EXTRA_LARGE_BOX'
      };
      return packageMap[packageType || '02'] || 'YOUR_PACKAGING';
    };

    const ratingRequest = {
      accountNumber: {
        value: config.fedex_account_number
      },
      requestedShipment: {
        shipper: {
          address: {
            postalCode: cleanZip(shipment.shipFrom.zipCode),
            countryCode: shipment.shipFrom.country || 'US',
            ...(shipment.shipFrom.state ? { stateOrProvinceCode: shipment.shipFrom.state } : 
               getStateFromZip(shipment.shipFrom.zipCode) ? { stateOrProvinceCode: getStateFromZip(shipment.shipFrom.zipCode) } : {})
          }
        },
        recipient: {
          address: {
            postalCode: cleanZip(shipment.shipTo.zipCode),
            countryCode: shipment.shipTo.country || 'US',
            residential: shipment.isResidential || false,
            ...(shipment.shipTo.state ? { stateOrProvinceCode: shipment.shipTo.state } : 
               getStateFromZip(shipment.shipTo.zipCode) ? { stateOrProvinceCode: getStateFromZip(shipment.shipTo.zipCode) } : {})
          }
        },
        shipDateStamp: new Date().toISOString().split('T')[0],
        rateRequestType: ["ACCOUNT", "LIST"],
        pickupType: "CONTACT_FEDEX_TO_SCHEDULE", // Valid FedEx API enum value
        packagingType: "YOUR_PACKAGING",
        requestedPackageLineItems: [{
          groupPackageCount: 1,
          weight: {
            units: shipment.package.weightUnit?.toUpperCase() === 'LBS' ? 'LB' : 'KG',
            value: shipment.package.weight
          },
          dimensions: {
            length: shipment.package.length || 12,
            width: shipment.package.width || 12,
            height: shipment.package.height || 6,
            units: shipment.package.dimensionUnit?.toUpperCase() === 'IN' ? 'IN' : 'CM'
          },
          packageSpecialServices: {
            packageCODDetail: null,
            dangerousGoodsDetail: null
          },
          physicalPackaging: getFedExPackagingCode(shipment.package.packageType)
        }]
      }
    };

    console.log('🏠 FedEx API - RESIDENTIAL STATUS VERIFICATION:', {
      inputResidential: shipment.isResidential,
      residentialSource: shipment.residentialSource,
      fedexResidentialFlag: ratingRequest.requestedShipment.recipient.address.residential,
      zipCode: ratingRequest.requestedShipment.recipient.address.postalCode
    });

    // Use ONLY the confirmed service codes - NO fallbacks
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
    
    console.log('🔍 SERVICE CODE VALIDATION - NO FALLBACKS:', {
      receivedServiceTypes: shipment.serviceTypes,
      receivedEquivalentCode: shipment.equivalentServiceCode,
      finalServiceCodes: serviceCodes,
      finalEquivalentCode: equivalentServiceCode,
      confirmedMappingOnly: true,
      configId
    });

    const rates = [];

    console.log('Service codes to request:', {
      serviceCodes,
      equivalentServiceCode,
      total: serviceCodes.length,
      receivedServiceTypes: shipment.serviceTypes,
      receivedEquivalentCode: shipment.equivalentServiceCode,
      configId
    });

    // Get rates for each service type
    for (const serviceCode of serviceCodes) {
      try {
        // Add service type to the request
        const serviceRequest = {
          ...ratingRequest,
          requestedShipment: {
            ...ratingRequest.requestedShipment,
            serviceType: serviceCode
          }
        };

        console.log(`🚀 FEDEX REQUEST DEBUG - Service: ${serviceCode}, Config: ${configId}`);
        console.log(`📦 Sending FedEx request with pickupType:`, JSON.stringify({
          pickupType: serviceRequest.requestedShipment.pickupType,
          packagingType: serviceRequest.requestedShipment.packagingType,
          endpoint: ratingEndpoint
        }, null, 2));

        console.log(`Requesting FedEx rate for service ${serviceCode} with config ${configId}...`);

        const response = await fetch(ratingEndpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${access_token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-locale': 'en_US'
          },
          body: JSON.stringify(serviceRequest)
        });

        console.log(`FedEx API Response Status for service ${serviceCode} (config ${configId}):`, response.status);

        if (response.ok) {
          const rateData = await response.json();
          console.log(`✅ FedEx Rate Response for service ${serviceCode} (config ${configId}):`, JSON.stringify(rateData, null, 2));
          
          if (rateData.output?.rateReplyDetails) {
            const rateReplyDetails = Array.isArray(rateData.output.rateReplyDetails) 
              ? rateData.output.rateReplyDetails[0] 
              : rateData.output.rateReplyDetails;
            
            // Get service name from carrier services table
            const { data: service } = await supabase
              .from('carrier_services')
              .select('service_name, description')
              .eq('service_code', serviceCode)
              .eq('carrier_type', 'fedex')
              .maybeSingle();

            // Extract rate information
            const ratedShipmentDetails = rateReplyDetails.ratedShipmentDetails?.[0];
            if (ratedShipmentDetails) {
              // Check for account rates first, then fall back to list rates
              const listRate = ratedShipmentDetails.shipmentRateDetail?.totalNetCharge || 0;
              const accountRate = ratedShipmentDetails.shipmentRateDetail?.totalNetChargeWithDutiesAndTaxes || listRate;
              
              const hasAccountRates = accountRate !== listRate && config?.fedex_account_number;
              const finalCharges = hasAccountRates ? accountRate : listRate;
              const rateType = hasAccountRates ? 'account' : 'list';
              
              // Calculate savings if we have both rates
              const savingsAmount = hasAccountRates && listRate > 0 ? listRate - accountRate : 0;
              const savingsPercentage = savingsAmount > 0 ? ((savingsAmount / listRate) * 100) : 0;

              // Extract surcharge details for residential analysis
              const surcharges = ratedShipmentDetails.shipmentRateDetail?.surCharges || [];
              const residentialSurcharge = surcharges.find((charge: any) => 
                charge.type === 'RESIDENTIAL_DELIVERY' || charge.description?.toLowerCase().includes('residential')
              );
              
              console.log(`Rate analysis for service ${serviceCode} (config ${configId}) - RESIDENTIAL IMPACT:`, {
                list: listRate,
                account: accountRate,
                final: finalCharges,
                rateType,
                savings: savingsAmount,
                hasAccount: !!config?.fedex_account_number,
                isResidential: shipment.isResidential,
                residentialSource: shipment.residentialSource,
                residentialSurcharge: residentialSurcharge ? {
                  amount: residentialSurcharge.amount,
                  type: residentialSurcharge.type,
                  description: residentialSurcharge.description
                } : 'No residential surcharge found',
                allSurcharges: surcharges.map((s: any) => ({ 
                  type: s.type, 
                  amount: s.amount, 
                  desc: s.description 
                }))
              });

              if (finalCharges > 0) {
                rates.push({
                  serviceCode,
                  serviceName: service?.service_name || `FedEx ${serviceCode}`,
                  description: service?.description || '',
                  totalCharges: finalCharges,
                  currency: ratedShipmentDetails.shipmentRateDetail?.currency || 'USD',
                  baseCharges: ratedShipmentDetails.shipmentRateDetail?.totalBaseCharge || 0,
                  transitTime: rateReplyDetails.operationalDetail?.transitTime || null,
                  deliveryDate: rateReplyDetails.operationalDetail?.deliveryDate || null,
                  rateType,
                  hasAccountRates,
                  listRate: listRate,
                  accountRate: accountRate,
                  savingsAmount,
                  savingsPercentage,
                  isEquivalentService: serviceCode === equivalentServiceCode,
                  residentialInfo: {
                    isResidential: shipment.isResidential || false,
                    residentialSource: shipment.residentialSource || 'unknown',
                    hasResidentialIndicator: !!residentialSurcharge
                  }
                });
              }
            }
          }
        } else {
          const errorText = await response.text();
          console.error(`❌ FedEx API Error for service ${serviceCode}:`, {
            status: response.status,
            statusText: response.statusText,
            error: errorText,
            configId: configId
          });
          
          // Log the exact request that failed
          console.error(`📝 Failed FedEx Request for ${serviceCode}:`, JSON.stringify(serviceRequest, null, 2));
          
          // Continue with other services even if one fails
          continue;
        }
      } catch (error) {
        console.error(`Error requesting rate for service ${serviceCode}:`, error);
        continue;
      }
    }

    const apiCallEnd = Date.now();
    const apiCallDuration = apiCallEnd - apiCallStart;

    console.log(`FedEx API Performance (config ${configId}):`, {
      duration: `${apiCallDuration}ms`,
      ratesReturned: rates.length,
      servicesRequested: serviceCodes.length
    });

    return new Response(JSON.stringify({
      rates,
      requestedServices: serviceCodes,
      equivalentServiceCode,
      performanceMetrics: {
        apiCallDuration,
        ratesReturned: rates.length,
        servicesRequested: serviceCodes.length
      }
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