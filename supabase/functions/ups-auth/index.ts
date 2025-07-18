import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const { action, config_id } = await req.json();

      if (action === 'get_token') {
        // Get carrier config for UPS - handle multiple configs
        let query = supabase
          .from('carrier_configs')
          .select('*')
          .eq('user_id', user.id)
          .eq('carrier_type', 'ups')
          .eq('is_active', true);

        // If config_id is provided, use specific config, otherwise get the first one
        if (config_id) {
          query = query.eq('id', config_id);
        }
        
        const { data: carrierConfig, error: configError } = await query.maybeSingle();

        if (configError || !carrierConfig) {
          return new Response(JSON.stringify({ error: 'UPS configuration not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Get OAuth token from UPS
        const tokenEndpoint = carrierConfig.is_sandbox 
          ? 'https://wwwcie.ups.com/security/v1/oauth/token'
          : 'https://onlinetools.ups.com/security/v1/oauth/token';

        const credentials = btoa(`${carrierConfig.ups_client_id}:${carrierConfig.ups_client_secret}`);
        
        const tokenResponse = await fetch(tokenEndpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: 'grant_type=client_credentials',
        });

        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text();
          console.error('UPS token error:', errorText);
          return new Response(JSON.stringify({ error: 'Failed to authenticate with UPS' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const tokenData = await tokenResponse.json();
        
        return new Response(JSON.stringify({ 
          access_token: tokenData.access_token,
          expires_in: tokenData.expires_in,
          is_sandbox: carrierConfig.is_sandbox,
          config_id: carrierConfig.id
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ups-auth function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});