import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui-lov/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, RotateCw, AlertCircle, DollarSign, TrendingDown, Package, Shield, Clock, Pause, Play } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useShipmentValidation } from '@/hooks/useShipmentValidation';
import { ValidationSummary } from '@/components/ui-lov/ValidationSummary';
import { ValidationDebugger } from '@/components/ui-lov/ValidationDebugger';
import { CarrierSelector } from '@/components/ui-lov/CarrierSelector';
import { VirtualizedAnalysisResults } from '@/components/ui-lov/VirtualizedAnalysisResults';
import { getCityStateFromZip } from '@/utils/zipCodeMapping';
import { mapServiceToServiceCode, getServiceCategoriesToRequest } from '@/utils/serviceMapping';
import { getCarrierServiceCode, CarrierType, getUniversalCategoryFromCarrierCode } from '@/utils/carrierServiceRegistry';
import type { ServiceMapping } from '@/utils/csvParser';
import { determineResidentialStatus } from '@/utils/csvParser';

interface ProcessedShipment {
  id: number;
  trackingId?: string;
  service?: string;
  carrier?: string;
  weight?: string;
  weightUnit?: string;
  currentRate?: string;
  originZip?: string;
  destZip?: string;
  length?: string;
  width?: string;
  height?: string;
  shipperName?: string;
  shipperAddress?: string;
  shipperCity?: string;
  shipperState?: string;
  recipientName?: string;
  recipientAddress?: string;
  recipientCity?: string;
  recipientState?: string;
  zone?: string;
}

interface AnalysisResult {
  shipment: ProcessedShipment;
  status: 'pending' | 'processing' | 'completed' | 'error';
  currentCost?: number;
  originalService?: string; // Original service from CSV
  upsRates?: any[]; // Legacy UPS rates
  allRates?: any[]; // All rates from all carriers
  carrierResults?: any[]; // Results by carrier
  bestRate?: any;
  bestOverallRate?: any;
  savings?: number;
  maxSavings?: number;
  error?: string;
  errorType?: string;
  errorCategory?: string;
  attemptCount?: number;
  // Add validation fields for debugging
  expectedServiceCode?: string;
  mappingValidation?: {
    isValid: boolean;
    expectedService: string;
    actualService: string;
    expectedServiceCode?: string;
    actualServiceCode?: string;
    message?: string;
  };
}

