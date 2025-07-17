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
      let config;
      
      if (config_id) {
        // Get specific carrier config by ID (new multi-carrier approach)
        const { data: carrierConfig, error: configError } = await supabase
          .from('carrier_configs')
          .select('*')
          .eq('id', config_id)
          .eq('user_id', user.id)
          .eq('carrier_type', 'ups')
          .eq('is_active', true)
          .single();

        if (configError || !carrierConfig) {
          return new Response(JSON.stringify({ error: 'UPS configuration not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        config = {
          client_id: carrierConfig.ups_client_id,
          client_secret: carrierConfig.ups_client_secret,
          account_number: carrierConfig.ups_account_number,
          is_sandbox: carrierConfig.is_sandbox
        };
      } else {
        // Fallback to legacy ups_configs table for backward compatibility
        const { data: legacyConfig, error: configError } = await supabase
          .from('ups_configs')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .single();

        if (configError || !legacyConfig) {
          return new Response(JSON.stringify({ error: 'UPS configuration not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        config = legacyConfig;
      }

      // Get OAuth token from UPS
      const tokenEndpoint = config.is_sandbox 
        ? 'https://wwwcie.ups.com/security/v1/oauth/token'
        : 'https://onlinetools.ups.com/security/v1/oauth/token';

      const credentials = btoa(`${config.client_id}:${config.client_secret}`);
      
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
        is_sandbox: config.is_sandbox 
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