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
    console.log('📦 UPS Rate Quote request:', { 
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
    const cleanZip = (zip: string) => zip.trim().substring(0, 5); // Use 5-digit ZIP for UPS
    const formatAddress = (addr: string) => addr.trim().substring(0, 50); // UPS address line limit
    
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

    // Get specific UPS account configuration using configId
    let query = supabase
      .from('carrier_configs')
      .select('ups_account_number, ups_client_id, ups_client_secret, is_sandbox')
      .eq('user_id', user.id)
      .eq('carrier_type', 'ups')
      .eq('is_active', true);

    // If configId is provided, use specific config
    if (configId) {
      query = query.eq('id', configId);
    }
    
    const { data: config } = await query.maybeSingle();

    if (!config?.ups_account_number) {
      return new Response(JSON.stringify({ 
        error: configId 
          ? `UPS configuration not found for configId: ${configId}` 
          : 'UPS account number is required for rate quotes' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get access token for this specific config
    const { data: authData, error: upsAuthError } = await supabase.functions.invoke('ups-auth', {
      body: { action: 'get_token', config_id: configId }
    });

    if (upsAuthError || !authData?.access_token) {
      console.error('UPS auth error:', upsAuthError);
      return new Response(JSON.stringify({ error: 'Failed to authenticate with UPS' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { access_token, is_sandbox } = authData;

    // Build UPS Rating API request with proper endpoint
    const ratingEndpoint = is_sandbox
      ? 'https://wwwcie.ups.com/api/rating/v1/Rate'
      : 'https://onlinetools.ups.com/api/rating/v1/Rate';

    console.log('UPS Rating API Configuration:', {
      endpoint: ratingEndpoint,
      is_sandbox,
      has_access_token: !!access_token,
      configId
    });

    const ratingRequest = {
      RateRequest: {
        Request: {
          TransactionReference: {
            CustomerContext: `ShipRate-${Date.now()}`
          }
        },
        Shipment: {
          Shipper: {
            Name: (shipment.shipFrom.name || 'Shipper').substring(0, 35),
            ShipperNumber: config.ups_account_number,
            Address: {
              PostalCode: cleanZip(shipment.shipFrom.zipCode),
              CountryCode: shipment.shipFrom.country || 'US'
            }
          },
          ShipTo: {
            Name: (shipment.shipTo.name || 'Recipient').substring(0, 35),
            Address: {
              StateProvinceCode: getStateFromZip(shipment.shipTo.zipCode),
              PostalCode: cleanZip(shipment.shipTo.zipCode),
              CountryCode: shipment.shipTo.country || 'US',
              ...(shipment.isResidential ? { ResidentialAddressIndicator: "Y" } : {})
            }
          },
          PaymentDetails: {
            ShipmentCharge: [{
              Type: "01",
              BillShipper: {
                AttentionName: (shipment.shipFrom.name || 'Shipper').substring(0, 35),
                Name: (shipment.shipFrom.name || 'Shipper').substring(0, 35),
                AccountNumber: config.ups_account_number,
                Address: {
                  AddressLine: formatAddress(shipment.shipFrom.address || '123 Main St'),
                  City: (shipment.shipFrom.city || '').substring(0, 30),
                  StateProvinceCode: getStateFromZip(shipment.shipFrom.zipCode),
                  PostalCode: cleanZip(shipment.shipFrom.zipCode),
                  CountryCode: shipment.shipFrom.country || 'US'
                }
              }
            }]
          },
          ShipmentRatingOptions: {
            TPFCNegotiatedRatesIndicator: "Y",
            NegotiatedRatesIndicator: "Y"
          },
          Service: {
            Code: "03", // Default to Ground, will iterate through services
            Description: "Ground"
          },
          Package: {
            PackagingType: {
              Code: shipment.package.packageType || "02",
              Description: "Packaging"
            },
            Dimensions: {
              UnitOfMeasurement: {
                Code: shipment.package.dimensionUnit || "IN",
                Description: "Inches"
              },
              Length: (shipment.package.length || 12).toString(),
              Width: (shipment.package.width || 12).toString(),
              Height: (shipment.package.height || 6).toString()
            },
            PackageWeight: {
              UnitOfMeasurement: {
                Code: shipment.package.weightUnit || "LBS",
                Description: "Pounds"
              },
              Weight: shipment.package.weight.toString()
            },
            OversizeIndicator: "X",
            MinimumBillableWeightIndicator: "X"
          }
        }
      }
    };

    console.log('🏠 UPS API - RESIDENTIAL STATUS VERIFICATION:', {
      inputResidential: shipment.isResidential,
      residentialSource: shipment.residentialSource,
      upsResidentialIndicator: !!ratingRequest.RateRequest.Shipment.ShipTo.Address.ResidentialAddressIndicator,
      residentialIndicatorValue: ratingRequest.RateRequest.Shipment.ShipTo.Address.ResidentialAddressIndicator,
      zipCode: ratingRequest.RateRequest.Shipment.ShipTo.Address.PostalCode
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
        ratingRequest.RateRequest.Shipment.Service.Code = serviceCode;

        console.log(`Requesting rate for service ${serviceCode} with config ${configId}...`);

        const response = await fetch(ratingEndpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${access_token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'transId': `shiprate-${Date.now()}`,
            'transactionSrc': 'ShipRate Pro',
            'version': 'v1'
          },
          body: JSON.stringify(ratingRequest)
        });

        console.log(`UPS API Response Status for service ${serviceCode} (config ${configId}):`, response.status);

        if (response.ok) {
          const rateData = await response.json();
          console.log(`UPS Rate Response for service ${serviceCode} (config ${configId}):`, JSON.stringify(rateData, null, 2));
          
          if (rateData.RateResponse?.RatedShipment) {
            const ratedShipment = Array.isArray(rateData.RateResponse.RatedShipment) 
              ? rateData.RateResponse.RatedShipment[0] 
              : rateData.RateResponse.RatedShipment;
            
            // Get service name
            const { data: service } = await supabase
              .from('ups_services')
              .select('service_name, description')
              .eq('service_code', serviceCode)
              .maybeSingle();

            // Check for negotiated rates first, then fall back to published rates
            const publishedCharges = parseFloat(ratedShipment.TotalCharges?.MonetaryValue || '0');
            const negotiatedCharges = parseFloat(ratedShipment.NegotiatedRateCharges?.TotalCharge?.MonetaryValue || '0');
            
            const hasNegotiatedRates = negotiatedCharges > 0 && config?.ups_account_number;
            const finalCharges = hasNegotiatedRates ? negotiatedCharges : publishedCharges;
            const rateType = hasNegotiatedRates ? 'negotiated' : 'published';
            
            // Calculate savings if we have both rates
            const savingsAmount = hasNegotiatedRates && publishedCharges > 0 ? publishedCharges - negotiatedCharges : 0;
            const savingsPercentage = savingsAmount > 0 ? ((savingsAmount / publishedCharges) * 100) : 0;

            // Extract surcharge details for residential analysis
            const surcharges = ratedShipment.ItemizedCharges || [];
            const residentialSurcharge = surcharges.find((charge: any) => 
              charge.Code === 'RES' || charge.Description?.toLowerCase().includes('residential')
            );
            
            console.log(`Rate analysis for service ${serviceCode} (config ${configId}) - RESIDENTIAL IMPACT:`, {
              published: publishedCharges,
              negotiated: negotiatedCharges,
              final: finalCharges,
              rateType,
              savings: savingsAmount,
              hasAccount: !!config?.ups_account_number,
              isResidential: shipment.isResidential,
              residentialSource: shipment.residentialSource,
              residentialSurcharge: residentialSurcharge ? {
                amount: residentialSurcharge.MonetaryValue,
                code: residentialSurcharge.Code,
                description: residentialSurcharge.Description
              } : 'No residential surcharge found',
              allSurcharges: surcharges.map((s: any) => ({ 
                code: s.Code, 
                amount: s.MonetaryValue, 
                desc: s.Description 
              })),
              chargeBreakdown: ratedShipment.RatedShipmentAlert || 'No alerts'
            });

            if (finalCharges > 0) {
              rates.push({
                serviceCode,
                serviceName: service?.service_name || `UPS Service ${serviceCode}`,
                description: service?.description || '',
                totalCharges: finalCharges,
                currency: ratedShipment.TotalCharges?.CurrencyCode || 'USD',
                baseCharges: parseFloat(ratedShipment.BaseServiceCharge?.MonetaryValue || '0'),
                transitTime: ratedShipment.GuaranteedDelivery?.BusinessDaysInTransit || null,
                deliveryDate: ratedShipment.GuaranteedDelivery?.DeliveryByTime || null,
                rateType,
                hasNegotiatedRates,
                publishedRate: publishedCharges,
                negotiatedRate: negotiatedCharges,
                savingsAmount,
                savingsPercentage,
                isEquivalentService: serviceCode === equivalentServiceCode, // Mark the equivalent service
                // Add residential tracking for debugging
                residentialInfo: {
                  isResidential: shipment.isResidential,
                  residentialSource: shipment.residentialSource,
                  hasResidentialIndicator: !!ratingRequest.RateRequest.Shipment.ShipTo.Address.ResidentialAddressIndicator
                }
              });
            }
          }
        } else {
          const apiCallEnd = Date.now();
          const callDuration = apiCallEnd - apiCallStart;
          const errorText = await response.text();
          
          console.error('🚨 UPS API ERROR DETAILS:', {
            error: errorText,
            httpStatus: response.status,
            callDuration: `${callDuration}ms`,
            serviceCode,
            configId,
            timestamp: new Date().toISOString()
          });
          
          // Check for specific error types
          if (response.status === 429) {
            console.log('🚨 RATE LIMIT EXCEEDED - Consider reducing concurrency');
          } else if (response.status >= 500) {
            console.log('🚨 UPS SERVER ERROR - Temporary issue, retry recommended');
          } else if (response.status === 401 || response.status === 403) {
            console.log('🚨 AUTHENTICATION ERROR - Token may be expired');
          }
          
          // Try to parse UPS error response
          try {
            const errorData = JSON.parse(errorText);
            console.error(`UPS Error Details for service ${serviceCode} (config ${configId}):`, errorData);
          } catch (e) {
            console.error(`UPS Raw Error Response for service ${serviceCode} (config ${configId}):`, errorText);
          }
        }
      } catch (error) {
        console.error(`Error getting rate for service ${serviceCode} (config ${configId}):`, error);
      }
    }

    const apiCallEnd = Date.now();
    const totalCallDuration = apiCallEnd - apiCallStart;
    
    console.log(`✅ Successfully retrieved ${rates.length} rates for config ${configId}`);
    console.log('⚡ UPS API PERFORMANCE:', {
      totalCallDuration: `${totalCallDuration}ms`,
      servicesRequested: serviceCodes.length,
      avgTimePerService: `${(totalCallDuration / serviceCodes.length).toFixed(0)}ms`,
      configId,
      timestamp: new Date().toISOString()
    });

    // Calculate overall rate type and savings
    const hasAnyNegotiatedRates = rates.some(rate => rate.hasNegotiatedRates);
    const totalSavings = rates.reduce((sum, rate) => sum + (rate.savingsAmount || 0), 0);
    const overallRateType = hasAnyNegotiatedRates ? 'negotiated' : 'published';

    // Save quote to database
    const { data: quote, error: quoteError } = await supabase
      .from('rate_quotes')
      .insert({
        user_id: user.id,
        shipment_data: shipment,
        rates: rates,
        service_codes: serviceCodes,
        total_cost: rates.reduce((sum, rate) => sum + rate.totalCharges, 0),
        rate_type: overallRateType,
        has_negotiated_rates: hasAnyNegotiatedRates,
        published_rate: rates.reduce((sum, rate) => sum + (rate.publishedRate || 0), 0),
        negotiated_rate: hasAnyNegotiatedRates ? rates.reduce((sum, rate) => sum + (rate.negotiatedRate || 0), 0) : null,
        savings_amount: totalSavings > 0 ? totalSavings : null,
        savings_percentage: totalSavings > 0 && rates.length > 0 ? (totalSavings / rates.reduce((sum, rate) => sum + (rate.publishedRate || 0), 0)) * 100 : null,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      })
      .select()
      .single();

    if (quoteError) {
      console.error('Error saving quote:', quoteError);
    }

    return new Response(JSON.stringify({
      quoteId: quote?.id,
      rates: rates.sort((a, b) => a.totalCharges - b.totalCharges), // Sort by price
      requestId: `shiprate-${Date.now()}`,
      configId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ups-rate-quote function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});