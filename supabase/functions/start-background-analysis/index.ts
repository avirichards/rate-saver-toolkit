import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnalysisRequest {
  csvUploadId: string;
  userId: string;
  mappings: Record<string, string>;
  serviceMappings: any[];
  carrierConfigs: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error('Invalid authentication');

    const payload: AnalysisRequest = await req.json();

    // fetch and parse CSV
    const { data: csvUpload, error: csvError } = await supabase
      .from('csv_uploads')
      .select('csv_content, file_name')
      .eq('id', payload.csvUploadId)
      .eq('user_id', payload.userId)
      .single();

    if (csvError || !csvUpload) throw new Error('CSV upload not found');

    const lines = csvUpload.csv_content.split('\n').filter(l => l.trim());
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g,''));
    const shipmentData = lines.slice(1).map(line => {
      const cols = line.split(',').map(c => c.trim().replace(/"/g,''));
      const obj: any = {};
      headers.forEach((h,i) => obj[payload.mappings[h]||h] = cols[i]||'');
      return obj;
    });

    // insert initial analysis record
    const { data: analysis, error: createError } = await supabase
      .from('shipping_analyses')
      .insert({
        user_id: payload.userId,
        csv_upload_id: payload.csvUploadId,
        file_name: csvUpload.file_name,
        original_data: shipmentData,
        carrier_configs_used: payload.carrierConfigs,
        service_mappings: payload.serviceMappings,
        total_shipments: shipmentData.length,
        status: 'processing',
        processing_metadata: { startedAt: new Date().toISOString() }
      })
      .select('id')
      .single();

    if (createError || !analysis) throw new Error(createError?.message);

    const analysisId = analysis.id;

    // fire-and-forget background work
    processAnalysisInBackground(supabase, analysisId, shipmentData, payload, token)
      .catch(err => console.error('Background processing error:', err));

    return new Response(
      JSON.stringify({ success: true, analysisId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('Error:', err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function processAnalysisInBackground(
  supabase: any,
  analysisId: string,
  shipmentData: any[],
  payload: AnalysisRequest,
  token: string
) {
  try {
    const processedShipments: any[] = [];
    const orphanedShipments: any[] = [];
    let completedCount = 0;
    let errorCount = 0;

    // Process shipments in batches of 10
    const batchSize = 10;
    for (let i = 0; i < shipmentData.length; i += batchSize) {
      const batch = shipmentData.slice(i, i + batchSize);
      
      for (const shipment of batch) {
        try {
          // Call multi-carrier-quote for each shipment
          const { data: quoteData, error: quoteError } = await supabase.functions.invoke(
            'multi-carrier-quote',
            {
              body: {
                origin: {
                  postalCode: shipment.origin_zip || shipment.origin_postal_code,
                  countryCode: shipment.origin_country || 'US',
                  stateProvinceCode: shipment.origin_state
                },
                destination: {
                  postalCode: shipment.destination_zip || shipment.destination_postal_code,
                  countryCode: shipment.destination_country || 'US',
                  stateProvinceCode: shipment.destination_state
                },
                package: {
                  weight: parseFloat(shipment.weight) || 1,
                  length: parseFloat(shipment.length) || 12,
                  width: parseFloat(shipment.width) || 12,
                  height: parseFloat(shipment.height) || 12
                },
                carrierConfigs: payload.carrierConfigs
              },
              headers: { Authorization: `Bearer ${token}` }
            }
          );

          if (!quoteError && quoteData?.bestRates?.length > 0) {
            const bestRate = quoteData.bestRates[0];
            processedShipments.push({
              ...shipment,
              shipmentIndex: processedShipments.length,
              bestRate: bestRate,
              currentCost: parseFloat(shipment.current_cost || shipment.cost || '0'),
              savings: Math.max(0, parseFloat(shipment.current_cost || shipment.cost || '0') - bestRate.totalCharges),
              allRates: quoteData.allRates || []
            });
            completedCount++;
          } else {
            orphanedShipments.push({
              ...shipment,
              error: quoteError?.message || 'No rates available'
            });
            errorCount++;
          }
        } catch (error: any) {
          orphanedShipments.push({
            ...shipment,
            error: error.message || 'Processing failed'
          });
          errorCount++;
        }
      }

      // Update progress after each batch
      await updateProgress(supabase, analysisId, {
        completedShipments: completedCount,
        errorShipments: errorCount,
        totalShipments: shipmentData.length,
        processedShipments,
        orphanedShipments,
        lastUpdated: new Date().toISOString()
      });
    }

    // Calculate final totals
    const totalSavings = processedShipments.reduce((sum, s) => sum + (s.savings || 0), 0);
    const totalCurrentCost = processedShipments.reduce((sum, s) => sum + (s.currentCost || 0), 0);

    // Final update with completed status
    await supabase
      .from('shipping_analyses')
      .update({
        status: 'completed',
        processed_shipments: processedShipments,
        orphaned_shipments: orphanedShipments,
        total_savings: totalSavings,
        processing_metadata: {
          completedShipments: completedCount,
          errorShipments: errorCount,
          totalShipments: shipmentData.length,
          totalCurrentCost,
          savingsPercentage: totalCurrentCost > 0 ? (totalSavings / totalCurrentCost) * 100 : 0,
          completedAt: new Date().toISOString()
        }
      })
      .eq('id', analysisId);

    console.log(`Analysis ${analysisId} completed successfully`);
  } catch (error: any) {
    console.error(`Analysis ${analysisId} failed:`, error);
    
    // Mark as failed
    await supabase
      .from('shipping_analyses')
      .update({
        status: 'failed',
        processing_metadata: {
          error: error.message,
          failedAt: new Date().toISOString()
        }
      })
      .eq('id', analysisId);
  }
}

async function updateProgress(supabase: any, analysisId: string, progress: any) {
  try {
    await supabase
      .from('shipping_analyses')
      .update({
        processed_shipments: progress.processedShipments,
        orphaned_shipments: progress.orphanedShipments,
        processing_metadata: progress
      })
      .eq('id', analysisId);
  } catch (error) {
    console.error('Failed to update progress:', error);
  }
}