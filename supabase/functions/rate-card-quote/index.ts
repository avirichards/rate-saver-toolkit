import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ShipmentRequest {
  from: {
    postal_code: string;
    country_code: string;
    state_province_code?: string;
  };
  to: {
    postal_code: string;
    country_code: string;
    state_province_code?: string;
  };
  packages: Array<{
    weight: number;
    dimensions?: {
      length: number;
      width: number;
      height: number;
    };
  }>;
  serviceTypes: string[];
  isResidential?: boolean;
}

interface RateCardRate {
  service_code: string;
  service_name: string;
  zone: string;
  weight_break: number;
  rate_amount: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify JWT token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      throw new Error('Invalid authentication');
    }

    // Parse request body
    const { shipment, configId }: { shipment: ShipmentRequest; configId: string } = await req.json();

    console.log('Rate card quote request:', { shipment, configId });

    // Get carrier config
    const { data: carrierConfig, error: configError } = await supabase
      .from('carrier_configs')
      .select('*')
      .eq('id', configId)
      .eq('user_id', user.id)
      .eq('is_rate_card', true)
      .single();

    if (configError || !carrierConfig) {
      throw new Error('Rate card configuration not found');
    }

    // Get rate card rates for this configuration
    const { data: rates, error: ratesError } = await supabase
      .from('rate_card_rates')
      .select('*')
      .eq('carrier_config_id', configId);

    if (ratesError) {
      throw new Error('Failed to load rate card rates');
    }

    if (!rates || rates.length === 0) {
      throw new Error('No rates found for this rate card');
    }

    // Calculate zone based on postal codes (simplified zone calculation)
    const zone = calculateZone(shipment.from.postal_code, shipment.to.postal_code);
    
    // Calculate billable weight
    const billableWeight = calculateBillableWeight(
      shipment.packages,
      carrierConfig.dimensional_divisor || 166
    );

    console.log('Calculated zone:', zone, 'Billable weight:', billableWeight);

    // Find applicable rates for each requested service
    const quoteResults = [];
    for (const serviceCode of shipment.serviceTypes) {
      const serviceRates = rates.filter(r => 
        r.service_code === serviceCode && 
        r.zone === zone
      ).sort((a, b) => a.weight_break - b.weight_break);

      if (serviceRates.length === 0) {
        console.warn(`No rates found for service ${serviceCode} in zone ${zone}`);
        continue;
      }

      // Find the appropriate rate based on weight breaks
      let applicableRate: RateCardRate | null = null;
      for (const rate of serviceRates) {
        if (billableWeight >= rate.weight_break) {
          applicableRate = rate;
        } else {
          break;
        }
      }

      if (!applicableRate) {
        // Use the first rate if weight is below all breaks
        applicableRate = serviceRates[0];
      }

      console.log('Found applicable rate:', applicableRate);

      // Calculate total cost with fuel surcharge
      const baseRate = applicableRate.rate_amount * Math.ceil(billableWeight);
      const fuelSurcharge = carrierConfig.fuel_surcharge_percent || 0;
      const fuelAmount = baseRate * (fuelSurcharge / 100);
      const totalCharges = baseRate + fuelAmount;

      const quote = {
        service_code: serviceCode,
        service_name: applicableRate.service_name || serviceCode,
        total_charges: totalCharges,
        base_charges: baseRate,
        fuel_surcharge: fuelAmount,
        fuel_surcharge_percent: fuelSurcharge,
        currency: 'USD',
        billable_weight: billableWeight,
        zone: zone,
        rate_per_lb: applicableRate.rate_amount,
        carrier_account_name: carrierConfig.account_name,
        is_rate_card: true,
        dimensional_divisor: carrierConfig.dimensional_divisor,
        raw_response: {
          rate_card_rate: applicableRate,
          calculated_weight: billableWeight,
          zone: zone
        }
      };

      quoteResults.push(quote);
    }

    console.log('Rate card quotes generated:', quoteResults.length);

    return new Response(
      JSON.stringify({
        success: true,
        rates: quoteResults,
        account_name: carrierConfig.account_name,
        carrier_type: carrierConfig.carrier_type,
        is_rate_card: true
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error: any) {
    console.error('Rate card quote error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        status: 400,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});

// Helper functions
function calculateZone(fromZip: string, toZip: string): string {
  // Simplified zone calculation - in reality this would use carrier zone charts
  const fromZipNum = parseInt(fromZip.substring(0, 3));
  const toZipNum = parseInt(toZip.substring(0, 3));
  const distance = Math.abs(fromZipNum - toZipNum);
  
  if (distance < 50) return '2';
  if (distance < 150) return '3';
  if (distance < 300) return '4';
  if (distance < 600) return '5';
  if (distance < 1000) return '6';
  if (distance < 1400) return '7';
  return '8';
}

function calculateBillableWeight(packages: any[], dimensionalDivisor: number): number {
  let totalActualWeight = 0;
  let totalDimensionalWeight = 0;

  for (const pkg of packages) {
    totalActualWeight += pkg.weight;
    
    if (pkg.dimensions) {
      const dimWeight = (pkg.dimensions.length * pkg.dimensions.width * pkg.dimensions.height) / dimensionalDivisor;
      totalDimensionalWeight += dimWeight;
    }
  }

  // Use the greater of actual weight or dimensional weight
  return Math.max(totalActualWeight, totalDimensionalWeight);
}