const Analysis = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [shipments, setShipments] = useState<ProcessedShipment[]>([]);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([]);
  const [currentShipmentIndex, setCurrentShipmentIndex] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalSavings, setTotalSavings] = useState(0);
  const [totalCurrentCost, setTotalCurrentCost] = useState(0);
  const [validationSummary, setValidationSummary] = useState<any>(null);
  const [serviceMappings, setServiceMappings] = useState<ServiceMapping[]>([]);
  const [csvResidentialField, setCsvResidentialField] = useState<string | undefined>(undefined);
  const [readyToAnalyze, setReadyToAnalyze] = useState(false);
  const [analysisSaved, setAnalysisSaved] = useState(false); // Track if analysis has been saved
  const [isAnalysisStarted, setIsAnalysisStarted] = useState(false); // Track if analysis has been started
  const [selectedCarriers, setSelectedCarriers] = useState<string[]>([]);
  const [carrierSelectionComplete, setCarrierSelectionComplete] = useState(false);
  const [hasLoadedInitialCarriers, setHasLoadedInitialCarriers] = useState(false);
  const { validateShipments, getValidShipments, validationState } = useShipmentValidation();
  
  useEffect(() => {
    const state = location.state as { 
      readyForAnalysis?: boolean, 
      csvData?: any[],
      mappings?: Record<string, string>,
      serviceMappings?: ServiceMapping[],
      fileName?: string,
      csvUploadId?: string,
      originZipOverride?: string,
      uploadTimestamp?: number
    } | null;
    
    // Validate state data
    
    if (!state || !state.readyForAnalysis || !state.csvData || !state.mappings) {
      toast.error('Please complete the service mapping review first');
      navigate('/service-mapping');
      return;
    }
    
    // Check data freshness
    if (state.uploadTimestamp && (Date.now() - state.uploadTimestamp) > 300000) {
      toast.warning('Using data older than 5 minutes');
    }
    
    
    // Validate service mappings exist
    if (!state.serviceMappings || state.serviceMappings.length === 0) {
      toast.error('No service mappings found. Please complete the service mapping step first.');
      navigate('/service-mapping', { 
        state: { 
          csvData: state.csvData,
          mappings: state.mappings,
          fileName: state.fileName,
          csvUploadId: state.csvUploadId,
          originZipOverride: state.originZipOverride
        }
      });
      return;
    }
    
    // Process CSV data into shipments using the confirmed mappings
    
    const processedShipments = state.csvData.map((row, index) => {
      const shipment: ProcessedShipment = { id: index + 1 };
      
      Object.entries(state.mappings).forEach(([fieldName, csvHeader]) => {
        if (csvHeader && csvHeader !== "__NONE__" && row[csvHeader] !== undefined) {
          let value = row[csvHeader];
          if (typeof value === 'string') {
            value = value.trim();
          }
          (shipment as any)[fieldName] = value;
          
        }
      });
      
      // Apply origin ZIP override if provided
      if (state.originZipOverride && state.originZipOverride.trim()) {
        shipment.originZip = state.originZipOverride.trim();
      }
      
      return shipment;
    });

    
    setShipments(processedShipments);
    
    // Set service mappings
    setServiceMappings(state.serviceMappings);
    
    // Check if we have a residential field mapped from CSV
    const residentialField = Object.entries(state.mappings).find(([fieldName, csvHeader]) => 
      fieldName === 'isResidential' && csvHeader && csvHeader !== "__NONE__"
    );
    if (residentialField) {
      setCsvResidentialField(residentialField[1]);
    }
    
    // Initialize analysis results
    const initialResults = processedShipments.map(shipment => ({
      shipment,
      status: 'pending' as const
    }));
    setAnalysisResults(initialResults);
    
    // Set flag to start analysis once serviceMappings are updated
    setReadyToAnalyze(true);
  }, [location, navigate]);
  
  // Auto-select all carriers on initial load if available
  // Load initial carriers only once when component mounts and shipments are available
  useEffect(() => {
    const loadInitialCarriers = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Don't auto-select any carriers - let user explicitly choose
        setHasLoadedInitialCarriers(true);
      } catch (error) {
        console.error('Error loading carrier configs:', error);
        setHasLoadedInitialCarriers(true);
      }
    };

    // Only auto-load carriers once when we first have shipments and haven't loaded carriers yet
    if (shipments.length > 0 && !hasLoadedInitialCarriers) {
      loadInitialCarriers();
    }
  }, [shipments, hasLoadedInitialCarriers]);

    // Wait for both service mappings and explicit carrier selection to complete
    useEffect(() => {
      if (readyToAnalyze && serviceMappings.length > 0 && shipments.length > 0 && 
          selectedCarriers.length > 0 && carrierSelectionComplete && !isAnalysisStarted) {
      
      setIsAnalysisStarted(true); // Prevent duplicate analysis starts
      validateAndStartAnalysis(shipments);
      setReadyToAnalyze(false); // Prevent multiple analysis starts
    }
  }, [readyToAnalyze, serviceMappings, shipments, selectedCarriers, carrierSelectionComplete, isAnalysisStarted]);
  
  const validateAndStartAnalysis = async (shipmentsToAnalyze: ProcessedShipment[]) => {
    setIsAnalyzing(true);
    setError(null);
    
    try {
      console.log(`🚀 Starting lightning-fast analysis for ${shipmentsToAnalyze.length} shipments (skipping slow validation)`);
      
      // Skip complex validation for speed - just start the analysis
      await startAnalysis(shipmentsToAnalyze);
      
    } catch (error: any) {
      console.error('Analysis error:', error);
      setError(error.message);
      toast.error(`Analysis failed: ${error.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const startAnalysis = async (shipmentsToAnalyze: ProcessedShipment[]) => {
    setIsAnalyzing(true);
    setCurrentShipmentIndex(0);
    setError(null);
    
    try {
      // Validate carrier configuration first and get filtered carriers
      const validCarrierIds = await validateCarrierConfiguration();
      setSelectedCarriers(validCarrierIds);
      
      console.log(`🚀 Starting bulk analysis for ${shipmentsToAnalyze.length} shipments`);
      
      // Use bulk processing for all datasets
      const state = location.state as any;
      const bulkPayload = {
        shipments: shipmentsToAnalyze,
        carrierConfigIds: validCarrierIds,
        fileName: state?.fileName || 'Real-time Analysis'
      };

      const startTime = performance.now();
      
      const { data: result, error } = await supabase.functions.invoke('bulk-rate-analysis', {
        body: bulkPayload
      });

      if (error) {
        throw new Error(`Bulk analysis failed: ${error.message}`);
      }

      const processingTime = performance.now() - startTime;
      console.log(`✅ Bulk analysis completed in ${processingTime.toFixed(2)}ms:`, result);
      
      // Show success message
      toast.success(`Analysis completed! Processed ${result.processedShipments} shipments in ${(processingTime / 1000).toFixed(1)}s`);
      
      // Navigate to results
      navigate('/results', { 
        state: { 
          analysisId: result.analysisId,
          fromAnalysis: true 
        } 
      });
      
    } catch (error: any) {
      console.error('Analysis error:', error);
      setError(error.message);
      toast.error(`Analysis failed: ${error.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  const validateCarrierConfiguration = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Please log in to run analysis');
    }

    if (selectedCarriers.length === 0) {
      throw new Error('Please select at least one carrier account for analysis.');
    }

    const { data: configs, error } = await supabase
      .from('carrier_configs')
      .select('*')
      .eq('user_id', user.id)
      .in('id', selectedCarriers)
      .eq('is_active', true);
    
    // Allow both API and rate card accounts to run together
    const state = location.state as { mappings?: Record<string, string> } | null;
    const hasZoneMapping = state?.mappings?.zone;
    
    // Keep all active configs - rate card accounts without zone mapping will fall back to API calls
    const filteredConfigs = configs || [];

    if (error || !filteredConfigs || filteredConfigs.length === 0) {
      throw new Error('No valid carrier configurations found. Please check your carrier accounts in Settings.');
    }

    // Log which accounts will use rate cards vs API calls
    const rateCardAccounts = filteredConfigs.filter(config => config.is_rate_card && hasZoneMapping);
    const apiAccounts = filteredConfigs.filter(config => !config.is_rate_card || !hasZoneMapping);
    
    console.log('📊 Analysis will use both rate card and API accounts:', {
      rateCardAccounts: rateCardAccounts.length,
      apiAccounts: apiAccounts.length,
      hasZoneMapping,
      accounts: filteredConfigs.map(c => ({ 
        name: c.account_name, 
        type: c.is_rate_card && hasZoneMapping ? 'rate_card' : 'api' 
      }))
     });

    console.log('✅ Carrier validation passed:', {
      selectedCarriers: selectedCarriers.length,
      validConfigs: filteredConfigs.length,
      carriers: filteredConfigs.map(c => ({ type: c.carrier_type, name: c.account_name }))
    });

    return selectedCarriers;
  };

  const createAnalysisRecord = async (shipmentsToAnalyze: ProcessedShipment[]) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Please log in to run analysis');
    }

    const state = location.state as any;
    const baseName = state?.fileName || 'Real-time Analysis';

    console.log('💾 Creating initial analysis record for rate saving');
    
    const analysisRecord = {
      user_id: user.id,
      file_name: baseName,
      total_shipments: shipmentsToAnalyze.length,
      total_savings: 0,
      status: 'processing',
      original_data: {} as any, // Required field, will be updated when complete
      carrier_configs_used: selectedCarriers as any,
      processing_metadata: {
        startedAt: new Date().toISOString(),
        dataSource: 'fresh_analysis'
      } as any
    };

    const { data, error } = await supabase
      .from('shipping_analyses')
      .insert(analysisRecord)
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating analysis record:', error);
      throw new Error('Failed to create analysis record');
    }

    console.log('✅ Analysis record created successfully:', data.id);
    return data.id;
  };

  const updateAnalysisRecord = async (analysisId: string) => {
    const completedResults = analysisResults.filter(r => r.status === 'completed');
    const errorResults = analysisResults.filter(r => r.status === 'error');
    
    // Calculate totals
    const totalSavingsCalc = completedResults.reduce((sum, result) => sum + (result.savings || 0), 0);
    const totalCurrentCostCalc = completedResults.reduce((sum, result) => sum + (result.currentCost || 0), 0);

    console.log('💾 Updating analysis record with final results');
    
    const updateData = {
      status: 'completed',
      total_savings: totalSavingsCalc,
      processing_metadata: {
        completedAt: new Date().toISOString(),
        totalCurrentCost: totalCurrentCostCalc,
        totalShipments: shipments.length,
        completedShipments: completedResults.length,
        errorShipments: errorResults.length,
        dataSource: 'fresh_analysis'
      } as any
    };

    const { error } = await supabase
      .from('shipping_analyses')
      .update(updateData)
      .eq('id', analysisId);

    if (error) {
      console.error('❌ Error updating analysis record:', error);
    } else {
      console.log('✅ Analysis record updated successfully');
    }
  };
  
  const processShipment = async (index: number, shipment: ProcessedShipment, retryCount = 0, analysisId?: string) => {
    const maxRetries = 2;
    
      // Update status to processing using shipment ID-based update to prevent race conditions
      setAnalysisResults(prev => {
        return prev.map(result => 
          result.shipment.id === shipment.id 
            ? { ...result, status: 'processing' }
            : result
        );
      });
    
    try {
      
      const missingFields = [];
      if (!shipment.originZip?.trim()) missingFields.push('Origin ZIP');
      if (!shipment.destZip?.trim()) missingFields.push('Destination ZIP');
      
      // Validate service type field - CRITICAL for proper analysis
      if (!shipment.service?.trim()) {
        missingFields.push('Service Type');
      }
      
      let weight = 0;
      if (!shipment.weight || shipment.weight === '') {
        missingFields.push('Weight');
      } else {
        weight = parseFloat(shipment.weight);
        // Handle oz to lbs conversion
        if (shipment.weightUnit && shipment.weightUnit.toLowerCase().includes('oz')) {
          weight = weight / 16;
        }
        if (isNaN(weight) || weight <= 0) {
          missingFields.push('Valid Weight');
        }
      }
      
      // Enhanced ZIP code validation - use same logic as addressValidation.ts
      const cleanAndValidateZip = (zipCode: string, fieldName: string) => {
        if (!zipCode || typeof zipCode !== 'string') {
          throw new Error(`${fieldName} ZIP code is required`);
        }
        
        const allDigits = zipCode.trim().replace(/\D/g, ''); // Remove all non-digits
        
        if (allDigits.length < 4) {
          throw new Error(`${fieldName} ZIP code must contain at least 4 digits`);
        }
        
        // Take first 5 digits, or all available if less than 5
        return allDigits.slice(0, 5);
      };
      
      const cleanOriginZip = cleanAndValidateZip(shipment.originZip, 'Origin');
      const cleanDestZip = cleanAndValidateZip(shipment.destZip, 'Destination');
      
      // Update shipment with cleaned ZIP codes
      shipment.originZip = cleanOriginZip;
      shipment.destZip = cleanDestZip;
      
      // Parse currentRate and handle different formats ($4.41, 4.41, $1,234.56, etc.)
      // For rate card analysis, allow zero costs since clients may not provide current rates
      const costString = (shipment.currentRate || '0').toString().replace(/[$,]/g, '').trim();
      const currentCost = parseFloat(costString);
      
      
      // Check if we have any missing fields and provide detailed error
      if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
      }
      
      
      const length = parseFloat(shipment.length);
      const width = parseFloat(shipment.width); 
      const height = parseFloat(shipment.height);
      
      // Validate dimensions are present and valid
      if (!length || !width || !height || isNaN(length) || isNaN(width) || isNaN(height)) {
        throw new Error(`Missing or invalid package dimensions. All shipments must have valid length, width, and height values.`);
      }
      
      // Normalize service names for robust matching
      const normalizeServiceName = (serviceName: string): string => {
        return serviceName?.trim().toLowerCase().replace(/\s+/g, ' ') || '';
      };

      // Use the confirmed service mapping from the service review step with normalized comparison
      const confirmedMapping = serviceMappings.find(m => 
        normalizeServiceName(m.original) === normalizeServiceName(shipment.service)
      );
      
      
      let serviceMapping, serviceCodesToRequest, equivalentServiceCode, isConfirmedMapping = false;
      
      if (confirmedMapping && confirmedMapping.standardizedService) {
        
        // Use the user-confirmed mapping - pass universal service category directly
        isConfirmedMapping = true;
        
        // Pass the universal service category directly to let each carrier convert to their specific codes
        serviceCodesToRequest = [confirmedMapping.standardizedService]; // Pass universal category
        equivalentServiceCode = confirmedMapping.standardizedService; // Store universal category
        serviceMapping = {
          serviceCode: confirmedMapping.standardizedService, // Use universal category, not carrier-specific code
          serviceName: confirmedMapping.standardized,
          standardizedService: confirmedMapping.standardizedService,
          confidence: confirmedMapping.confidence
        };
        
      } else {
        // NO FALLBACKS - if no confirmed mapping, this shipment is invalid
        throw new Error(`No confirmed service mapping found for "${shipment.service}". Please verify the service mapping on the mapping page.`);
      }
      

      // Determine residential status using hierarchical logic - pass full mapping data
      const residentialStatus = determineResidentialStatus(
        shipment, 
        confirmedMapping || { 
          original: shipment.service || '',
          standardized: serviceMapping.serviceName,
          standardizedService: serviceMapping.standardizedService,
          confidence: 0.5
        },
        csvResidentialField
      );
      
      // Use real address data from CSV or map ZIP codes to correct cities for test data
      const originCityState = getCityStateFromZip(shipment.originZip);
      const destCityState = getCityStateFromZip(shipment.destZip);
      
      const shipmentRequest = {
        shipFrom: {
          name: shipment.shipperName || 'Sample Shipper',
          address: shipment.shipperAddress || '123 Main St',
          city: shipment.shipperCity || originCityState.city,
          state: shipment.shipperState || originCityState.state,
          zipCode: shipment.originZip.trim(),
          country: 'US'
        },
        shipTo: {
          name: shipment.recipientName || 'Sample Recipient',
          address: shipment.recipientAddress || '456 Oak Ave',
          city: shipment.recipientCity || destCityState.city,
          state: shipment.recipientState || destCityState.state,
          zipCode: shipment.destZip.trim(),
          country: 'US'
        },
        package: {
          weight,
          weightUnit: 'LBS',
          length,
          width,
          height,
          dimensionUnit: 'IN'
        },
        serviceTypes: serviceCodesToRequest,
        equivalentServiceCode: equivalentServiceCode,
        isResidential: residentialStatus.isResidential,
        residentialSource: residentialStatus.source,
        originalCarrier: shipment.carrier || 'Unknown',
        zone: shipment.zone // Include CSV-mapped zone if available
      };
      
      
      const { data, error } = await supabase.functions.invoke('multi-carrier-quote', {
        body: { 
          shipment: {
            ...shipmentRequest,
            carrierConfigIds: selectedCarriers,
            analysisId: analysisId, // Pass analysis ID for saving individual rates
            shipmentIndex: index // Pass shipment index for tracking
          }
        }
      });


      if (error) {
        console.error(`❌ Multi-carrier API Error for shipment ${index + 1}:`, {
          errorMessage: error.message,
          errorDetails: error,
          shipmentRequest: {
            originZip: shipmentRequest.shipFrom.zipCode,
            destZip: shipmentRequest.shipTo.zipCode,
            weight: shipmentRequest.package.weight,
            serviceTypes: shipmentRequest.serviceTypes,
            isResidential: shipmentRequest.isResidential,
            carrierConfigIds: selectedCarriers
          }
        });
        
        // Check if this is a retryable error
        const isRetryableError = error.message?.includes('timeout') || 
                                error.message?.includes('network') ||
                                error.message?.includes('500') ||
                                error.message?.includes('503');
        
        if (isRetryableError && retryCount < maxRetries) {
          
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Progressive delay
          return processShipment(index, shipment, retryCount + 1);
        }
        
        throw new Error(`Multi-carrier API Error: ${error.message || 'Unknown API error'}`);
      }
      
      if (!data) {
        console.error(`❌ No data returned from multi-carrier API for shipment ${index + 1}`);
        throw new Error('No data returned from multi-carrier API');
      }
      
      if (!data.allRates || !Array.isArray(data.allRates) || data.allRates.length === 0) {
        console.error(`❌ No rates returned for shipment ${index + 1}:`, {
          fullResponse: data,
          shipmentDetails: {
            originZip: shipmentRequest.shipFrom.zipCode,
            destZip: shipmentRequest.shipTo.zipCode,
            weight: shipmentRequest.package.weight,
            dimensions: `${shipmentRequest.package.length}×${shipmentRequest.package.width}×${shipmentRequest.package.height}`,
            serviceTypes: shipmentRequest.serviceTypes,
            isResidential: shipmentRequest.isResidential,
            carrierConfigIds: selectedCarriers
          }
        });
        
        // Provide more specific error messages based on common issues
        let detailedError = 'No rates returned from any carrier.';
        if (data.error || data.errors) {
          detailedError += ` API Error: ${data.error || JSON.stringify(data.errors)}`;
        } else {
          detailedError += ' This may indicate:\n• Invalid ZIP codes\n• Package dimensions exceed limits\n• Service unavailable for this route\n• Carrier API configuration issues';
        }
        
        throw new Error(detailedError);
      }
      
      
      
      // Enhanced rate selection with multi-carrier data
      let comparisonRate;
      let bestRate = null;
      
      console.log(`🔍 Multi-carrier rate selection for shipment ${index + 1}:`, {
        originalService: shipment.service,
        isConfirmedMapping,
        equivalentServiceCode,
        totalRatesReturned: data.allRates.length,
        bestRatesCount: data.bestRates?.length || 0,
        carrierBreakdown: data.carrierResults?.map((c: any) => ({
          carrier: c.carrierType,
          name: c.carrierName,
          success: c.success,
          rateCount: c.rateCount || 0
        }))
      });
      
      // Find the best rate from all carriers for this service
      if (isConfirmedMapping) {
        // User confirmed this mapping - find the best rate for the mapped service across all carriers
        const serviceRates = data.allRates.filter((rate: any) => {
          // Since rate cards now use universal categories, we can do direct comparison
          return rate.serviceCode === serviceMapping.standardizedService;
        });
        
        if (serviceRates.length > 0) {
          comparisonRate = serviceRates.reduce((best: any, current: any) => 
            (current.totalCharges || 0) < (best.totalCharges || 0) ? current : best
          );
        }
        
        console.log(`✅ Multi-carrier confirmed mapping analysis:`, {
          originalService: shipment.service,
          mappedServiceCode: equivalentServiceCode,
          mappedServiceName: serviceMapping.serviceName,
          serviceRatesFound: serviceRates.length,
          bestServiceRate: comparisonRate ? {
            carrier: comparisonRate.carrierType,
            serviceName: comparisonRate.serviceName,
            cost: comparisonRate.totalCharges
          } : null
        });
      }
      
      // If no specific service match found, or for auto-mapping, use the overall best rate
      if (!comparisonRate && data.bestRates && data.bestRates.length > 0) {
        comparisonRate = data.bestRates[0]; // Best overall rate
        console.log('🏆 Using overall best rate from multi-carrier comparison:', {
          carrier: comparisonRate.carrierType,
          serviceName: comparisonRate.serviceName,
          cost: comparisonRate.totalCharges,
          isBestRate: comparisonRate.isBestRate
        });
      }
      
      // Find the absolute best rate for savings calculation
      if (data.allRates.length > 0) {
        bestRate = data.allRates.reduce((best: any, current: any) => 
          (current.totalCharges || 0) < (best.totalCharges || 0) ? current : best
        );
      }
      
      // Comparison rate is now properly defined above based on mapping type
      
      if (!comparisonRate || comparisonRate.totalCharges === undefined) {
        throw new Error('Invalid rate data returned from carriers');
      }
      
      const savings = currentCost - comparisonRate.totalCharges;
      const maxSavings = bestRate ? currentCost - bestRate.totalCharges : savings;
      
      console.log(`Shipment ${index + 1} analysis complete:`, {
        originalService: shipment.service,
        comparisonService: comparisonRate.serviceName,
        comparisonServiceCode: comparisonRate.serviceCode,
        currentCost,
        comparisonRate: comparisonRate.totalCharges,
        savings,
        recommendedUpsService: comparisonRate.serviceName,
        isConfirmedMapping,
        usedMappedService: isConfirmedMapping
      });
      
      console.log(`Using ${isConfirmedMapping ? 'user-confirmed mapping' : 'auto-detected equivalent'} service for comparison:`, {
        trackingId: shipment.trackingId,
        originalService: shipment.service,
        comparisonMethod: isConfirmedMapping ? 'confirmed_mapping' : 'auto_detection',
        comparisonServiceName: comparisonRate.serviceName,
        comparisonServiceCode: comparisonRate.serviceCode,
        comparisonServiceCost: comparisonRate.totalCharges,
        savings,
        userConfirmedMapping: isConfirmedMapping
      });
      
      // Validate the result before updating state
      const resultValidation = {
        originalServiceMatches: shipment.service === shipment.service,
        bestRateServiceCode: comparisonRate.serviceCode,
        expectedServiceCode: isConfirmedMapping ? equivalentServiceCode : comparisonRate.serviceCode,
        serviceCodeMatches: isConfirmedMapping ? comparisonRate.serviceCode === equivalentServiceCode : true,
        hasValidSavings: typeof savings === 'number' && !isNaN(savings)
      };
      
      console.log(`✅ Result validation for shipment ${index + 1}:`, {
        originalService: shipment.service,
        bestRateService: comparisonRate.serviceName,
        bestRateServiceCode: comparisonRate.serviceCode,
        currentCost,
        bestRateCost: comparisonRate.totalCharges,
        savings,
        validation: resultValidation
      });
      
      if (isConfirmedMapping && !resultValidation.serviceCodeMatches) {
        console.warn(`⚠️ Service code mismatch for shipment ${index + 1}:`, {
          expected: equivalentServiceCode,
          actual: comparisonRate.serviceCode,
          originalService: shipment.service
        });
      }
      
      // Update totals using functional updates
      setTotalCurrentCost(prev => prev + currentCost);
      setTotalSavings(prev => prev + savings);
      
      // Validation that the comparison rate matches expected service mapping
      // Convert carrier-specific service code back to universal category for comparison
      const getUniversalCategoryFromCarrierCode = (carrierType: string, serviceCode: string): string | null => {
        // Import the carrier service registry mappings
        const carrierMappings: Record<string, Record<string, string>> = {
          'ups': {
            '01': 'OVERNIGHT',
            '13': 'OVERNIGHT_SAVER', 
            '14': 'OVERNIGHT_EARLY',
            '02': 'TWO_DAY',
            '59': 'TWO_DAY_MORNING',
            '12': 'THREE_DAY',
            '03': 'GROUND',
            '07': 'INTERNATIONAL_EXPRESS',
            '08': 'INTERNATIONAL_EXPEDITED',
            '11': 'INTERNATIONAL_SAVER',
            '65': 'INTERNATIONAL_STANDARD'
          },
          'fedex': {
            'PRIORITY_OVERNIGHT': 'OVERNIGHT',
            'STANDARD_OVERNIGHT': 'OVERNIGHT_SAVER',
            'FIRST_OVERNIGHT': 'OVERNIGHT_EARLY', 
            'FEDEX_2_DAY': 'TWO_DAY',
            'FEDEX_2_DAY_AM': 'TWO_DAY_MORNING',
            'FEDEX_EXPRESS_SAVER': 'THREE_DAY',
            'FEDEX_GROUND': 'GROUND',
            'INTERNATIONAL_PRIORITY': 'INTERNATIONAL_EXPRESS',
            'INTERNATIONAL_ECONOMY': 'INTERNATIONAL_EXPEDITED'
          },
          'amazon': {
            'GROUND': 'GROUND'
          },
          'dhl': {
            'EXPRESS_10_30': 'OVERNIGHT',
            'EXPRESS_9_00': 'OVERNIGHT_EARLY',
            'EXPRESS_12_00': 'TWO_DAY',
            'EXPRESS_WORLDWIDE': 'INTERNATIONAL_EXPRESS',
            'EXPRESS_EASY': 'INTERNATIONAL_EXPEDITED'
          }
        };
        
        return carrierMappings[carrierType?.toLowerCase()]?.[serviceCode] || null;
      };

      const actualUniversalCategory = getUniversalCategoryFromCarrierCode(
        comparisonRate.carrierType, 
        comparisonRate.serviceCode
      );
      
      const mappingValidation = {
        isValid: isConfirmedMapping ? actualUniversalCategory === equivalentServiceCode : true,
        expectedService: serviceMapping.serviceName,
        actualService: comparisonRate.serviceName || comparisonRate.Service?.Description || 'Unknown',
        expectedServiceCode: equivalentServiceCode,
        actualServiceCode: comparisonRate.serviceCode,
        actualUniversalCategory,
        message: isConfirmedMapping 
          ? (actualUniversalCategory === equivalentServiceCode 
              ? 'Service mapping is correct' 
              : `Expected universal service ${equivalentServiceCode}, got ${actualUniversalCategory} (carrier code: ${comparisonRate.serviceCode})`)
          : 'No confirmed mapping validation'
      };

      console.log(`🔍 Final validation for shipment ${shipment.id}:`, {
        originalService: shipment.service,
        mappingValidation,
        isConfirmedMapping,
        comparisonRate: {
          serviceCode: comparisonRate.serviceCode,
          serviceName: comparisonRate.serviceName
        }
      });

      // Update result using shipment ID-based update to prevent race conditions
      setAnalysisResults(prev => {
        return prev.map(result => {
          if (result.shipment.id === shipment.id) {
            const updatedResult = {
              ...result,
              status: 'completed' as const,
              currentCost,
              originalService: shipment.service, // Store original service from CSV
              allRates: data.allRates,
              carrierResults: data.carrierResults,
              bestRate: comparisonRate,
              bestOverallRate: bestRate,
              savings,
              maxSavings,
              expectedServiceCode: equivalentServiceCode,
              mappingValidation
            };
            
            // Final validation log
            console.log(`✅ Storing validated result for shipment ${shipment.id}:`, {
              originalService: updatedResult.originalService,
              bestRateService: updatedResult.bestRate?.serviceName,
              bestRateCode: updatedResult.bestRate?.serviceCode,
              expectedCode: updatedResult.expectedServiceCode,
              mappingValid: updatedResult.mappingValidation?.isValid
            });
            
            return updatedResult;
          }
          return result;
        });
      });
      
    } catch (error: any) {
      console.error(`❌ Error processing shipment ${index + 1} (${shipment.trackingId}):`, {
        error: error.message,
        errorStack: error.stack,
        shipmentDetails: {
          id: shipment.id,
          trackingId: shipment.trackingId,
          service: shipment.service,
          carrier: shipment.carrier,
          originZip: shipment.originZip,
          destZip: shipment.destZip,
          weight: shipment.weight,
          currentRate: shipment.currentRate
        },
        attemptNumber: retryCount + 1,
        maxRetries: maxRetries + 1
      });
      
      // Enhanced error categorization for better debugging
      let errorType = 'processing_error';
      let errorCategory = 'Unknown';
      
      if (error.message.includes('Missing required fields')) {
        errorType = 'missing_data';
        errorCategory = 'Data Validation';
      } else if (error.message.includes('Invalid') && error.message.includes('ZIP')) {
        errorType = 'invalid_data';
        errorCategory = 'ZIP Code Format';
      } else if (error.message.includes('Invalid')) {
        errorType = 'invalid_data';
        errorCategory = 'Data Format';
      } else if (error.message.includes('UPS API Error')) {
        errorType = 'api_error';
        errorCategory = 'UPS API Communication';
      } else if (error.message.includes('No rates returned')) {
        errorType = 'no_rates';
        errorCategory = 'UPS Rate Response';
      } else if (error.message.includes('No confirmed service mapping')) {
        errorType = 'mapping_error';
        errorCategory = 'Service Mapping';
      } else if (error.message.includes('timeout') || error.message.includes('network')) {
        errorType = 'network_error';
        errorCategory = 'Network/Timeout';
      }
      
      console.log(`📊 Error analysis for shipment ${index + 1}:`, {
        trackingId: shipment.trackingId,
        errorType,
        errorCategory,
        errorMessage: error.message,
        isRetryableError: retryCount < maxRetries && (errorType === 'network_error' || errorType === 'api_error'),
        willRetry: retryCount < maxRetries && (errorType === 'network_error' || errorType === 'api_error')
      });
      
      // Check if this error should trigger a retry
      const shouldRetry = retryCount < maxRetries && 
                         (errorType === 'network_error' || 
                          (errorType === 'api_error' && !error.message.includes('authentication')));
      
      if (shouldRetry) {
        console.log(`🔄 Retrying shipment ${index + 1} due to ${errorCategory} error`);
        await new Promise(resolve => setTimeout(resolve, 2000 * (retryCount + 1))); // Progressive delay
        return processShipment(index, shipment, retryCount + 1);
      }
      
      // Update error result using functional update to prevent race conditions
      setAnalysisResults(prev => {
        const newResults = [...prev];
        if (newResults[index]) {
          newResults[index] = {
            ...newResults[index],
            status: 'error',
            error: error.message,
            errorType,
            errorCategory,
            attemptCount: retryCount + 1
          };
        }
        return newResults;
      });
    }
  };
  
  const finalizeAnalysis = async (analysisData: any) => {
    try {
      console.log('🚀 Starting analysis finalization:', {
        orphanedCount: analysisData.orphanedShipments?.length || 0,
        originalDataCount: analysisData.originalData?.length || 0,
        recommendationsCount: analysisData.recommendations?.length || 0
      });

      // For large datasets (>1000 shipments), use streaming processor
      const STREAMING_THRESHOLD = 1000;
      const isLargeDataset = analysisData.totalShipments > STREAMING_THRESHOLD;

      if (isLargeDataset) {
        console.log('📊 Large dataset detected, using streaming processor');
        
        const { DataStreamProcessor } = await import('@/utils/dataStreamProcessor');
        const processor = new DataStreamProcessor({
          chunkSize: 500,
          maxConcurrentChunks: 3,
          progressCallback: (progress) => {
            console.log(`🔄 Streaming progress: ${progress.processedChunks}/${progress.totalChunks} chunks`);
            toast.info(`Processing: ${Math.round((progress.processedChunks / progress.totalChunks) * 100)}% complete`);
          }
        });

        const analysisId = await processor.streamAnalysis(analysisData);
        console.log('✅ Streaming analysis completed:', analysisId);
        return analysisId;
      }

      // For smaller datasets, use the original method
      const { data, error } = await supabase.functions.invoke('finalize-analysis', {
        body: analysisData
      });

      console.log('📦 Edge function response:', { data, error });

      if (error) {
        console.error('❌ Edge function error:', error);
        throw new Error(error.message || 'Failed to finalize analysis');
      }

      if (!data.success) {
        console.error('❌ Edge function returned failure:', data);
        throw new Error(data.error || 'Failed to finalize analysis');
      }

      console.log('✅ Analysis finalized successfully:', data.analysisId);
      
      // Handle batch processing response
      if (data.batchInfo) {
        console.log('🔄 Large dataset initiated batch processing:', data.batchInfo);
        toast.success('Large dataset analysis started - you\'ll be redirected to view progress');
      }
      
      return data.analysisId;
    } catch (error) {
      console.error('💥 Error finalizing analysis:', error);
      throw error;
    }
  };
  
  const handleViewResults = async () => {
    if (analysisResults.length === 0) {
      toast.error('No analysis results to view');
      return;
    }

    const completedResults = analysisResults.filter(r => r.status === 'completed');
    const errorResults = analysisResults.filter(r => r.status === 'error');

    if (completedResults.length === 0) {
      toast.error('No completed shipments to analyze');
      return;
    }

    console.log('Finalizing analysis with results:', {
      totalShipments: analysisResults.length,
      completedShipments: completedResults.length,
      errorShipments: errorResults.length,
      orphanShipments: errorResults.length
    });

    try {
      // Format data for the finalize endpoint
      const recommendations = completedResults.map((result, index) => ({
        shipment: result.shipment,
        currentCost: result.currentCost || 0,
        recommendedCost: result.bestRate?.totalCharges || 0,
        savings: result.savings || 0,
        customer_service: result.originalService || result.shipment.service,
        ShipPros_service: result.bestRate?.serviceName || 'Unknown',
        carrier: 'UPS',
        status: 'completed',
        allRates: result.allRates,
        upsRates: result.upsRates
      }));

      const orphanedShipments = errorResults.map((result, index) => ({
        shipment: result.shipment,
        error: result.error,
        errorType: result.errorType || 'unknown_error',
        customer_service: result.originalService || result.shipment.service,
        status: 'error'
      }));

      const state = location.state as any;
      const analysisPayload = {
        fileName: state?.fileName || 'Real-time Analysis',
        totalShipments: analysisResults.length,
        completedShipments: completedResults.length,
        errorShipments: errorResults.length,
        totalCurrentCost,
        totalPotentialSavings: totalSavings,
        recommendations,
        orphanedShipments,
        originalData: analysisResults,
        carrierConfigsUsed: selectedCarriers,
        serviceMappings: serviceMappings
      };

      // Finalize analysis in backend
      const analysisId = await finalizeAnalysis(analysisPayload);

      // Navigate to results with analysisId
      navigate(`/results?analysisId=${analysisId}`);

    } catch (error: any) {
      console.error('Failed to finalize analysis:', error);
      toast.error(`Failed to save analysis: ${error.message}`);
    }
  };

  const handleStopAndContinue = async () => {
    const completedResults = analysisResults.filter(r => r.status === 'completed');
    const errorResults = analysisResults.filter(r => r.status === 'error');
    
    if (completedResults.length === 0) {
      toast.error('No completed shipments to analyze');
      return;
    }

    console.log('Stopping analysis and finalizing partial results:', {
      completedShipments: completedResults.length,
      errorShipments: errorResults.length,
      orphanShipments: errorResults.length
    });

    try {
      // Format data for the finalize endpoint (same as handleViewResults)
      const recommendations = completedResults.map((result, index) => ({
        shipment: result.shipment,
        currentCost: result.currentCost || 0,
        recommendedCost: result.bestRate?.totalCharges || 0,
        savings: result.savings || 0,
        customer_service: result.originalService || result.shipment.service,
        ShipPros_service: result.bestRate?.serviceName || 'Unknown',
        carrier: 'UPS',
        status: 'completed',
        allRates: result.allRates,
        upsRates: result.upsRates
      }));

      const orphanedShipments = errorResults.map((result, index) => ({
        shipment: result.shipment,
        error: result.error,
        errorType: result.errorType || 'unknown_error',
        customer_service: result.originalService || result.shipment.service,
        status: 'error'
      }));

      console.log('🚨 STOP & VIEW RESULTS - ORPHAN DEBUG:', {
        totalResults: analysisResults.length,
        completedResults: completedResults.length,
        errorResults: errorResults.length,
        orphanedShipments: orphanedShipments.length,
        sampleErrorResults: errorResults.slice(0, 3),
        sampleOrphanedShipments: orphanedShipments.slice(0, 3)
      });

      const state = location.state as any;
      const analysisPayload = {
        fileName: state?.fileName || 'Real-time Analysis',
        totalShipments: analysisResults.length,
        completedShipments: completedResults.length,
        errorShipments: errorResults.length,
        totalCurrentCost,
        totalPotentialSavings: totalSavings,
        recommendations,
        orphanedShipments,
        originalData: analysisResults,
        carrierConfigsUsed: selectedCarriers,
        serviceMappings: serviceMappings
      };

      console.log('🚨 STOP & VIEW RESULTS - ANALYSIS PAYLOAD:', analysisPayload);

      // Finalize analysis in backend
      const analysisId = await finalizeAnalysis(analysisPayload);

      // Navigate to results with analysisId
      navigate(`/results?analysisId=${analysisId}`);

    } catch (error: any) {
      console.error('Failed to finalize partial analysis:', error);
      toast.error(`Failed to save analysis: ${error.message}`);
    }
  };
  
  const progress = isComplete ? 100 : shipments.length > 0 ? (currentShipmentIndex / shipments.length) * 100 : 0;
  const completedCount = analysisResults.filter(r => r.status === 'completed').length;
  const errorCount = analysisResults.filter(r => r.status === 'error').length;
  
  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold mb-2">Real-Time Shipping Analysis</h1>
          <p className="text-muted-foreground">
            Processing {shipments.length} shipments and comparing current rates across multiple carriers for optimal savings.
          </p>
        </div>
        
        {/* Carrier Selection */}
        {!isAnalysisStarted && !carrierSelectionComplete && (
          <div className="mb-6">
            <CarrierSelector
              selectedCarriers={selectedCarriers}
              onCarrierChange={setSelectedCarriers}
              showAllOption={true}
              hasZoneMapping={!!(location.state as { mappings?: Record<string, string> } | null)?.mappings?.zone}
            />
            {selectedCarriers.length > 0 && (
              <div className="mt-4 flex justify-end">
                <Button 
                  onClick={() => setCarrierSelectionComplete(true)}
                  disabled={selectedCarriers.length === 0}
                  iconLeft={<CheckCircle className="h-4 w-4" />}
                >
                  Start Analysis with {selectedCarriers.length} Carrier{selectedCarriers.length > 1 ? 's' : ''}
                </Button>
              </div>
            )}
          </div>
        )}
        
        {/* Progress Overview */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Package className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{shipments.length}</p>
                  <p className="text-sm text-muted-foreground">Total Shipments</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {validationSummary && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Shield className="h-8 w-8 text-emerald-600" />
                  <div>
                    <p className="text-2xl font-bold">{validationSummary.valid}</p>
                    <p className="text-sm text-muted-foreground">Valid Shipments</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-2xl font-bold">{completedCount}</p>
                  <p className="text-sm text-muted-foreground">Analyzed</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <DollarSign className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold">${totalCurrentCost.toFixed(2)}</p>
                  <p className="text-sm text-muted-foreground">Current Cost</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <TrendingDown className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-2xl font-bold">${totalSavings.toFixed(2)}</p>
                  <p className="text-sm text-muted-foreground">Potential Savings</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Compact Validation Summary */}
        {validationState.summary.total > 0 && (
          <div className="mb-4 space-y-4">
            <ValidationSummary 
              validationState={validationState} 
              shipments={shipments} 
              className="compact" 
            />
            
            {/* Show debugger if there are validation failures */}
            {validationState.summary.invalid > 0 && (
              <ValidationDebugger 
                validationState={validationState} 
                shipments={shipments} 
              />
            )}
          </div>
        )}

        {/* Progress Bar */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex justify-between mb-2 items-center">
              <div className="text-sm font-medium">
                {isComplete 
                  ? 'Analysis Complete!' 
                  : isAnalyzing 
                    ? `Processing shipment ${currentShipmentIndex + 1} of ${shipments.length}...` 
                    : 'Ready to analyze'
                }
              </div>
              <div className="text-sm font-medium">
                {Math.round(progress)}%
              </div>
            </div>
            <Progress value={progress} className="h-2" />
            
            {/* Control Buttons */}
            {(isAnalyzing || completedCount > 0) && !isComplete && (
              <div className="flex gap-4 mt-4">
                <Button
                  onClick={() => setIsPaused(!isPaused)}
                  variant="outline"
                  disabled={!isAnalyzing}
                >
                  {isPaused ? <Play className="h-4 w-4 mr-2" /> : <Pause className="h-4 w-4 mr-2" />}
                  {isPaused ? 'Resume' : 'Pause'}
                </Button>
                
                <Button
                  onClick={handleStopAndContinue}
                  variant="secondary"
                  disabled={completedCount === 0}
                >
                  Stop & View Results
                </Button>
                
                <Button
                  onClick={() => navigate('/upload')}
                  variant="outline"
                >
                  Start Over
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Error Display */}
        {error && (
          <Card className="mb-6 border-red-200">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-900">Analysis Error</p>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Real-time Results - Virtualized for Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Live Analysis Results</CardTitle>
          </CardHeader>
          <CardContent>
            <VirtualizedAnalysisResults 
              results={analysisResults}
              height={400}
            />
            
            {isComplete && (
              <div className="flex justify-end mt-6">
                <Button 
                  variant="primary" 
                  onClick={handleViewResults}
                  iconRight={<CheckCircle className="ml-1 h-4 w-4" />}
                >
                  View Detailed Results
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Analysis;
