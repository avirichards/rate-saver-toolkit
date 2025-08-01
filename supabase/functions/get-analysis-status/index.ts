import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get the user from the auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: corsHeaders }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authorization token' }),
        { status: 401, headers: corsHeaders }
      );
    }

    if (req.method !== 'GET') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: corsHeaders }
      );
    }

    const url = new URL(req.url);
    const jobId = url.searchParams.get('jobId');
    
    if (!jobId) {
      return new Response(
        JSON.stringify({ error: 'Missing jobId parameter' }),
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`Getting status for analysis job ${jobId}`);

    // Get analysis job status
    const { data: job, error: jobError } = await supabase
      .from('analysis_jobs')
      .select('total_shipments, processed_shipments, status, created_at, updated_at')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single();

    if (jobError || !job) {
      console.error('Error fetching analysis job:', jobError);
      return new Response(
        JSON.stringify({ error: 'Analysis job not found' }),
        { status: 404, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        total_shipments: job.total_shipments,
        processed_shipments: job.processed_shipments,
        status: job.status,
        created_at: job.created_at,
        updated_at: job.updated_at,
        progress_percentage: job.total_shipments > 0 
          ? Math.round((job.processed_shipments / job.total_shipments) * 100)
          : 0
      }),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );

  } catch (error) {
    console.error('Error in get-analysis-status function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    );
  }
});