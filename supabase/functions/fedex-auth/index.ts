import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Token cache - stores tokens in memory with expiration
interface CachedToken {
  access_token: string;
  expires_at: number; // Unix timestamp
  config_id: string;
  account_name: string;
  is_sandbox: boolean;
}

const tokenCache = new Map<string, CachedToken>();

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('FedEx Auth function called');
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Creating Supabase client...');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Missing Supabase environment variables:', { 
        hasUrl: !!supabaseUrl, 
        hasKey: !!supabaseAnonKey 
      });
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    console.log('Verifying user authentication...');
    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('User authentication failed:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Parsing request body...');
    const requestBody = await req.json();
    const { action, config_id } = requestBody;

    if (action === 'get_token') {
      console.log('FedEx Auth Request:', { action, config_id, userId: user.id });
      
      // Check cache first
      const cacheKey = `${user.id}_${config_id}`;
      const cachedToken = tokenCache.get(cacheKey);
      
      // Return cached token if still valid (with 5 minute buffer)
      if (cachedToken && cachedToken.expires_at > Date.now() + 300000) {
        console.log('🚀 Returning cached FedEx token for config:', config_id);
        return new Response(JSON.stringify({
          access_token: cachedToken.access_token,
          expires_in: Math.floor((cachedToken.expires_at - Date.now()) / 1000),
          is_sandbox: cachedToken.is_sandbox,
          config_id: cachedToken.config_id,
          account_name: cachedToken.account_name,
          cached: true
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Get carrier config for FedEx - with proper handling for multiple configs
      let query = supabase
        .from('carrier_configs')
        .select('*')
        .eq('user_id', user.id)
        .eq('carrier_type', 'fedex')
        .eq('is_active', true);

      // If config_id is provided, use specific config
      if (config_id) {
        query = query.eq('id', config_id);
      }
      
      const { data: carrierConfig, error: configError } = await query.maybeSingle();

      if (configError) {
        console.error('Error fetching FedEx config:', configError);
        return new Response(JSON.stringify({ 
          error: 'Error fetching FedEx configuration',
          details: configError 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!carrierConfig) {
        return new Response(JSON.stringify({ 
          error: config_id 
            ? `FedEx configuration not found for configId: ${config_id}` 
            : 'No active FedEx configuration found'
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!carrierConfig.fedex_key || !carrierConfig.fedex_password) {
        return new Response(JSON.stringify({ 
          error: 'FedEx API credentials missing',
          configId: carrierConfig.id,
          accountName: carrierConfig.account_name
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get OAuth token from FedEx
      const tokenEndpoint = carrierConfig.is_sandbox 
        ? 'https://apis-sandbox.fedex.com/oauth/token'
        : 'https://apis.fedex.com/oauth/token';

      console.log('FedEx Auth Request Details:', {
        endpoint: tokenEndpoint,
        isSandbox: carrierConfig.is_sandbox,
        configId: carrierConfig.id,
        accountName: carrierConfig.account_name,
        hasCredentials: !!(carrierConfig.fedex_key && carrierConfig.fedex_password)
      });
      
      const tokenResponse = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: carrierConfig.fedex_key,
          client_secret: carrierConfig.fedex_password
        })
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('FedEx token error:', errorText);
        
        // Try to update connection status in carrier_configs
        try {
          await supabase
            .from('carrier_configs')
            .update({ 
              connection_status: 'error',
              last_test_at: new Date().toISOString()
            })
            .eq('id', carrierConfig.id);
        } catch (updateError) {
          console.error('Failed to update connection status:', updateError);
        }
        
        return new Response(JSON.stringify({ 
          error: 'Failed to authenticate with FedEx API',
          status: tokenResponse.status,
          details: errorText,
          configId: carrierConfig.id
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const tokenData = await tokenResponse.json();
      
      // Cache the token (FedEx tokens typically last 1 hour)
      const expiresAt = Date.now() + (tokenData.expires_in * 1000);
      tokenCache.set(cacheKey, {
        access_token: tokenData.access_token,
        expires_at: expiresAt,
        config_id: carrierConfig.id,
        account_name: carrierConfig.account_name,
        is_sandbox: carrierConfig.is_sandbox
      });
      
      console.log('💾 Cached FedEx token for config:', {
        configId: carrierConfig.id,
        expiresIn: tokenData.expires_in,
        cacheKey
      });
      
      // Update connection status to success
      try {
        await supabase
          .from('carrier_configs')
          .update({ 
            connection_status: 'connected',
            last_test_at: new Date().toISOString()
          })
          .eq('id', carrierConfig.id);
      } catch (updateError) {
        console.error('Failed to update connection status:', updateError);
      }

      return new Response(JSON.stringify({
        access_token: tokenData.access_token,
        expires_in: tokenData.expires_in,
        is_sandbox: carrierConfig.is_sandbox,
        config_id: carrierConfig.id,
        account_name: carrierConfig.account_name,
        cached: false
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in fedex-auth function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});