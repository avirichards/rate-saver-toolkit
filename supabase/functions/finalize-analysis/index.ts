
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
  batchInfo?: {
    batchIndex: number;
    totalBatches: number;
    analysisId: string;
  };
}

interface BatchProcessingResult {
  analysisId: string;
  batchIndex: number;
  totalBatches: number;
  isComplete: boolean;
}

// Check if analysis uses only rate cards (no API calls needed)
async function isRateCardOnlyAnalysis(carrierConfigIds: string[], supabase: any) {
  const { data: carrierConfigs, error } = await supabase
    .from('carrier_configs')
    .select('is_rate_card')
    .in('id', carrierConfigIds);
    
  if (error || !carrierConfigs) {
    console.log('⚠️ Could not determine carrier types, defaulting to API processing');
    return false;
  }
  
  const allRateCards = carrierConfigs.every(config => config.is_rate_card === true);
  console.log('📋 Rate card analysis check:', {
    totalCarriers: carrierConfigs.length,
    allRateCards,
    carrierTypes: carrierConfigs.map(c => ({ is_rate_card: c.is_rate_card }))
  });
  
  return allRateCards;
}

// Batch processing functions
async function handleLargeDatasetBatching(payload: AnalysisPayload, user: any, supabase: any) {
  console.log('🔄 Initiating batch processing for large dataset');
  
  const BATCH_SIZE = 2000;
  const totalBatches = Math.ceil(payload.recommendations.length / BATCH_SIZE);
  
  // Create initial analysis record with processing status
  const initialAnalysisRecord = {
    user_id: user.id,
    file_name: payload.fileName,
    original_data: payload.originalData,
    carrier_configs_used: payload.carrierConfigsUsed,
    service_mappings: payload.serviceMappings || [],
    savings_analysis: {
      totalCurrentCost: payload.totalCurrentCost,
      totalPotentialSavings: payload.totalPotentialSavings,
      savingsPercentage: payload.totalCurrentCost > 0 ? (payload.totalPotentialSavings / payload.totalCurrentCost) * 100 : 0,
      totalShipments: payload.totalShipments,
      completedShipments: payload.completedShipments,
      errorShipments: payload.errorShipments,
      orphanedShipments: payload.orphanedShipments
    },
    total_shipments: payload.totalShipments,
    total_savings: payload.totalPotentialSavings,
    status: 'processing',
    processing_metadata: {
      savedAt: new Date().toISOString(),
      totalBatches: totalBatches,
      completedBatches: 0,
      dataSource: 'batch_processing'
    }
  };
  
  const { data: analysisData, error: analysisError } = await supabase
    .from('shipping_analyses')
    .insert(initialAnalysisRecord)
    .select('id')
    .single();
    
  if (analysisError) {
    throw new Error(`Failed to create initial analysis record: ${analysisError.message}`);
  }
  
  console.log(`✅ Created analysis record ${analysisData.id}, starting background batch processing`);
  
  // Process batches in background using EdgeRuntime.waitUntil
  const processBatchesInBackground = async () => {
    try {
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const startIndex = batchIndex * BATCH_SIZE;
        const endIndex = Math.min(startIndex + BATCH_SIZE, payload.recommendations.length);
        const batchRecommendations = payload.recommendations.slice(startIndex, endIndex);
        
        // Create batch payload
        const batchPayload = {
          ...payload,
          recommendations: batchRecommendations,
          batchInfo: {
            batchIndex: batchIndex,
            totalBatches: totalBatches,
            analysisId: analysisData.id
          }
        };
        
        console.log(`🔄 Processing batch ${batchIndex + 1}/${totalBatches} with ${batchRecommendations.length} shipments`);
        
        // Process this batch (recursive call but with batch info)
        await processBatch(batchPayload, user, supabase);
        
        console.log(`✅ Completed batch ${batchIndex + 1}/${totalBatches}`);
      }
      
      // Mark analysis as completed
      await supabase
        .from('shipping_analyses')
        .update({ 
          status: 'completed',
          processing_metadata: {
            ...initialAnalysisRecord.processing_metadata,
            completedBatches: totalBatches,
            completedAt: new Date().toISOString()
          }
        })
        .eq('id', analysisData.id);
        
      console.log(`🎉 All batches completed for analysis ${analysisData.id}`);
    } catch (error) {
      console.error('❌ Error during batch processing:', error);
      
      // Mark analysis as failed
      await supabase
        .from('shipping_analyses')
        .update({ 
          status: 'failed',
          processing_metadata: {
            ...initialAnalysisRecord.processing_metadata,
            error: error.message,
            failedAt: new Date().toISOString()
          }
        })
        .eq('id', analysisData.id);
    }
  };
  
  // Start background processing
  EdgeRuntime.waitUntil(processBatchesInBackground());
  
  // Return immediate response with analysis ID
  return new Response(
    JSON.stringify({ 
      success: true, 
      analysisId: analysisData.id,
      message: 'Large dataset analysis started - processing in background',
      batchInfo: {
        totalBatches: totalBatches,
        status: 'processing'
      }
    }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}

async function handleBatchRequest(payload: AnalysisPayload, user: any, supabase: any) {
  console.log(`🔄 Processing batch ${payload.batchInfo!.batchIndex + 1}/${payload.batchInfo!.totalBatches}`);
  
  return await processBatch(payload, user, supabase);
}

async function processBatch(payload: AnalysisPayload, user: any, supabase: any) {
  // This function contains the core processing logic
  // (moved from the main handler to be reusable for batches)
  
  // Filter valid recommendations for this batch
  const validRecommendations = payload.recommendations.filter(rec => {
    const service = rec.customer_service || rec.shipment.service || '';
    const hasValidService = service && service.trim() !== '' && service !== 'Unknown';
    const hasRates = rec.allRates && rec.allRates.length > 0;
    return hasValidService && hasRates;
  });

  // Calculate account totals for this batch
  const accountTotals: { [key: string]: { totalCost: number; shipmentCount: number } } = {};
  
  validRecommendations.forEach(rec => {
    if (rec.allRates && Array.isArray(rec.allRates)) {
      rec.allRates.forEach((rate: any) => {
        const accountName = rate.carrierName || rate.accountName || 'Unknown';
        const carrierType = rate.carrierType || 'unknown';
        const serviceName = rate.serviceName || '';
        
        if (carrierType.toLowerCase() === 'amazon' && 
            serviceName.toLowerCase() !== 'ground' && 
            !serviceName.toLowerCase().includes('ground')) {
          return;
        }
        
        if (!accountTotals[accountName]) {
          accountTotals[accountName] = { totalCost: 0, shipmentCount: 0 };
        }
        const rateAmount = parseFloat(rate.totalCharges || rate.negotiatedRate || rate.rate_amount || 0);
        accountTotals[accountName].totalCost += rateAmount;
        accountTotals[accountName].shipmentCount += 1;
      });
    }
  });

  // Find best account for this batch
  let bestOverallAccount = '';
  let lowestTotalCost = Infinity;
  
  Object.entries(accountTotals).forEach(([accountName, totals]) => {
    if (totals.totalCost < lowestTotalCost) {
      lowestTotalCost = totals.totalCost;
      bestOverallAccount = accountName;
    }
  });

  // Create service-to-account mapping for this batch
  const serviceToAccountMapping: { [serviceCategory: string]: string } = {};
  const serviceCategoryStats: { [serviceCategory: string]: { [accountName: string]: { totalCost: number; rateCount: number } } } = {};
  
  validRecommendations.forEach(rec => {
    if (rec.allRates && Array.isArray(rec.allRates)) {
      const serviceCategory = rec.customer_service || rec.shipment.service || 'Unknown';
      
      if (!serviceCategoryStats[serviceCategory]) {
        serviceCategoryStats[serviceCategory] = {};
      }
      
      rec.allRates.forEach((rate: any) => {
        const accountName = rate.carrierName || rate.accountName || 'Unknown';
        const carrierType = rate.carrierType || 'unknown';
        const serviceName = rate.serviceName || '';
        
        if (carrierType.toLowerCase() === 'amazon' && 
            serviceName.toLowerCase() !== 'ground' && 
            !serviceName.toLowerCase().includes('ground')) {
          return;
        }
        
        if (!serviceCategoryStats[serviceCategory][accountName]) {
          serviceCategoryStats[serviceCategory][accountName] = { totalCost: 0, rateCount: 0 };
        }
        
        const rateAmount = parseFloat(rate.totalCharges || rate.negotiatedRate || rate.rate_amount || 0);
        serviceCategoryStats[serviceCategory][accountName].totalCost += rateAmount;
        serviceCategoryStats[serviceCategory][accountName].rateCount += 1;
      });
    }
  });

  Object.keys(serviceCategoryStats).forEach(serviceCategory => {
    const accounts = serviceCategoryStats[serviceCategory];
    
    if (accounts[bestOverallAccount] && accounts[bestOverallAccount].rateCount > 0) {
      serviceToAccountMapping[serviceCategory] = bestOverallAccount;
    } else {
      let bestAccountForService = '';
      let lowestAverageCost = Infinity;
      
      Object.entries(accounts).forEach(([accountName, stats]) => {
        const averageCost = stats.totalCost / stats.rateCount;
        if (averageCost < lowestAverageCost) {
          lowestAverageCost = averageCost;
          bestAccountForService = accountName;
        }
      });
      
      serviceToAccountMapping[serviceCategory] = bestAccountForService || bestOverallAccount;
    }
  });

  // Process shipments for this batch
  const processedShipments = validRecommendations.map((rec, index) => {
    const serviceCategory = rec.customer_service || rec.shipment.service || 'Unknown';
    const assignedAccount = serviceToAccountMapping[serviceCategory] || bestOverallAccount;
    
    let assignedAccountRate = null;
    if (rec.allRates && Array.isArray(rec.allRates)) {
      assignedAccountRate = rec.allRates.find((rate: any) => {
        const accountName = rate.carrierName || rate.accountName || 'Unknown';
        return accountName === assignedAccount;
      });
    }

    const newRate = assignedAccountRate ? 
      parseFloat(assignedAccountRate.totalCharges || assignedAccountRate.negotiatedRate || assignedAccountRate.rate_amount || 0) : 
      parseFloat(rec.recommendedCost || 0);
    const currentRate = parseFloat(rec.currentCost || 0);
    const savings = currentRate - newRate;

    // Calculate batch-aware ID
    const batchStartIndex = payload.batchInfo ? payload.batchInfo.batchIndex * 2000 : 0;

    return {
      id: batchStartIndex + index + 1,
      trackingId: rec.shipment.trackingId || `Shipment-${batchStartIndex + index + 1}`,
      originZip: rec.shipment.originZip || '',
      destinationZip: rec.shipment.destZip || '',
      weight: parseFloat(rec.shipment.weight || '0'),
      length: parseFloat(rec.shipment.length || '0'),
      width: parseFloat(rec.shipment.width || '0'),
      height: parseFloat(rec.shipment.height || '0'),
      dimensions: rec.shipment.dimensions,
      carrier: rec.carrier || 'UPS',
      customer_service: rec.customer_service || rec.shipment.service || 'Unknown',
      ShipPros_service: assignedAccountRate ? (assignedAccountRate.serviceName || assignedAccountRate.description || 'Ground') : 'Ground',
      currentRate: currentRate,
      ShipPros_cost: newRate,
      savings: savings,
      savingsPercent: currentRate > 0 ? (savings / currentRate) * 100 : 0,
      analyzedWithAccount: assignedAccount,
      accountName: assignedAccount
    }
  });

  // Handle batch data insertion
  if (payload.batchInfo) {
    // For batches, append data instead of replacing
    const analysisId = payload.batchInfo.analysisId;
    
    // Get current analysis data
    const { data: currentAnalysis } = await supabase
      .from('shipping_analyses')
      .select('processed_shipments, processing_metadata')
      .eq('id', analysisId)
      .single();
      
    const existingShipments = currentAnalysis?.processed_shipments || [];
    const updatedShipments = [...existingShipments, ...processedShipments];
    
    // Update processing metadata
    const updatedMetadata = {
      ...currentAnalysis?.processing_metadata,
      completedBatches: payload.batchInfo.batchIndex + 1,
      lastBatchCompletedAt: new Date().toISOString()
    };
    
    // Update analysis with batch data
    const { error: updateError } = await supabase
      .from('shipping_analyses')
      .update({
        processed_shipments: updatedShipments,
        processing_metadata: updatedMetadata
      })
      .eq('id', analysisId);
      
    if (updateError) {
      throw new Error(`Failed to update batch data: ${updateError.message}`);
    }
    
    // Insert shipment rates for this batch
    const shipmentRatesToInsert: any[] = [];
    const batchStartIndex = payload.batchInfo.batchIndex * 2000;
    
    payload.recommendations.forEach((rec, localIndex) => {
      if (rec.allRates && Array.isArray(rec.allRates)) {
        rec.allRates.forEach((rate: any) => {
          shipmentRatesToInsert.push({
            analysis_id: analysisId,
            shipment_index: batchStartIndex + localIndex,
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
            shipment_data: rec.shipment || {}
          });
        });
      }
    });
    
    if (shipmentRatesToInsert.length > 0) {
      await supabase
        .from('shipment_rates')
        .insert(shipmentRatesToInsert);
    }
    
    console.log(`✅ Batch ${payload.batchInfo.batchIndex + 1}/${payload.batchInfo.totalBatches} completed`);
    
    return new Response(
      JSON.stringify({
        success: true,
        batchIndex: payload.batchInfo.batchIndex,
        totalBatches: payload.batchInfo.totalBatches,
        isComplete: payload.batchInfo.batchIndex === payload.batchInfo.totalBatches - 1
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  // This should not happen in batch mode, but included for completeness
  return new Response(
    JSON.stringify({ success: true, message: 'Batch processed' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
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
      totalSavings: payload.totalPotentialSavings,
      isBatch: !!payload.batchInfo
    })

    // Check if this is a rate card-only analysis (skip batching for instant processing)
    const isRateCardOnly = await isRateCardOnlyAnalysis(payload.carrierConfigsUsed, supabase);
    
    // Smart size detection - datasets over 5000 shipments should use batch processing (except rate cards)
    const BATCH_THRESHOLD = 5000;
    const BATCH_SIZE = 2000;
    const isLargeDataset = payload.totalShipments > BATCH_THRESHOLD;
    
    // Rate card analyses bypass batching since they're just database lookups
    if (isRateCardOnly) {
      console.log('⚡ Rate card-only analysis detected - processing immediately (no batching needed)');
    } else if (isLargeDataset && !payload.batchInfo) {
      console.log('📊 Large dataset with API calls detected - using batch processing');
      return await handleLargeDatasetBatching(payload, user, supabase);
    }
    
    // If this is a batch request, handle it appropriately
    if (payload.batchInfo) {
      return await handleBatchRequest(payload, user, supabase);
    }

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
          const carrierType = rate.carrierType || 'unknown';
          const serviceName = rate.serviceName || '';
          
          // Filter out Amazon rates for non-Ground services (these should not exist but are invalid if they do)
          if (carrierType.toLowerCase() === 'amazon' && 
              serviceName.toLowerCase() !== 'ground' && 
              !serviceName.toLowerCase().includes('ground')) {
            console.log(`⚠️ Filtering out invalid Amazon rate for non-Ground service: ${serviceName}`);
            return;
          }
          
          if (!accountTotals[accountName]) {
            accountTotals[accountName] = { totalCost: 0, shipmentCount: 0 };
          }
          const rateAmount = parseFloat(rate.totalCharges || rate.negotiatedRate || rate.rate_amount || 0);
          accountTotals[accountName].totalCost += rateAmount;
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

    // Group rates by service categories to create service-to-account mapping
    const serviceToAccountMapping: { [serviceCategory: string]: string } = {};
    const serviceCategoryStats: { [serviceCategory: string]: { [accountName: string]: { totalCost: number; rateCount: number } } } = {};
    
    // First, collect all rates grouped by service category and account
    validRecommendations.forEach(rec => {
      if (rec.allRates && Array.isArray(rec.allRates)) {
        const serviceCategory = rec.customer_service || rec.shipment.service || 'Unknown';
        
        if (!serviceCategoryStats[serviceCategory]) {
          serviceCategoryStats[serviceCategory] = {};
        }
        
        rec.allRates.forEach((rate: any) => {
          const accountName = rate.carrierName || rate.accountName || 'Unknown';
          const carrierType = rate.carrierType || 'unknown';
          const serviceName = rate.serviceName || '';
          
          // Filter out Amazon rates for non-Ground services
          if (carrierType.toLowerCase() === 'amazon' && 
              serviceName.toLowerCase() !== 'ground' && 
              !serviceName.toLowerCase().includes('ground')) {
            return;
          }
          
          if (!serviceCategoryStats[serviceCategory][accountName]) {
            serviceCategoryStats[serviceCategory][accountName] = { totalCost: 0, rateCount: 0 };
          }
          
          const rateAmount = parseFloat(rate.totalCharges || rate.negotiatedRate || rate.rate_amount || 0);
          serviceCategoryStats[serviceCategory][accountName].totalCost += rateAmount;
          serviceCategoryStats[serviceCategory][accountName].rateCount += 1;
        });
      }
    });

    // Create service-to-account mapping: primary account first, then best per service category
    Object.keys(serviceCategoryStats).forEach(serviceCategory => {
      const accounts = serviceCategoryStats[serviceCategory];
      
      // Check if best overall account supports this service category
      if (accounts[bestOverallAccount] && accounts[bestOverallAccount].rateCount > 0) {
        serviceToAccountMapping[serviceCategory] = bestOverallAccount;
      } else {
        // Find the account with the lowest average cost for this service category
        let bestAccountForService = '';
        let lowestAverageCost = Infinity;
        
        Object.entries(accounts).forEach(([accountName, stats]) => {
          const averageCost = stats.totalCost / stats.rateCount;
          if (averageCost < lowestAverageCost) {
            lowestAverageCost = averageCost;
            bestAccountForService = accountName;
          }
        });
        
        serviceToAccountMapping[serviceCategory] = bestAccountForService || bestOverallAccount;
      }
    });

    console.log('Service-to-account mapping:', serviceToAccountMapping);
    console.log('Best overall account:', bestOverallAccount);

    // Format processed shipments using service-based account selection
    const processedShipments = validRecommendations.map((rec, index) => {
      const serviceCategory = rec.customer_service || rec.shipment.service || 'Unknown';
      const assignedAccount = serviceToAccountMapping[serviceCategory] || bestOverallAccount;
      
      // Find the rate from the assigned account for this shipment
      let assignedAccountRate = null;
      if (rec.allRates && Array.isArray(rec.allRates)) {
        assignedAccountRate = rec.allRates.find((rate: any) => {
          const accountName = rate.carrierName || rate.accountName || 'Unknown';
          return accountName === assignedAccount;
        });
      }

      // Use the assigned account rate or fallback to best available rate
      const newRate = assignedAccountRate ? 
        parseFloat(assignedAccountRate.totalCharges || assignedAccountRate.negotiatedRate || assignedAccountRate.rate_amount || 0) : 
        parseFloat(rec.recommendedCost || 0);
      const currentRate = parseFloat(rec.currentCost || 0);
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
        ShipPros_service: assignedAccountRate ? (assignedAccountRate.serviceName || assignedAccountRate.description || 'Ground') : 'Ground',
        currentRate: currentRate,
        ShipPros_cost: newRate,
        savings: savings,
        savingsPercent: currentRate > 0 ? (savings / currentRate) * 100 : 0,
        analyzedWithAccount: assignedAccount, // Use the account assigned for this service category
        accountName: assignedAccount // Also store as accountName for easier access
      }
    })

    // Format orphaned shipments for centralized storage
    const orphanedShipmentsFormatted = payload.orphanedShipments.map((orphan, index) => {
      // Extract currentRate from original data
      const originalEntry = payload.originalData?.find((orig: any) => 
        orig.shipment?.trackingId === orphan.shipment.trackingId || 
        orig.trackingId === orphan.shipment.trackingId ||
        orig.tracking_id === orphan.shipment.trackingId
      );
      
      const currentRate = originalEntry ? 
        originalEntry.shipment?.currentRate || 
        originalEntry.currentRate || 
        originalEntry.current_rate || 
        originalEntry.cost || 
        originalEntry.rate || 
        originalEntry.amount || 
        originalEntry.price || 0 : 0;

      return {
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
        currentRate: parseFloat(currentRate) || 0,
        error: orphan.error || 'Processing failed',
        errorType: orphan.errorType || 'Unknown',
        errorCategory: 'Processing Error'
      }
    })

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
      processing_metadata: {
        ...processingMetadata,
        bestOverallAccount: bestOverallAccount,
        accountTotals: accountTotals,
        selectedCarrierConfigs: payload.carrierConfigsUsed
      },
      total_shipments: payload.totalShipments,
      total_savings: payload.totalPotentialSavings,
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
