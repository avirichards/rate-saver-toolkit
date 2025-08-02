import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No auth header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Test UPS Auth - Received auth header:', authHeader.substring(0, 20) + '...');

    // Create service role client
    const serviceSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Test calling UPS auth with the user's authorization header
    console.log('Calling UPS auth function...');
    const authResponse = await serviceSupabase.functions.invoke('ups-auth', {
      body: {
        action: 'get_token',
        config_id: '56ec2c4f-d52d-4aba-90a4-33682c468484' // DropShoppr UPS config
      },
      headers: {
        Authorization: authHeader
      }
    });

    console.log('UPS auth response:', {
      error: authResponse.error,
      hasData: !!authResponse.data,
      hasToken: !!authResponse.data?.access_token
    });

    return new Response(JSON.stringify({
      success: !authResponse.error,
      hasToken: !!authResponse.data?.access_token,
      error: authResponse.error,
      data: authResponse.data
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Test error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});