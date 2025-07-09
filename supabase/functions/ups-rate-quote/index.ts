import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.4';

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

    // Get UPS access token
    const tokenResponse = await supabase.functions.invoke('ups-auth', {
      body: { action: 'get_token' },
    });

    if (tokenResponse.error) {
      return new Response(JSON.stringify({ error: 'Failed to authenticate with UPS' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { access_token, is_sandbox } = tokenResponse.data;

    // Build UPS Rating API request
    const ratingEndpoint = is_sandbox
      ? 'https://wwwcie.ups.com/api/rating/v1/Rate'
      : 'https://onlinetools.ups.com/api/rating/v1/Rate';

    const ratingRequest = {
      RateRequest: {
        Request: {
          RequestOption: "Rate",
          TransactionReference: {
            CustomerContext: `ShipRate-${Date.now()}`
          }
        },
        Shipment: {
          Shipper: {
            Name: shipment.shipFrom.name,
            ShipperNumber: "", // Will be filled from UPS config
            Address: {
              AddressLine: [shipment.shipFrom.address],
              City: shipment.shipFrom.city,
              StateProvinceCode: shipment.shipFrom.state,
              PostalCode: shipment.shipFrom.zipCode,
              CountryCode: shipment.shipFrom.country
            }
          },
          ShipTo: {
            Name: shipment.shipTo.name,
            Address: {
              AddressLine: [shipment.shipTo.address],
              City: shipment.shipTo.city,
              StateProvinceCode: shipment.shipTo.state,
              PostalCode: shipment.shipTo.zipCode,
              CountryCode: shipment.shipTo.country
            }
          },
          ShipFrom: {
            Name: shipment.shipFrom.name,
            Address: {
              AddressLine: [shipment.shipFrom.address],
              City: shipment.shipFrom.city,
              StateProvinceCode: shipment.shipFrom.state,
              PostalCode: shipment.shipFrom.zipCode,
              CountryCode: shipment.shipFrom.country
            }
          },
          Service: {
            Code: "03", // Default to Ground, will iterate through services
          },
          Package: [{
            PackagingType: {
              Code: shipment.package.packageType || "02", // Customer Supplied Package
            },
            Dimensions: shipment.package.length ? {
              UnitOfMeasurement: {
                Code: shipment.package.dimensionUnit || "IN"
              },
              Length: shipment.package.length.toString(),
              Width: shipment.package.width?.toString() || "1",
              Height: shipment.package.height?.toString() || "1"
            } : undefined,
            PackageWeight: {
              UnitOfMeasurement: {
                Code: shipment.package.weightUnit || "LBS"
              },
              Weight: shipment.package.weight.toString()
            }
          }]
        }
      }
    };

    // Get UPS account number
    const { data: config } = await supabase
      .from('ups_configs')
      .select('account_number')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (config?.account_number) {
      ratingRequest.RateRequest.Shipment.Shipper.ShipperNumber = config.account_number;
    }

    // Service codes to quote
    const serviceCodes = shipment.serviceTypes || ['01', '02', '03', '12', '13'];
    const rates = [];

    // Get rates for each service type
    for (const serviceCode of serviceCodes) {
      try {
        ratingRequest.RateRequest.Shipment.Service.Code = serviceCode;

        const response = await fetch(ratingEndpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${access_token}`,
            'Content-Type': 'application/json',
            'transId': `shiprate-${Date.now()}`,
            'transactionSrc': 'ShipRate Pro'
          },
          body: JSON.stringify(ratingRequest)
        });

        if (response.ok) {
          const rateData = await response.json();
          
          if (rateData.RateResponse?.RatedShipment) {
            const ratedShipment = rateData.RateResponse.RatedShipment;
            
            // Get service name
            const { data: service } = await supabase
              .from('ups_services')
              .select('service_name, description')
              .eq('service_code', serviceCode)
              .single();

            rates.push({
              serviceCode,
              serviceName: service?.service_name || `UPS Service ${serviceCode}`,
              description: service?.description || '',
              totalCharges: parseFloat(ratedShipment.TotalCharges?.MonetaryValue || '0'),
              currency: ratedShipment.TotalCharges?.CurrencyCode || 'USD',
              baseCharges: parseFloat(ratedShipment.BaseServiceCharge?.MonetaryValue || '0'),
              transitTime: ratedShipment.GuaranteedDelivery?.BusinessDaysInTransit || null,
              deliveryDate: ratedShipment.GuaranteedDelivery?.DeliveryByTime || null
            });
          }
        }
      } catch (error) {
        console.error(`Error getting rate for service ${serviceCode}:`, error);
      }
    }

    // Save quote to database
    const { data: quote, error: quoteError } = await supabase
      .from('rate_quotes')
      .insert({
        user_id: user.id,
        shipment_data: shipment,
        rates: rates,
        service_codes: serviceCodes,
        total_cost: rates.reduce((sum, rate) => sum + rate.totalCharges, 0),
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
      requestId: `shiprate-${Date.now()}`
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