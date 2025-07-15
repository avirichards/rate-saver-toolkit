import React, { useState, useEffect } from 'react';
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
import { getCityStateFromZip } from '@/utils/zipCodeMapping';
import { mapServiceToServiceCode, getServiceCodesToRequest } from '@/utils/serviceMapping';
import type { ServiceMapping } from '@/utils/csvParser';
import { determineResidentialStatus } from '@/utils/csvParser';

interface ProcessedShipment {
  id: number;
  trackingId?: string;
  service?: string;
  carrier?: string;
  weight?: string;
  weightUnit?: string;
  cost?: string;
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
}

interface AnalysisResult {
  shipment: ProcessedShipment;
  status: 'pending' | 'processing' | 'completed' | 'error';
  currentCost?: number;
  originalService?: string; // Original service from CSV
  upsRates?: any[];
  bestRate?: any;
  savings?: number;
  error?: string;
  errorType?: string;
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
  const { validateShipments, getValidShipments, validationState } = useShipmentValidation();
  
  useEffect(() => {
    const state = location.state as { 
      readyForAnalysis?: boolean, 
      csvData?: any[],
      mappings?: Record<string, string>,
      serviceMappings?: ServiceMapping[],
      fileName?: string,
      csvUploadId?: string,
      originZipOverride?: string
    } | null;
    
    if (!state || !state.readyForAnalysis || !state.csvData || !state.mappings) {
      toast.error('Please complete the service mapping review first');
      navigate('/service-mapping');
      return;
    }
    
    console.log('🔍 Analysis - Received navigation state:', {
      hasServiceMappings: !!state.serviceMappings,
      serviceMappingsCount: state.serviceMappings?.length || 0,
      serviceMappings: state.serviceMappings?.map(m => ({
        original: m.original,
        serviceCode: m.serviceCode,
        standardized: m.standardized
      }))
    });
    
    // Validate service mappings exist
    if (!state.serviceMappings || state.serviceMappings.length === 0) {
      console.error('🚫 No service mappings found in navigation state');
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

    console.log(`Analysis received ${processedShipments.length} shipments (sample):`, processedShipments.slice(0, 2));
    setShipments(processedShipments);
    
    // Set service mappings with debugging
    console.log('🔍 Setting service mappings:', state.serviceMappings.length);
    setServiceMappings(state.serviceMappings);
    
    // Check if we have a residential field mapped from CSV
    const residentialField = Object.entries(state.mappings).find(([fieldName, csvHeader]) => 
      fieldName === 'isResidential' && csvHeader && csvHeader !== "__NONE__"
    );
    if (residentialField) {
      setCsvResidentialField(residentialField[1]);
      console.log('Found residential field mapping:', residentialField[1]);
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
  
  // Separate useEffect to start analysis once serviceMappings state is updated
  useEffect(() => {
    if (readyToAnalyze && serviceMappings.length > 0 && shipments.length > 0) {
      console.log('🚀 Starting analysis with service mappings:', {
        serviceMappingsCount: serviceMappings.length,
        shipmentsCount: shipments.length,
        mappings: serviceMappings.map(m => ({
          original: m.original,
          serviceCode: m.serviceCode
        }))
      });
      
      validateAndStartAnalysis(shipments);
      setReadyToAnalyze(false); // Prevent multiple analysis starts
    }
  }, [readyToAnalyze, serviceMappings, shipments]);
  
  const validateAndStartAnalysis = async (shipmentsToAnalyze: ProcessedShipment[]) => {
    setIsAnalyzing(true);
    setError(null);
    
    try {
      // Validate all shipments first
      console.log('Validating shipments...');
      const validationResults = await validateShipments(shipmentsToAnalyze);
      
      // Filter valid shipments using the validation results directly
      const validShipments = shipmentsToAnalyze.filter((_, index) => {
        const result = validationResults[index];
        return result && result.isValid;
      });
      
      const summary = {
        total: shipmentsToAnalyze.length,
        valid: validShipments.length,
        invalid: shipmentsToAnalyze.length - validShipments.length
      };
      
      setValidationSummary(summary);
      console.log('Validation complete:', summary);
      console.log('Valid shipments found:', validShipments.length);
      
      if (validShipments.length === 0) {
        throw new Error('No valid shipments found. Please check your data and field mappings.');
      }
      
      if (summary.invalid > 0) {
        toast.warning(`${summary.invalid} shipments have validation errors and will be skipped.`);
      }
      
      // Process only valid shipments
      await startAnalysis(validShipments);
      
    } catch (error: any) {
      console.error('Validation error:', error);
      setError(error.message);
      setIsAnalyzing(false);
    }
  };

  const startAnalysis = async (shipmentsToAnalyze: ProcessedShipment[]) => {
    setIsAnalyzing(true);
    setCurrentShipmentIndex(0);
    setError(null);
    
    console.log('🚀 Starting sequential analysis of shipments:', {
      totalShipments: shipmentsToAnalyze.length,
      serviceMappingsAvailable: serviceMappings.length,
      firstShipment: shipmentsToAnalyze[0]
    });
    
    try {
      // Validate UPS configuration first
      await validateUpsConfiguration();
      
      // Process shipments sequentially (one at a time) to prevent race conditions
      for (let i = 0; i < shipmentsToAnalyze.length; i++) {
        // Check if paused before processing each shipment
        if (isPaused) {
          console.log('Analysis paused, stopping processing');
          break;
        }
        
        console.log(`🔄 Processing shipment ${i + 1}/${shipmentsToAnalyze.length}`, {
          shipmentId: shipmentsToAnalyze[i].id,
          service: shipmentsToAnalyze[i].service,
          weight: shipmentsToAnalyze[i].weight
        });
        
        setCurrentShipmentIndex(i);
        await processShipment(i, shipmentsToAnalyze[i]);
        
        // Small delay to show progress and allow for pause to take effect
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Only mark complete if we processed all shipments and weren't paused
      if (!isPaused) {
        console.log('✅ Analysis complete, saving to database');
        setIsComplete(true);
        await saveAnalysisToDatabase();
      }
      
    } catch (error: any) {
      console.error('Analysis error:', error);
      setError(error.message);
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  const validateUpsConfiguration = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Please log in to run analysis');
    }

    const { data: config, error } = await supabase
      .from('ups_configs')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (error || !config) {
      throw new Error('UPS configuration not found. Please configure UPS API in Settings.');
    }

    // Test UPS connection
    const { data, error: authError } = await supabase.functions.invoke('ups-auth', {
      body: { action: 'get_token' }
    });

    if (authError || !data?.access_token) {
      throw new Error('Failed to authenticate with UPS. Please check your API credentials.');
    }
  };
  
  const processShipment = async (index: number, shipment: ProcessedShipment) => {
    console.log(`🔍 Processing shipment ${index + 1}:`, {
      shipmentId: shipment.id,
      service: shipment.service,
      originZip: shipment.originZip,
      destZip: shipment.destZip,
      weight: shipment.weight,
      cost: shipment.cost
    });
    
    // Update status to processing using functional update to prevent race conditions
    setAnalysisResults(prev => {
      const newResults = [...prev];
      if (newResults[index]) {
        newResults[index] = { ...newResults[index], status: 'processing' };
      }
      return newResults;
    });
    
    try {
      // Enhanced validation with better error messages
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
      
      // Validate ZIP codes format (basic US ZIP validation)
      const zipRegex = /^\d{5}(-\d{4})?$/;
      if (shipment.originZip?.trim() && !zipRegex.test(shipment.originZip.trim())) {
        throw new Error(`Invalid origin ZIP code format: ${shipment.originZip}`);
      }
      if (shipment.destZip?.trim() && !zipRegex.test(shipment.destZip.trim())) {
        throw new Error(`Invalid destination ZIP code format: ${shipment.destZip}`);
      }
      
      const currentCost = parseFloat(shipment.cost || '0');
      
      // Add validation for zero or invalid costs - move to orphans
      if (isNaN(currentCost) || currentCost <= 0) {
        missingFields.push('Valid Cost (greater than $0)');
      }
      
      // Check if we have any missing fields (including zero cost) and throw error
      if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
      }
      
      const length = parseFloat(shipment.length || '12');
      const width = parseFloat(shipment.width || '12'); 
      const height = parseFloat(shipment.height || '6');
      
      // Normalize service names for robust matching
      const normalizeServiceName = (serviceName: string): string => {
        return serviceName?.trim().toLowerCase().replace(/\s+/g, ' ') || '';
      };

      // Use the confirmed service mapping from the service review step with normalized comparison
      const confirmedMapping = serviceMappings.find(m => 
        normalizeServiceName(m.original) === normalizeServiceName(shipment.service)
      );
      
      console.log('🔍 Analysis - Looking for service mapping (with normalization):', {
        shipmentService: shipment.service,
        normalizedShipmentService: normalizeServiceName(shipment.service || ''),
        availableMappings: serviceMappings.map(m => ({
          original: m.original,
          normalized: normalizeServiceName(m.original),
          serviceCode: m.serviceCode
        })),
        foundMapping: confirmedMapping
      });
      
      let serviceMapping, serviceCodesToRequest, equivalentServiceCode, isConfirmedMapping = false;
      
      if (confirmedMapping && confirmedMapping.serviceCode) {
        // Use the user-confirmed mapping - REQUEST ONLY THE MAPPED SERVICE for accurate comparison
        isConfirmedMapping = true;
        equivalentServiceCode = confirmedMapping.serviceCode;
        serviceCodesToRequest = [equivalentServiceCode]; // ONLY request the confirmed service code
        serviceMapping = {
          serviceCode: equivalentServiceCode,
          serviceName: confirmedMapping.standardized,
          standardizedService: confirmedMapping.standardized,
          confidence: confirmedMapping.confidence
        };
        
        console.log(`✅ Using confirmed mapping for ${shipment.service} → UPS Service Code ${equivalentServiceCode}:`, {
          originalService: shipment.service,
          mappedServiceCode: equivalentServiceCode,
          mappedServiceName: confirmedMapping.standardized,
          requestingOnlyMappedService: true
        });
      } else {
        // NO FALLBACKS - if no confirmed mapping, this shipment is invalid
        throw new Error(`No confirmed service mapping found for "${shipment.service}". Please verify the service mapping on the mapping page.`);
      }
      
      console.log('🏠 Analysis - Found confirmed mapping with residential data:', {
        hasMapping: !!confirmedMapping,
        original: confirmedMapping?.original,
        isResidential: confirmedMapping?.isResidential,
        residentialSource: confirmedMapping?.residentialSource,
        isResidentialDetected: confirmedMapping?.isResidentialDetected
      });

      // Determine residential status using hierarchical logic - pass full mapping data
      const residentialStatus = determineResidentialStatus(
        shipment, 
        confirmedMapping || { 
          original: shipment.service || '',
          standardized: serviceMapping.standardizedService,
          carrier: 'UPS',
          confidence: 0.5
        }, 
        csvResidentialField
      );
      
      console.log(`🏠 Residential status for shipment ${index + 1}:`, {
        shipmentId: shipment.id,
        originalService: shipment.service,
        isResidential: residentialStatus.isResidential,
        source: residentialStatus.source,
        confidence: residentialStatus.confidence,
        recipientAddress: shipment.recipientAddress,
        serviceMapping: {
          isResidential: confirmedMapping?.isResidential,
          residentialSource: confirmedMapping?.residentialSource,
          original: confirmedMapping?.original,
          standardized: confirmedMapping?.standardized
        }
      });
      
      console.log(`Processing shipment ${index + 1}:`, {
        originZip: shipment.originZip,
        destZip: shipment.destZip,
        weight,
        dimensions: { length, width, height },
        currentCost,
        originalService: shipment.service,
        mappedService: serviceMapping,
        serviceCodes: serviceCodesToRequest,
        equivalentServiceCode
      });
      
      // Use real address data from CSV or map ZIP codes to correct cities for test data
      const originCityState = getCityStateFromZip(shipment.originZip);
      const destCityState = getCityStateFromZip(shipment.destZip);
      
      console.log(`ZIP code mapping for shipment ${index + 1}:`, {
        originZip: shipment.originZip,
        originMapping: originCityState,
        destZip: shipment.destZip,
        destMapping: destCityState
      });
      
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
        originalCarrier: shipment.carrier || 'Unknown'
      };
      
      // Fetch UPS rates with enhanced error handling
      const { data, error } = await supabase.functions.invoke('ups-rate-quote', {
        body: { shipment: shipmentRequest }
      });

      console.log(`UPS API response for shipment ${index + 1}:`, { data, error });

      if (error) {
        throw new Error(`UPS API Error: ${error.message || 'Unknown error'}`);
      }
      
      if (!data) {
        throw new Error('No data returned from UPS API');
      }
      
      if (!data.rates || !Array.isArray(data.rates) || data.rates.length === 0) {
        console.error('UPS API returned no rates. Full response:', data);
        throw new Error('No rates returned from UPS. This may indicate:\n• Invalid ZIP codes\n• Package dimensions exceed limits\n• Service unavailable for this route\n• UPS API configuration issues');
      }
      
      // Enhanced rate selection with detailed debugging
      let comparisonRate;
      
      console.log(`🔍 Rate selection for shipment ${index + 1}:`, {
        originalService: shipment.service,
        isConfirmedMapping,
        equivalentServiceCode,
        totalRatesReturned: data.rates.length,
        allReturnedRates: data.rates.map((r: any) => ({
          serviceCode: r.serviceCode,
          serviceName: r.serviceName,
          cost: r.totalCharges
        }))
      });
      
      if (isConfirmedMapping) {
        // User confirmed this mapping - use the specific service rate they mapped to
        comparisonRate = data.rates.find((rate: any) => rate.serviceCode === equivalentServiceCode);
        
        if (!comparisonRate) {
          console.error(`❌ No rate found for mapped service code:`, {
            requestedServiceCode: equivalentServiceCode,
            availableServiceCodes: data.rates.map(r => r.serviceCode),
            originalService: shipment.service
          });
          throw new Error(`No rate returned for user-mapped service code ${equivalentServiceCode} (${serviceMapping.serviceName})`);
        }
        
        console.log(`✅ Using confirmed mapping rate for comparison:`, {
          originalService: shipment.service,
          mappedServiceCode: equivalentServiceCode,
          mappedServiceName: comparisonRate.serviceName,
          cost: comparisonRate.totalCharges,
          userConfirmedMapping: true,
          rateValidation: {
            serviceCodeMatches: comparisonRate.serviceCode === equivalentServiceCode,
            hasValidCost: typeof comparisonRate.totalCharges === 'number'
          }
        });
      } else {
        // Auto-mapping - find equivalent service rate (for apples-to-apples comparison)
        const equivalentServiceRate = data.rates.find((rate: any) => rate.isEquivalentService);
        
        // Find best overall rate (lowest cost)
        const bestOverallRate = data.rates.reduce((best: any, current: any) => 
          (current.totalCharges || 0) < (best.totalCharges || 0) ? current : best
        );
        
        // Use equivalent service for comparison if available, otherwise use best overall rate
        comparisonRate = equivalentServiceRate || bestOverallRate;
        
        console.log('🤖 Auto-mapping service rate analysis:', {
          totalRates: data.rates.length,
          ratesWithEquivalentFlag: data.rates.filter((r: any) => r.isEquivalentService).length,
          equivalentServiceFound: !!equivalentServiceRate,
          equivalentServiceDetails: equivalentServiceRate ? {
            serviceName: equivalentServiceRate.serviceName,
            serviceCode: equivalentServiceRate.serviceCode,
            cost: equivalentServiceRate.totalCharges
          } : null,
          allRates: data.rates.map((r: any) => ({
            code: r.serviceCode,
            name: r.serviceName,
            cost: r.totalCharges,
            isEquivalent: r.isEquivalentService
          })),
          usingEquivalentService: !!equivalentServiceRate
        });
      }
      
      // Comparison rate is now properly defined above based on mapping type
      
      if (!comparisonRate || comparisonRate.totalCharges === undefined) {
        throw new Error('Invalid rate data returned from UPS');
      }
      
      const savings = currentCost - comparisonRate.totalCharges;
      
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
      
      // Update result using functional update to prevent race conditions
      setAnalysisResults(prev => {
        const newResults = [...prev];
        if (newResults[index]) {
          newResults[index] = {
            ...newResults[index],
            status: 'completed',
            currentCost,
            originalService: shipment.service, // Store original service from CSV
            upsRates: data.rates,
            bestRate: comparisonRate,
            savings
          };
        }
        return newResults;
      });
      
    } catch (error: any) {
      console.error(`Error processing shipment ${index + 1}:`, error);
      
      // Categorize the error type for better orphan handling
      let errorType = 'processing_error';
      if (error.message.includes('Missing required fields')) {
        errorType = 'missing_data';
      } else if (error.message.includes('Invalid')) {
        errorType = 'invalid_data';
      } else if (error.message.includes('UPS API')) {
        errorType = 'api_error';
      } else if (error.message.includes('No rates returned')) {
        errorType = 'no_rates';
      }
      
      console.log(`Shipment ${index + 1} will be moved to orphans:`, {
        trackingId: shipment.trackingId,
        errorType,
        errorMessage: error.message
      });
      
      // Update error result using functional update to prevent race conditions
      setAnalysisResults(prev => {
        const newResults = [...prev];
        if (newResults[index]) {
          newResults[index] = {
            ...newResults[index],
            status: 'error',
            error: error.message,
            errorType
          };
        }
        return newResults;
      });
    }
  };
  
  const saveAnalysisToDatabase = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const state = location.state as any;
    const completedResults = analysisResults.filter(r => r.status === 'completed');
    
    // Include ALL completed results, not just ones with positive savings
    const recommendations = completedResults.map(r => ({
      shipment: r.shipment,
      originalService: r.originalService,
      currentCost: r.currentCost,
      recommendedCost: r.bestRate?.totalCharges,
      savings: r.savings,
      recommendedService: r.bestRate?.serviceName,
      status: r.status,
      error: r.error
    }));
    
    const { error } = await supabase
      .from('shipping_analyses')
      .insert({
        user_id: user.id,
        file_name: state?.fileName || 'Real-time Analysis',
        original_data: completedResults as any, // Store all completed analysis results
        ups_quotes: completedResults.map(r => r.upsRates) as any,
        savings_analysis: {
          totalCurrentCost,
          totalPotentialSavings: totalSavings,
          savingsPercentage: totalCurrentCost > 0 ? (totalSavings / totalCurrentCost) * 100 : 0
        } as any,
        recommendations: recommendations as any,
        total_shipments: shipments.length,
        total_savings: totalSavings,
        status: 'completed'
      });

    if (error) {
      console.error('Error saving analysis:', error);
    }
  };
  
  const handleViewResults = () => {
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

    console.log('Preparing results data:', {
      totalShipments: analysisResults.length,
      completedShipments: completedResults.length,
      errorShipments: errorResults.length,
      orphanShipments: errorResults.length
    });

    // Format data for Results component - completed shipments
    const recommendations = completedResults.map((result, index) => ({
      shipment: result.shipment,
      currentCost: result.currentCost || 0,
      recommendedCost: result.bestRate?.totalCharges || 0,
      savings: result.savings || 0,
      originalService: result.originalService || result.shipment.service,
      recommendedService: result.bestRate?.serviceName || 'Unknown',
      carrier: 'UPS',
      status: 'completed'
    }));

    // Format orphaned shipments (errors)
    const orphanedShipments = errorResults.map((result, index) => ({
      shipment: result.shipment,
      error: result.error,
      errorType: result.errorType || 'unknown_error',
      originalService: result.originalService || result.shipment.service,
      status: 'error'
    }));

    const analysisData = {
      totalShipments: analysisResults.length,
      completedShipments: completedResults.length,
      errorShipments: errorResults.length,
      totalCurrentCost,
      totalPotentialSavings: totalSavings,
      averageSavingsPercent: totalCurrentCost > 0 ? (totalSavings / totalCurrentCost) * 100 : 0,
      recommendations,
      orphanedShipments
    };

    navigate('/results', { 
      state: { 
        analysisComplete: true, 
        analysisData 
      } 
    });
  };

  const handleStopAndContinue = () => {
    const completedResults = analysisResults.filter(r => r.status === 'completed');
    const errorResults = analysisResults.filter(r => r.status === 'error');
    
    if (completedResults.length === 0) {
      toast.error('No completed shipments to analyze');
      return;
    }

    console.log('Stopping analysis and continuing with partial results:', {
      completedShipments: completedResults.length,
      errorShipments: errorResults.length,
      orphanShipments: errorResults.length
    });

    // Format data for Results component - completed shipments
    const recommendations = completedResults.map((result, index) => ({
      shipment: result.shipment,
      currentCost: result.currentCost || 0,
      recommendedCost: result.bestRate?.totalCharges || 0,
      savings: result.savings || 0,
      originalService: result.originalService || result.shipment.service,
      recommendedService: result.bestRate?.serviceName || 'Unknown',
      carrier: 'UPS',
      status: 'completed'
    }));

    // Format orphaned shipments (errors)
    const orphanedShipments = errorResults.map((result, index) => ({
      shipment: result.shipment,
      error: result.error,
      errorType: result.errorType || 'unknown_error',
      originalService: result.originalService || result.shipment.service,
      status: 'error'
    }));

    const analysisData = {
      totalShipments: analysisResults.length,
      completedShipments: completedResults.length,
      errorShipments: errorResults.length,
      totalCurrentCost,
      totalPotentialSavings: totalSavings,
      averageSavingsPercent: totalCurrentCost > 0 ? (totalSavings / totalCurrentCost) * 100 : 0,
      recommendations,
      orphanedShipments
    };

    navigate('/results', { 
      state: { 
        analysisComplete: true, 
        analysisData 
      } 
    });
  };
  const progress = shipments.length > 0 ? (currentShipmentIndex / shipments.length) * 100 : 0;
  const completedCount = analysisResults.filter(r => r.status === 'completed').length;
  const errorCount = analysisResults.filter(r => r.status === 'error').length;
  
  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold mb-2">Real-Time Shipping Analysis</h1>
          <p className="text-muted-foreground">
            Processing {shipments.length} shipments and comparing current rates with UPS optimization.
          </p>
        </div>
        
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
        
        {/* Validation Summary */}
        {validationState.summary.total > 0 && (
          <ValidationSummary 
            validationState={validationState} 
            shipments={shipments} 
            className="mb-6" 
          />
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
        
        {/* Real-time Results */}
        <Card>
          <CardHeader>
            <CardTitle>Live Analysis Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {analysisResults.map((result, index) => (
                <div 
                  key={index} 
                  className="flex items-center justify-between p-3 border border-border rounded-lg bg-card"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      {result.status === 'pending' && (
                        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                          <span className="text-xs">{index + 1}</span>
                        </div>
                      )}
                      {result.status === 'processing' && (
                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                          <RotateCw className="w-4 h-4 text-primary animate-spin" />
                        </div>
                      )}
                      {result.status === 'completed' && (
                        <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        </div>
                      )}
                      {result.status === 'error' && (
                        <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
                          <AlertCircle className="w-4 h-4 text-red-600" />
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <p className="font-medium text-sm">
                        {result.shipment.trackingId || `Shipment ${index + 1}`}
                      </p>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p>{result.shipment.originZip} → {result.shipment.destZip} | {result.shipment.weight}lbs</p>
                        {result.shipment.service && (
                          <p>Service: {result.shipment.service}</p>
                        )}
                        {(result.shipment.length || result.shipment.width || result.shipment.height) && (
                          <p>Dimensions: {result.shipment.length || 12}" × {result.shipment.width || 12}" × {result.shipment.height || 6}"</p>
                        )}
                        {result.status === 'processing' && (
                          <p className="text-primary font-medium">Getting UPS rates...</p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                   <div className="text-right">
                     {result.status === 'completed' && (
                       <div className="flex items-center gap-2">
                         <div className="text-right">
                           <p className="text-sm font-medium">
                             ${result.currentCost?.toFixed(2)} → ${result.bestRate?.totalCharges?.toFixed(2)}
                           </p>
                           <div className="text-xs text-muted-foreground mb-1">
                             via {result.bestRate?.serviceName || 'UPS Service'}
                           </div>
                           {result.savings && result.savings > 0 ? (
                             <Badge variant="secondary" className="bg-green-100 text-green-800">
                               Save ${result.savings.toFixed(2)}
                             </Badge>
                           ) : result.savings && result.savings < 0 ? (
                             <Badge variant="secondary" className="bg-red-100 text-red-800">
                               Loss ${Math.abs(result.savings).toFixed(2)}
                             </Badge>
                           ) : (
                             <Badge variant="outline">No change</Badge>
                           )}
                         </div>
                       </div>
                     )}
                    
                    {result.status === 'error' && (
                      <Badge variant="destructive">Error</Badge>
                    )}
                    
                    {result.status === 'processing' && (
                      <Badge variant="secondary">Processing...</Badge>
                    )}
                    
                    {result.status === 'pending' && (
                      <Badge variant="outline">Pending</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
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