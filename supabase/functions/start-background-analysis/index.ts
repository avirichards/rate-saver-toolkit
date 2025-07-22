
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AnalysisRequest {
  csvUploadId: string;
  userId: string;
  mappings: Record<string, string>;
  serviceMappings: any[];
  carrierConfigs: string[];
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

    const payload: AnalysisRequest = await req.json()
    
    console.log('Starting background analysis:', {
      csvUploadId: payload.csvUploadId,
      userId: payload.userId,
      carrierConfigs: payload.carrierConfigs.length,
      serviceMappings: payload.serviceMappings.length
    })

    // Fetch CSV data
    const { data: csvUpload, error: csvError } = await supabase
      .from('csv_uploads')
      .select('csv_content, file_name, row_count')
      .eq('id', payload.csvUploadId)
      .eq('user_id', payload.userId)
      .single()

    if (csvError || !csvUpload) {
      throw new Error('CSV upload not found')
    }

    // Parse CSV data
    const csvLines = csvUpload.csv_content.split('\n').filter(line => line.trim())
    const headers = csvLines[0].split(',').map(h => h.trim().replace(/"/g, ''))
    const shipmentData = csvLines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''))
      const shipment: any = {}
      headers.forEach((header, index) => {
        const mappedField = payload.mappings[header] || header
        shipment[mappedField] = values[index] || ''
      })
      return shipment
    })

    // Create initial analysis record
    const analysisRecord = {
      user_id: payload.userId,
      csv_upload_id: payload.csvUploadId,
      file_name: csvUpload.file_name,
      original_data: shipmentData,
      carrier_configs_used: payload.carrierConfigs,
      service_mappings: payload.serviceMappings,
      total_shipments: shipmentData.length,
      status: 'processing',
      processing_metadata: {
        startedAt: new Date().toISOString(),
        currentShipment: 0,
        completedShipments: 0,
        errorShipments: 0,
        progressPercentage: 0,
        batchSize: 10
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
    EdgeRuntime.waitUntil(processAnalysisInBackground(supabase, analysisId, shipmentData, payload, token))

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

async function processAnalysisInBackground(supabase: any, analysisId: string, shipmentData: any[], payload: AnalysisRequest, authToken: string) {
  try {
    console.log(`Starting background processing for analysis ${analysisId}`)
    
    const recommendations: any[] = []
    const orphanedShipments: any[] = []
    let totalCurrentCost = 0
    let totalPotentialSavings = 0
    let completedShipments = 0
    let errorShipments = 0
    
    const BATCH_SIZE = 10
    const MAX_RETRIES = 2

    // Process shipments in batches
    for (let batchStart = 0; batchStart < shipmentData.length; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, shipmentData.length)
      const batch = shipmentData.slice(batchStart, batchEnd)
      
      console.log(`Processing batch ${batchStart + 1}-${batchEnd} of ${shipmentData.length}`)
      
      // Process each shipment in the batch
      for (let i = 0; i < batch.length; i++) {
        const shipmentIndex = batchStart + i
        const shipment = batch[i]
        
        let retryCount = 0
        let processed = false
        
        while (!processed && retryCount <= MAX_RETRIES) {
          try {
            // Update progress
            await updateProgress(supabase, analysisId, {
              currentShipment: shipmentIndex + 1,
              completedShipments,
              errorShipments,
              progressPercentage: Math.round(((shipmentIndex + 1) / shipmentData.length) * 100)
            })

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
              processed = true
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
              carrierConfigIds: payload.carrierConfigs,
              serviceTypes: [serviceMapping.standardizedService],
              equivalentServiceCode: serviceMapping.standardizedService,
              isResidential: shipment.isResidential || false,
              residentialSource: 'analysis',
              analysisId: analysisId,
              shipmentIndex: shipmentIndex
            }

            // Call multi-carrier-quote function with proper auth
            const { data: quoteData, error: quoteError } = await supabase.functions.invoke('multi-carrier-quote', {
              body: { shipment: shipmentRequest },
              headers: {
                Authorization: `Bearer ${authToken}`
              }
            })

            if (quoteError || !quoteData?.success) {
              throw new Error(quoteError?.message || 'Failed to get rates')
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
              processed = true
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
                trackingId: shipment.trackingId || `Shipment-${shipmentIndex + 1}`,
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
            processed = true

          } catch (error) {
            retryCount++
            console.error(`Error processing shipment ${shipmentIndex + 1} (attempt ${retryCount}):`, error)
            
            if (retryCount > MAX_RETRIES) {
              orphanedShipments.push({
                shipment,
                error: error.message,
                errorType: 'PROCESSING_ERROR',
                originalService: shipment.service
              })
              errorShipments++
              processed = true
            } else {
              // Wait before retry
              await new Promise(resolve => setTimeout(resolve, 1000 * retryCount))
            }
          }
        }
      }
      
      // Update progress after each batch
      await updateProgress(supabase, analysisId, {
        currentShipment: batchEnd,
        completedShipments,
        errorShipments,
        progressPercentage: Math.round((batchEnd / shipmentData.length) * 100),
        processed_shipments: recommendations.map((rec, index) => ({
          id: index + 1,
          trackingId: rec.shipment.trackingId,
          originZip: rec.shipment.originZip,
          destinationZip: rec.shipment.destZip,
          weight: parseFloat(rec.shipment.weight || '0'),
          carrier: rec.carrier,
          service: rec.originalService,
          currentRate: rec.currentCost,
          newRate: rec.recommendedCost,
          savings: rec.savings,
          savingsPercent: rec.savingsPercent
        })),
        orphaned_shipments: orphanedShipments.map((orphan, index) => ({
          id: completedShipments + index + 1,
          trackingId: orphan.shipment.trackingId || `Orphan-${index + 1}`,
          originZip: orphan.shipment.originZip || '',
          destinationZip: orphan.shipment.destZip || '',
          weight: parseFloat(orphan.shipment.weight || '0'),
          service: orphan.originalService || orphan.shipment.service || 'Unknown',
          error: orphan.error,
          errorType: orphan.errorType,
          errorCategory: 'Processing Error'
        }))
      })
    }

    // Final completion
    const finalData = {
      status: 'completed',
      total_savings: totalPotentialSavings,
      recommendations,
      processed_shipments: recommendations.map((rec, index) => ({
        id: index + 1,
        trackingId: rec.shipment.trackingId,
        originZip: rec.shipment.originZip,
        destinationZip: rec.shipment.destZip,
        weight: parseFloat(rec.shipment.weight || '0'),
        carrier: rec.carrier,
        service: rec.originalService,
        currentRate: rec.currentCost,
        newRate: rec.recommendedCost,
        savings: rec.savings,
        savingsPercent: rec.savingsPercent
      })),
      orphaned_shipments: orphanedShipments.map((orphan, index) => ({
        id: completedShipments + index + 1,
        trackingId: orphan.shipment.trackingId || `Orphan-${index + 1}`,
        originZip: orphan.shipment.originZip || '',
        destinationZip: orphan.shipment.destZip || '',
        weight: parseFloat(orphan.shipment.weight || '0'),
        service: orphan.originalService || orphan.shipment.service || 'Unknown',
        error: orphan.error,
        errorType: orphan.errorType,
        errorCategory: 'Processing Error'
      })),
      savings_analysis: {
        totalCurrentCost,
        totalPotentialSavings,
        savingsPercentage: totalCurrentCost > 0 ? (totalPotentialSavings / totalCurrentCost) * 100 : 0,
        totalShipments: shipmentData.length,
        completedShipments,
        errorShipments
      },
      processing_metadata: {
        completedAt: new Date().toISOString(),
        totalShipments: shipmentData.length,
        completedShipments,
        errorShipments,
        progressPercentage: 100
      }
    }

    await supabase
      .from('shipping_analyses')
      .update(finalData)
      .eq('id', analysisId)

    console.log(`Successfully completed analysis ${analysisId}`)

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
    const updateData: any = {
      processing_metadata: {
        ...progress,
        updatedAt: new Date().toISOString()
      }
    }

    // Include data updates if provided
    if (progress.processed_shipments) {
      updateData.processed_shipments = progress.processed_shipments
    }
    if (progress.orphaned_shipments) {
      updateData.orphaned_shipments = progress.orphaned_shipments
    }

    await supabase
      .from('shipping_analyses')
      .update(updateData)
      .eq('id', analysisId)
  } catch (error) {
    console.error('Error updating progress:', error)
  }
}
