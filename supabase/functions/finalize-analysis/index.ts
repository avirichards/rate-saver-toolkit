
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AnalysisPayload {
  fileName: string;
  totalShipments: number;
  completedShipments: number;
  errorShipments: number;
  totalCurrentCost: number;
  totalPotentialSavings: number;
  recommendations: any[];
  orphanedShipments: any[];
  originalData: any[];
  carrierConfigsUsed: string[];
  serviceMappings?: any[];
}

Deno.serve(async (req) => {
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
    
    console.log('Finalizing analysis:', {
      fileName: payload.fileName,
      totalShipments: payload.totalShipments,
      completedShipments: payload.completedShipments,
      errorShipments: payload.errorShipments,
      totalSavings: payload.totalPotentialSavings
    })

    // Check for existing analysis with smart duplicate detection
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const { data: existingAnalyses } = await supabase
      .from('shipping_analyses')
      .select('id, file_name, created_at, total_shipments, processed_shipments, recommendations, status')
      .eq('user_id', user.id)
      .eq('file_name', payload.fileName)
      .eq('total_shipments', payload.totalShipments)
      .gte('created_at', fiveMinutesAgo)
      .order('created_at', { ascending: false })

    if (existingAnalyses && existingAnalyses.length > 0) {
      const existingAnalysis = existingAnalyses[0]
      console.log('Found existing analysis:', {
        id: existingAnalysis.id,
        status: existingAnalysis.status,
        hasProcessedShipments: existingAnalysis.processed_shipments && Array.isArray(existingAnalysis.processed_shipments) && existingAnalysis.processed_shipments.length > 0,
        hasRecommendations: existingAnalysis.recommendations && Array.isArray(existingAnalysis.recommendations) && existingAnalysis.recommendations.length > 0
      })

      // Check if existing analysis has complete data
      const hasCompleteData = (
        existingAnalysis.processed_shipments && 
        Array.isArray(existingAnalysis.processed_shipments) && 
        existingAnalysis.processed_shipments.length > 0
      ) || (
        existingAnalysis.recommendations && 
        Array.isArray(existingAnalysis.recommendations) && 
        existingAnalysis.recommendations.length > 0
      )

      if (hasCompleteData) {
        console.log('Existing analysis has complete data, returning existing ID:', existingAnalysis.id)
        return new Response(
          JSON.stringify({ 
            success: true, 
            analysisId: existingAnalysis.id,
            message: 'Analysis already exists with complete data'
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      } else {
        console.log('Existing analysis is incomplete, will update with complete data')
        // Continue to update the incomplete analysis with complete data
      }
    }

    // Filter out shipments that should be orphaned (missing service type or no rates)
    const validRecommendations = payload.recommendations.filter(rec => {
      const service = rec.customer_service || rec.shipment.service || '';
      const hasValidService = service && service.trim() !== '' && service !== 'Unknown';
      const hasRates = rec.allRates && rec.allRates.length > 0;
      return hasValidService && hasRates;
    });

    // Determine the best overall account before processing shipments
    // Calculate total cost for each account across all shipments
    const accountTotals: { [key: string]: { totalCost: number; shipmentCount: number } } = {};
    
    validRecommendations.forEach(rec => {
      if (rec.allRates && Array.isArray(rec.allRates)) {
        rec.allRates.forEach((rate: any) => {
          const accountName = rate.carrierName || rate.accountName || 'Unknown';
          if (!accountTotals[accountName]) {
            accountTotals[accountName] = { totalCost: 0, shipmentCount: 0 };
          }
          accountTotals[accountName].totalCost += rate.totalCharges || rate.negotiatedRate || rate.rate_amount || 0;
          accountTotals[accountName].shipmentCount += 1;
        });
      }
    });

    // Find the account with the lowest total cost
    let bestOverallAccount = '';
    let lowestTotalCost = Infinity;
    
    Object.entries(accountTotals).forEach(([accountName, totals]) => {
      if (totals.totalCost < lowestTotalCost) {
        lowestTotalCost = totals.totalCost;
        bestOverallAccount = accountName;
      }
    });

    console.log('Best overall account determined:', bestOverallAccount, 'with total cost:', lowestTotalCost);
    console.log('Account totals:', accountTotals);

    // Format processed shipments using only rates from the best overall account
    const processedShipments = validRecommendations.map((rec, index) => {
      // Find the rate from the best overall account for this shipment
      let bestAccountRate = null;
      if (rec.allRates && Array.isArray(rec.allRates)) {
        bestAccountRate = rec.allRates.find((rate: any) => {
          const accountName = rate.carrierName || rate.accountName || 'Unknown';
          return accountName === bestOverallAccount;
        });
      }

      // Use the best account rate or fallback to the original recommendation
      const newRate = bestAccountRate ? (bestAccountRate.totalCharges || bestAccountRate.negotiatedRate || bestAccountRate.rate_amount || 0) : (rec.recommendedCost || 0);
      const currentRate = rec.currentCost || 0;
      const savings = currentRate - newRate;

      return {
        id: index + 1,
        trackingId: rec.shipment.trackingId || `Shipment-${index + 1}`,
        originZip: rec.shipment.originZip || '',
        destinationZip: rec.shipment.destZip || '',
        weight: parseFloat(rec.shipment.weight || '0'),
        length: parseFloat(rec.shipment.length || '0'),
        width: parseFloat(rec.shipment.width || '0'),
        height: parseFloat(rec.shipment.height || '0'),
        dimensions: rec.shipment.dimensions,
        carrier: rec.carrier || 'UPS',
        customer_service: rec.customer_service || rec.shipment.service || 'Unknown',
        ShipPros_service: bestAccountRate ? (bestAccountRate.serviceName || bestAccountRate.description || 'UPS Ground') : 'UPS Ground',
        currentRate: currentRate,
        ShipPros_cost: newRate,
        savings: savings,
        savingsPercent: currentRate > 0 ? (savings / currentRate) * 100 : 0,
        analyzedWithAccount: bestOverallAccount // Add the account information
      }
    })

    // Format orphaned shipments for centralized storage
    const orphanedShipmentsFormatted = payload.orphanedShipments.map((orphan, index) => ({
      id: payload.completedShipments + index + 1,
      trackingId: orphan.shipment.trackingId || `Orphan-${index + 1}`,
      originZip: orphan.shipment.originZip || '',
      destinationZip: orphan.shipment.destZip || '',
      weight: parseFloat(orphan.shipment.weight || '0'),
      length: parseFloat(orphan.shipment.length || '0'),
      width: parseFloat(orphan.shipment.width || '0'),
      height: parseFloat(orphan.shipment.height || '0'),
      dimensions: orphan.shipment.dimensions,
      service: orphan.customer_service || orphan.shipment.service || 'Unknown',
      error: orphan.error || 'Processing failed',
      errorType: orphan.errorType || 'Unknown',
      errorCategory: 'Processing Error'
    }))

    // Prepare processing metadata
    const processingMetadata = {
      savedAt: new Date().toISOString(),
      totalSavings: payload.totalPotentialSavings,
      completedShipments: payload.completedShipments,
      errorShipments: payload.errorShipments,
      totalShipments: payload.totalShipments,
      dataSource: 'finalize_analysis_endpoint'
    }

    // Prepare savings analysis
    const savingsAnalysis = {
      totalCurrentCost: payload.totalCurrentCost,
      totalPotentialSavings: payload.totalPotentialSavings,
      savingsPercentage: payload.totalCurrentCost > 0 ? (payload.totalPotentialSavings / payload.totalCurrentCost) * 100 : 0,
      totalShipments: payload.totalShipments,
      completedShipments: payload.completedShipments,
      errorShipments: payload.errorShipments,
      orphanedShipments: payload.orphanedShipments
    }

    // Create the complete analysis record
    const analysisRecord = {
      user_id: user.id,
      file_name: payload.fileName,
      original_data: payload.originalData,
      carrier_configs_used: payload.carrierConfigsUsed,
      service_mappings: payload.serviceMappings || [],
      ups_quotes: payload.recommendations.map(r => r.allRates || r.upsRates || []),
      savings_analysis: savingsAnalysis,
      recommendations: payload.recommendations,
      processed_shipments: processedShipments,
      orphaned_shipments: orphanedShipmentsFormatted,
      processing_metadata: processingMetadata,
      total_shipments: payload.totalShipments,
      total_savings: payload.totalPotentialSavings, // Now we can store negative savings!
      status: 'completed'
    }

    console.log('Saving analysis record:', {
      totalShipments: analysisRecord.total_shipments,
      originalDataCount: payload.originalData.length,
      recommendationsCount: payload.recommendations.length,
      orphanedCount: payload.orphanedShipments.length,
      processedShipmentsCount: processedShipments.length
    })

    let data, error

    // If we have an existing incomplete analysis, update it; otherwise insert new
    if (existingAnalyses && existingAnalyses.length > 0) {
      console.log('Updating existing incomplete analysis with ID:', existingAnalyses[0].id)
      
      const result = await supabase
        .from('shipping_analyses')
        .update(analysisRecord)
        .eq('id', existingAnalyses[0].id)
        .select('id')
        .single()
      
      data = result.data
      error = result.error
    } else {
      console.log('Creating new analysis record')
      
      const result = await supabase
        .from('shipping_analyses')
        .insert(analysisRecord)
        .select('id')
        .single()
      
      data = result.data
      error = result.error
    }

    if (error) {
      console.error('Database error:', error)
      throw new Error(`Failed to save analysis: ${error.message}`)
    }

    console.log('Analysis successfully saved with ID:', data.id)

    // Now populate the shipment_rates table for account comparison view
    try {
      const shipmentRatesToInsert = []
      
      // Extract rates from the original data for each shipment
      payload.originalData.forEach((shipmentResult, index) => {
        if (shipmentResult.status === 'completed' && shipmentResult.allRates) {
          shipmentResult.allRates.forEach((rate: any) => {
            shipmentRatesToInsert.push({
              analysis_id: data.id,
              shipment_index: index,
              carrier_config_id: rate.carrierId || '',
              account_name: rate.carrierName || rate.accountName || 'Unknown',
              carrier_type: rate.carrierType || 'ups',
              service_code: rate.serviceCode || '',
              service_name: rate.serviceName || rate.description || '',
              rate_amount: rate.totalCharges || rate.negotiatedRate || rate.rate_amount || 0,
              currency: rate.currency || 'USD',
              transit_days: rate.transitTime || null,
              is_negotiated: rate.rateType === 'negotiated' || rate.hasNegotiatedRates || false,
              published_rate: rate.publishedRate || null,
              shipment_data: shipmentResult.shipment || {}
            })
          })
        }
      })

      if (shipmentRatesToInsert.length > 0) {
        console.log(`Inserting ${shipmentRatesToInsert.length} shipment rates`)
        const { error: ratesError } = await supabase
          .from('shipment_rates')
          .insert(shipmentRatesToInsert)

        if (ratesError) {
          console.error('Error inserting shipment rates:', ratesError)
          // Don't fail the entire operation for this, but log it
        } else {
          console.log('Successfully inserted shipment rates for account comparison')
        }
      }
    } catch (ratesInsertError) {
      console.error('Error during shipment rates insertion:', ratesInsertError)
      // Don't fail the entire operation, just log the error
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        analysisId: data.id,
        message: 'Analysis finalized successfully'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error finalizing analysis:', error)
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
