
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AnalysisPayload {
  fileName: string;
  originalData: any[];
  carrierConfigIds: string[];
  serviceMappings: any[];
  clientId?: string;
  reportName?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get user from JWT token
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      throw new Error('Invalid authentication')
    }

    const payload: AnalysisPayload = await req.json()
    
    console.log('Starting background analysis:', {
      fileName: payload.fileName,
      totalShipments: payload.originalData.length,
      carrierConfigs: payload.carrierConfigIds.length
    })

    // Create initial analysis record with processing status
    const analysisRecord = {
      user_id: user.id,
      file_name: payload.fileName,
      report_name: payload.reportName || payload.fileName,
      client_id: payload.clientId || null,
      original_data: payload.originalData,
      carrier_configs_used: payload.carrierConfigIds,
      service_mappings: payload.serviceMappings,
      total_shipments: payload.originalData.length,
      status: 'processing',
      processing_metadata: {
        startedAt: new Date().toISOString(),
        currentShipment: 0,
        completedShipments: 0,
        errorShipments: 0,
        progressPercentage: 0
      }
    }

    const { data: analysis, error: createError } = await supabase
      .from('shipping_analyses')
      .insert(analysisRecord)
      .select('id')
      .single()

    if (createError || !analysis) {
      throw new Error(`Failed to create analysis record: ${createError?.message}`)
    }

    const analysisId = analysis.id
    console.log('Created analysis record with ID:', analysisId)

    // Start background processing
    EdgeRuntime.waitUntil(processAnalysisInBackground(supabase, analysisId, payload, user.id))

    // Return immediately with analysis ID
    return new Response(
      JSON.stringify({ 
        success: true, 
        analysisId,
        message: 'Background analysis started'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error starting background analysis:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

async function processAnalysisInBackground(supabase: any, analysisId: string, payload: AnalysisPayload, userId: string) {
  try {
    console.log(`Starting background processing for analysis ${analysisId}`)
    
    const recommendations: any[] = []
    const orphanedShipments: any[] = []
    let totalCurrentCost = 0
    let totalPotentialSavings = 0
    let completedShipments = 0
    let errorShipments = 0

    // Process each shipment
    for (let i = 0; i < payload.originalData.length; i++) {
      const shipment = payload.originalData[i]
      
      try {
        // Update progress
        await updateProgress(supabase, analysisId, {
          currentShipment: i + 1,
          completedShipments,
          errorShipments,
          progressPercentage: Math.round(((i + 1) / payload.originalData.length) * 100)
        })

        console.log(`Processing shipment ${i + 1}/${payload.originalData.length}`)

        // Find service mapping
        const serviceMapping = payload.serviceMappings.find(
          mapping => mapping.originalService === shipment.service
        )

        if (!serviceMapping) {
          orphanedShipments.push({
            shipment,
            error: 'No service mapping found',
            errorType: 'SERVICE_MAPPING_NOT_FOUND',
            originalService: shipment.service
          })
          errorShipments++
          continue
        }

        // Build shipment request for multi-carrier quote
        const shipmentRequest = {
          shipFrom: {
            name: shipment.shipperName || 'Shipper',
            address: shipment.shipperAddress || '123 Main St',
            city: shipment.shipperCity || 'City',
            state: shipment.shipperState || 'State',
            zipCode: shipment.originZip,
            country: 'US'
          },
          shipTo: {
            name: shipment.recipientName || 'Recipient', 
            address: shipment.recipientAddress || '123 Main St',
            city: shipment.recipientCity || 'City',
            state: shipment.recipientState || 'State',
            zipCode: shipment.destZip,
            country: 'US'
          },
          package: {
            weight: parseFloat(shipment.weight || '1'),
            weightUnit: 'LBS',
            length: 12,
            width: 12,
            height: 6,
            dimensionUnit: 'IN'
          },
          carrierConfigIds: payload.carrierConfigIds,
          serviceTypes: [serviceMapping.standardizedService],
          equivalentServiceCode: serviceMapping.standardizedService,
          isResidential: shipment.isResidential || false,
          residentialSource: 'analysis'
        }

        // Call multi-carrier-quote function
        const { data: quoteData, error: quoteError } = await supabase.functions.invoke('multi-carrier-quote', {
          body: { shipment: shipmentRequest }
        })

        if (quoteError || !quoteData?.success) {
          console.error(`Quote error for shipment ${i + 1}:`, quoteError)
          orphanedShipments.push({
            shipment,
            error: quoteError?.message || 'Failed to get rates',
            errorType: 'QUOTE_ERROR',
            originalService: shipment.service
          })
          errorShipments++
          continue
        }

        // Process quote results
        const bestRates = quoteData.bestRates || []
        const allRates = quoteData.allRates || []

        if (bestRates.length === 0) {
          orphanedShipments.push({
            shipment,
            error: 'No rates returned',
            errorType: 'NO_RATES',
            originalService: shipment.service
          })
          errorShipments++
          continue
        }

        // Find best rate
        const bestRate = bestRates[0]
        const currentCost = parseFloat(shipment.cost || '0')
        const recommendedCost = bestRate.totalCharges || 0
        const savings = Math.max(0, currentCost - recommendedCost)

        totalCurrentCost += currentCost
        totalPotentialSavings += savings

        // Create recommendation
        recommendations.push({
          shipment: {
            trackingId: shipment.trackingId || `Shipment-${i + 1}`,
            originZip: shipment.originZip,
            destZip: shipment.destZip,
            weight: shipment.weight,
            service: shipment.service
          },
          carrier: bestRate.carrierType || 'UPS',
          originalService: shipment.service,
          recommendedService: bestRate.serviceName,
          currentCost,
          recommendedCost,
          savings,
          savingsPercent: currentCost > 0 ? (savings / currentCost) * 100 : 0,
          allRates,
          upsRates: allRates.filter(r => r.carrierType === 'ups')
        })

        completedShipments++

      } catch (error) {
        console.error(`Error processing shipment ${i + 1}:`, error)
        orphanedShipments.push({
          shipment,
          error: error.message,
          errorType: 'PROCESSING_ERROR',
          originalService: shipment.service
        })
        errorShipments++
      }
    }

    // Final progress update
    await updateProgress(supabase, analysisId, {
      currentShipment: payload.originalData.length,
      completedShipments,
      errorShipments,
      progressPercentage: 100,
      status: 'finalizing'
    })

    console.log(`Completed processing for analysis ${analysisId}:`, {
      total: payload.originalData.length,
      completed: completedShipments,
      errors: errorShipments,
      totalSavings: totalPotentialSavings
    })

    // Call finalize-analysis to save final results
    const finalizePayload = {
      fileName: payload.fileName,
      totalShipments: payload.originalData.length,
      completedShipments,
      errorShipments,
      totalCurrentCost,
      totalPotentialSavings,
      recommendations,
      orphanedShipments,
      originalData: payload.originalData,
      carrierConfigsUsed: payload.carrierConfigIds,
      serviceMappings: payload.serviceMappings
    }

    const { data: finalizeData, error: finalizeError } = await supabase.functions.invoke('finalize-analysis', {
      body: finalizePayload,
      headers: {
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      }
    })

    if (finalizeError) {
      console.error('Error finalizing analysis:', finalizeError)
      await supabase
        .from('shipping_analyses')
        .update({ 
          status: 'failed',
          processing_metadata: {
            error: finalizeError.message,
            failedAt: new Date().toISOString()
          }
        })
        .eq('id', analysisId)
    } else {
      console.log(`Successfully finalized analysis ${analysisId}`)
    }

  } catch (error) {
    console.error(`Background processing failed for analysis ${analysisId}:`, error)
    
    // Update analysis status to failed
    await supabase
      .from('shipping_analyses')
      .update({ 
        status: 'failed',
        processing_metadata: {
          error: error.message,
          failedAt: new Date().toISOString()
        }
      })
      .eq('id', analysisId)
  }
}

async function updateProgress(supabase: any, analysisId: string, progress: any) {
  try {
    await supabase
      .from('shipping_analyses')
      .update({ 
        processing_metadata: {
          ...progress,
          updatedAt: new Date().toISOString()
        }
      })
      .eq('id', analysisId)
  } catch (error) {
    console.error('Error updating progress:', error)
  }
}
