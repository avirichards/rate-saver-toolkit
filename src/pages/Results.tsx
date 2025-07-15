import React, { useState, useEffect } from 'react';
import { useLocation, useParams, useSearchParams, Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui-lov/Card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { Download, DollarSign, Package, TruckIcon, ArrowDownRight, AlertCircle, Filter, CheckCircle2, XCircle, Calendar, Zap, Target, TrendingUp, ArrowUpDown, ArrowLeft, Upload, FileText, Home, Save } from 'lucide-react';
import { Button } from '@/components/ui-lov/Button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn, formatCurrency, formatPercentage, getSavingsColor } from '@/lib/utils';
import { getStateFromZip } from '@/utils/zipToStateMapping';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { useNavigate } from 'react-router-dom';
import { MarkupConfiguration, MarkupData } from '@/components/ui-lov/MarkupConfiguration';
import { SaveReportDialog } from '@/components/ui-lov/SaveReportDialog';

interface AnalysisData {
  totalCurrentCost: number;
  totalPotentialSavings: number;
  recommendations: any[];
  savingsPercentage: number;
  totalShipments: number;
  analyzedShipments: number;
  orphanedShipments?: any[];
  completedShipments?: number;
  errorShipments?: number;
  averageSavingsPercent?: number;
  file_name?: string;
  report_name?: string;
  client_id?: string;
}

// Custom slider component for All/Wins/Losses
const ResultFilter = ({ value, onChange }: { value: 'all' | 'wins' | 'losses', onChange: (value: 'all' | 'wins' | 'losses') => void }) => {
  const options = [
    { value: 'all', label: 'All' },
    { value: 'wins', label: 'Wins' },
    { value: 'losses', label: 'Losses' }
  ] as const;

  return (
    <div className="flex items-center bg-muted rounded-lg p-1">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "px-4 py-2 text-sm font-medium rounded-md transition-all",
            value === option.value
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};

const Results = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [shipmentData, setShipmentData] = useState<any[]>([]);
  const [orphanedData, setOrphanedData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [resultFilter, setResultFilter] = useState<'all' | 'wins' | 'losses'>('all');
  const [sortConfig, setSortConfig] = useState<{key: string, direction: 'asc' | 'desc'} | null>(null);
  const [availableServices, setAvailableServices] = useState<string[]>([]);
  const [selectedService, setSelectedService] = useState<string>('all');
  const [selectedServicesOverview, setSelectedServicesOverview] = useState<string[]>([]);
  const [snapshotDays, setSnapshotDays] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [markupData, setMarkupData] = useState<MarkupData | null>(null);
  const [currentAnalysisId, setCurrentAnalysisId] = useState<string | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  
  // Function to generate unique file name with numbering
  const generateUniqueFileName = async (baseName: string): Promise<string> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return baseName;

    // Get existing analyses for this user to check for name conflicts
    const { data: existingAnalyses } = await supabase
      .from('shipping_analyses')
      .select('file_name')
      .eq('user_id', user.id)
      .eq('is_deleted', false);

    if (!existingAnalyses) return baseName;

    const existingNames = existingAnalyses.map(a => a.file_name);
    
    // If base name doesn't exist, use it
    if (!existingNames.includes(baseName)) {
      return baseName;
    }

    // Find the highest number suffix
    let counter = 1;
    let uniqueName = `${baseName} (${counter})`;
    
    while (existingNames.includes(uniqueName)) {
      counter++;
      uniqueName = `${baseName} (${counter})`;
    }
    
    return uniqueName;
  };

  // Function to auto-save analysis data to database
  const autoSaveAnalysis = async (isManualSave = false) => {
    if (!analysisData || currentAnalysisId) return currentAnalysisId;
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      if (isManualSave) {
        toast.error('Please log in to save reports');
      }
      return null;
    }

    try {
      // Generate unique name based on file name
      const baseName = analysisData.file_name || 'Untitled Analysis';
      const uniqueFileName = await generateUniqueFileName(baseName);

      const analysisRecord = {
        user_id: user.id,
        file_name: uniqueFileName,
        total_shipments: analysisData.totalShipments,
        total_savings: analysisData.totalPotentialSavings,
        status: 'completed',
        original_data: analysisData.recommendations as any,
        recommendations: analysisData.recommendations as any,
        markup_data: markupData as any
      };

      const { data, error } = await supabase
        .from('shipping_analyses')
        .insert(analysisRecord)
        .select()
        .single();

      if (error) throw error;
      
      setCurrentAnalysisId(data.id);
      
      if (!isManualSave) {
        console.log('Analysis auto-saved with name:', uniqueFileName);
      }
      
      return data.id;
    } catch (error) {
      console.error('Error saving analysis:', error);
      if (isManualSave) {
        toast.error('Failed to save analysis to database');
      }
      return null;
    }
  };

  // Legacy function for backward compatibility
  const saveAnalysisToDatabase = () => autoSaveAnalysis(true);

  // Calculate markup for individual shipment
  const getShipmentMarkup = (shipment: any) => {
    if (!markupData) return { markedUpPrice: shipment.newRate, margin: 0, marginPercent: 0 };
    
    const shipProsCost = shipment.newRate || 0;
    let markupPercent = 0;
    
    if (markupData.markupType === 'global') {
      markupPercent = markupData.globalMarkup;
    } else {
      markupPercent = markupData.perServiceMarkup[shipment.service] || 0;
    }
    
    const markedUpPrice = shipProsCost * (1 + markupPercent / 100);
    const margin = markedUpPrice - shipProsCost;
    const marginPercent = shipProsCost > 0 ? (margin / shipProsCost) * 100 : 0;
    
    return { markedUpPrice, margin, marginPercent };
  };

  // Export functionality
  const exportToCSV = () => {
    const csvData = filteredData.map(item => {
      const markupInfo = getShipmentMarkup(item);
      const savings = item.currentRate - markupInfo.markedUpPrice;
      const savingsPercent = item.currentRate > 0 ? (savings / item.currentRate) * 100 : 0;
      return {
        'Tracking ID': item.trackingId,
        'Origin ZIP': item.originZip,
        'Destination ZIP': item.destinationZip,
        'Weight': item.weight,
        'Carrier': item.carrier,
        'Service': item.service,
        'Current Rate': formatCurrency(item.currentRate),
        'Ship Pros Cost': formatCurrency(markupInfo.markedUpPrice),
        'Savings': formatCurrency(savings),
        'Savings Percentage': formatPercentage(savingsPercent)
      };
    });

    const csvContent = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `shipping_analysis_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    const loadAnalysisData = async () => {
      try {
        const state = location.state as { analysisComplete?: boolean; analysisData?: AnalysisData } | null;
        const analysisIdFromQuery = searchParams.get('analysisId');
        
        if (analysisIdFromQuery) {
          // Loading from Reports tab
          await loadFromDatabase(analysisIdFromQuery);
        } else if (state?.analysisComplete && state.analysisData) {
          console.log('Using analysis data from navigation:', state.analysisData);
          setAnalysisData(state.analysisData);
          
          // Auto-save the analysis after a short delay to ensure data is fully loaded
          setTimeout(() => {
            autoSaveAnalysis(false);
          }, 1000);
          
      const formattedData = state.analysisData.recommendations.map((rec: any, index: number) => ({
        id: index + 1,
        trackingId: rec.shipment.trackingId || `Shipment-${index + 1}`,
        originZip: rec.shipment.originZip,
        destinationZip: rec.shipment.destZip,
        weight: parseFloat(rec.shipment.weight || '0'),
        carrier: rec.shipment.carrier || rec.carrier || 'Unknown',
        service: rec.originalService || rec.shipment.service,
        currentRate: rec.currentCost,
        newRate: rec.recommendedCost,
        savings: rec.savings,
        savingsPercent: rec.currentCost > 0 ? (rec.savings / rec.currentCost) * 100 : 0
      }));
          
          // Separate valid shipments from orphaned ones based on data completeness
          const validShipments: any[] = [];
          const orphanedShipments: any[] = [];
          
          state.analysisData.recommendations.forEach((rec: any, index: number) => {
            const shipmentData = rec.shipment || rec;
            const validation = validateShipmentData(shipmentData);
            
            const formattedShipment = {
              id: index + 1,
              trackingId: shipmentData.trackingId || `Shipment-${index + 1}`,
              originZip: shipmentData.originZip || '',
              destinationZip: shipmentData.destZip || '',
              weight: parseFloat(shipmentData.weight || '0'),
              carrier: shipmentData.carrier || rec.carrier || 'Unknown',
              service: rec.originalService || shipmentData.service || '',
              currentRate: rec.currentCost || 0,
              newRate: rec.recommendedCost || 0,
              savings: rec.savings || 0,
              savingsPercent: rec.currentCost > 0 ? (rec.savings / rec.currentCost) * 100 : 0
            };
            
            // Check if shipment has explicit error status OR missing data
            if (rec.status === 'error' || rec.error || !validation.isValid) {
              orphanedShipments.push({
                ...formattedShipment,
                error: rec.error || `Missing required data: ${validation.missingFields.join(', ')}`,
                errorType: rec.errorType || validation.errorType,
                missingFields: validation.missingFields
              });
            } else {
              validShipments.push(formattedShipment);
            }
          });
          
          setShipmentData(validShipments);
          setOrphanedData(orphanedShipments);
          
          // Also handle orphans from analysisData if available
          if (state.analysisData.orphanedShipments && state.analysisData.orphanedShipments.length > 0) {
            const additionalOrphans = state.analysisData.orphanedShipments.map((orphan: any, index: number) => ({
              id: orphanedShipments.length + index + 1,
              trackingId: orphan.shipment?.trackingId || `Orphan-${index + 1}`,
              originZip: orphan.shipment?.originZip || '',
              destinationZip: orphan.shipment?.destZip || '',
              weight: parseFloat(orphan.shipment?.weight || '0'),
              service: orphan.originalService || orphan.shipment?.service || '',
              error: orphan.error || 'Processing failed',
              errorType: orphan.errorType || 'Unknown'
            }));
            
            setOrphanedData(prev => [...prev, ...additionalOrphans]);
            
            console.log('Loaded orphaned shipments:', {
              fromRecommendations: orphanedShipments.length,
              fromOrphanedShipments: additionalOrphans.length,
              total: orphanedShipments.length + additionalOrphans.length
            });
          }
          
          // Initialize service data
          const services = [...new Set(formattedData.map(item => item.service).filter(Boolean))] as string[];
          setAvailableServices(services);
          setSelectedServicesOverview([]); // Default to unchecked
          
          setLoading(false);
        } else if (params.id) {
          await loadFromDatabase(params.id);
        } else {
          await loadMostRecentAnalysis();
        }
      } catch (error) {
        console.error('Error loading analysis data:', error);
        toast.error('Failed to load analysis results');
        setLoading(false);
      }
    };

    loadAnalysisData();
  }, [location, params.id, searchParams]);

  const loadFromDatabase = async (analysisId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Please log in to view results');
      setLoading(false);
      return;
    }

    console.log('Loading analysis from database:', analysisId);

    const { data, error } = await supabase
      .from('shipping_analyses')
      .select('*')
      .eq('id', analysisId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Database error loading analysis:', error);
      toast.error('Failed to load analysis: ' + error.message);
      setLoading(false);
      return;
    }

    if (!data) {
      console.warn('No analysis found with ID:', analysisId);
      toast.error('Analysis not found or you do not have permission to view it');
      navigate('/reports');
      setLoading(false);
      return;
    }

    console.log('Successfully loaded analysis:', data);
    setCurrentAnalysisId(analysisId);
    processAnalysisFromDatabase(data);
  };

  const loadMostRecentAnalysis = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Please log in to view results');
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('shipping_analyses')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Database error:', error);
      toast.error('Failed to load analysis results');
      setLoading(false);
      return;
    }

    if (!data) {
      toast.error('No analysis results found. Please run an analysis first.');
      setLoading(false);
      return;
    }

    console.log('Raw database data:', data);
    processAnalysisFromDatabase(data);
  };

  // Data validation function to check for missing critical data
  const validateShipmentData = (shipment: any): { isValid: boolean; missingFields: string[]; errorType: string } => {
    const missingFields: string[] = [];
    
    // Check for missing tracking ID
    if (!shipment.trackingId || shipment.trackingId.trim() === '') {
      missingFields.push('Tracking ID');
    }
    
    // Check for missing ZIP codes
    if (!shipment.originZip || shipment.originZip.trim() === '') {
      missingFields.push('Origin ZIP');
    }
    if (!shipment.destZip || shipment.destZip.trim() === '') {
      missingFields.push('Destination ZIP');
    }
    
    // Check for missing or invalid weight
    const weight = parseFloat(shipment.weight || '0');
    if (!shipment.weight || weight <= 0) {
      missingFields.push('Weight');
    }
    
    // Check for missing service
    if (!shipment.service || shipment.service.trim() === '') {
      missingFields.push('Service');
    }
    
    const isValid = missingFields.length === 0;
    const errorType = missingFields.length > 0 ? 'Missing Data' : 'Valid';
    
    return { isValid, missingFields, errorType };
  };

  const processAnalysisFromDatabase = async (data: any) => {
    try {
      console.log('📊 DATA INTEGRITY CHECK: Processing analysis from database:', {
        hasOriginalData: !!data.original_data,
        hasRecommendations: !!data.recommendations, 
        originalDataType: Array.isArray(data.original_data) ? 'array' : typeof data.original_data,
        originalDataLength: Array.isArray(data.original_data) ? data.original_data.length : 0,
        recommendationsType: Array.isArray(data.recommendations) ? 'array' : typeof data.recommendations,
        recommendationsLength: Array.isArray(data.recommendations) ? data.recommendations.length : 0,
        totalShipments: data.total_shipments,
        analysisId: data.id
      });

      let dataToUse = null;
      let analysisMetadata = {
        totalShipments: data.total_shipments || 0,
        totalSavings: data.total_savings || 0,
        fileName: data.file_name || 'Unknown',
        analysisDate: data.analysis_date || data.created_at
      };

      // Set current analysis ID and load markup data
      setCurrentAnalysisId(data.id);
      if (data.markup_data) {
        setMarkupData(data.markup_data as MarkupData);
      }

      // CRITICAL: Check if original_data or recommendations are missing/empty and recover from rate_quotes
      const hasValidOriginalData = Array.isArray(data.original_data) && data.original_data.length > 0;
      const hasValidRecommendations = Array.isArray(data.recommendations) && data.recommendations.length > 0;
      
      console.log('📊 DATA INTEGRITY: Availability check:', {
        hasValidOriginalData,
        hasValidRecommendations,
        needsRecovery: !hasValidOriginalData || !hasValidRecommendations
      });

      if (!hasValidOriginalData || !hasValidRecommendations) {
        console.warn('⚠️ DATA INTEGRITY: Missing analysis data, attempting recovery from rate_quotes...');
        
        // Fetch rate_quotes data for this analysis to recover missing shipments
        const { data: rateQuotes, error: rateError } = await supabase
          .from('rate_quotes')
          .select('*')
          .eq('user_id', data.user_id)
          .gte('created_at', new Date(new Date(data.created_at).getTime() - 60 * 60 * 1000).toISOString()) // 1 hour before analysis
          .lte('created_at', new Date(new Date(data.created_at).getTime() + 60 * 60 * 1000).toISOString()) // 1 hour after analysis
          .order('created_at', { ascending: true });

        if (rateError) {
          console.error('❌ Error fetching rate_quotes for recovery:', rateError);
        } else if (rateQuotes && rateQuotes.length > 0) {
          console.log('🔄 DATA RECOVERY: Found rate_quotes data:', {
            rateQuotesCount: rateQuotes.length,
            timeRange: {
              from: new Date(new Date(data.created_at).getTime() - 60 * 60 * 1000).toISOString(),
              to: new Date(new Date(data.created_at).getTime() + 60 * 60 * 1000).toISOString()
            }
          });
          
          // Use rate_quotes as primary data source
          dataToUse = rateQuotes;
          console.log('✅ DATA RECOVERY: Successfully recovered data from rate_quotes');
        } else {
          console.warn('⚠️ DATA RECOVERY: No rate_quotes found for recovery, using available data');
        }
      }

      // Use original data if available and valid, otherwise use recovered data
      if (!dataToUse) {
        if (hasValidRecommendations) {
          dataToUse = data.recommendations;
          console.log('📊 Using recommendations data as primary source');
        } else if (hasValidOriginalData) {
          dataToUse = data.original_data;
          console.log('📊 Using original_data as primary source');
        } else {
          console.error('❌ No valid data source available');
          throw new Error('No valid shipment data found in analysis');
        }
      }

      console.log('📊 DATA INTEGRITY: Final data selection:', {
        dataSource: dataToUse === data.recommendations ? 'recommendations' : 
                   dataToUse === data.original_data ? 'original_data' : 'rate_quotes',
        dataCount: Array.isArray(dataToUse) ? dataToUse.length : 0,
        willProcessShipmentData: true
      });

      // Process the shipment data and update state
      await processShipmentData(dataToUse, analysisMetadata);

    } catch (error: any) {
      console.error('❌ Error processing analysis from database:', error);
      setError(`Failed to load analysis data: ${error.message}`);
      setLoading(false);
    }
  };

  const processShipmentData = (dataToUse: any[], analysisMetadata: any) => {
    console.log('🔍 DATA INTEGRITY: Starting processShipmentData:', {
      inputCount: dataToUse.length,
      expectedShipments: analysisMetadata.totalShipments || 0,
      sampleData: dataToUse.slice(0, 2).map(d => ({
        type: typeof d,
        hasShipment: !!d.shipment,
        hasTrackingId: !!(d.shipment?.trackingId || d.trackingId),
        trackingId: d.shipment?.trackingId || d.trackingId || 'missing'
      }))
    });

    const dataIntegrityLog = {
      inputShipments: dataToUse.length,
      expectedShipments: analysisMetadata.totalShipments || 0,
      processedShipments: 0,
      validShipments: 0,
      orphanedShipments: 0,
      missingShipments: 0
    };
    
    const validShipments: any[] = [];
    const orphanedShipments: any[] = [];
    
    dataToUse.forEach((rec: any, index: number) => {
      dataIntegrityLog.processedShipments++;
      
      // Handle both rate_quotes format and recommendations format
      let shipmentData = rec.shipment || rec.shipment_data || rec;
      let errorStatus = rec.error || rec.status === 'error' ? rec.error || 'Processing failed' : null;
      
      // If this is a rate_quote record, extract proper shipment data
      if (rec.shipment_data && !rec.shipment) {
        shipmentData = rec.shipment_data;
        console.log('🔄 Converting rate_quote to shipment format for:', rec.shipment_data?.trackingId);
      }
      
      const validation = validateShipmentData(shipmentData);
      const trackingId = shipmentData?.trackingId || `Unknown-${index + 1}`;
      
      console.log(`🔍 PROCESSING SHIPMENT ${trackingId}:`, {
        isValid: validation.isValid,
        missingFields: validation.missingFields,
        errorType: validation.errorType,
        hasDestZip: !!shipmentData?.destZip,
        hasOriginZip: !!shipmentData?.originZip,
        hasService: !!shipmentData?.service,
        hasWeight: !!shipmentData?.weight,
        hasError: !!errorStatus,
        recordType: rec.shipment ? 'recommendation' : rec.shipment_data ? 'rate_quote' : 'raw_data'
      });

      // CRITICAL: Move ANY shipment with missing critical data to orphans, even if marked "completed"
      if (!validation.isValid || errorStatus) {
        dataIntegrityLog.orphanedShipments++;
        
        const orphanReason = errorStatus || `Missing: ${validation.missingFields.join(', ')}`;
        console.warn(`❌ MOVING TO ORPHANS: ${trackingId} - ${orphanReason}`);
        
        orphanedShipments.push({
          id: index + 1,
          trackingId: shipmentData?.trackingId || `Orphan-${index + 1}`,
          originZip: shipmentData?.originZip || '',
          destinationZip: shipmentData?.destZip || '',
          weight: parseFloat(shipmentData?.weight || '0'),
          service: shipmentData?.service || rec.originalService || 'Unknown',
          error: orphanReason,
          errorType: validation.errorType || 'Processing Error',
          missingFields: validation.missingFields
        });
      } else {
        dataIntegrityLog.validShipments++;
        console.log(`✅ VALID SHIPMENT: ${trackingId}`);
        
        validShipments.push({
          id: index + 1,
          trackingId: shipmentData?.trackingId || `Shipment-${index + 1}`,
          originZip: shipmentData?.originZip || '',
          destinationZip: shipmentData?.destZip || '',
          weight: parseFloat(shipmentData?.weight || '0'),
          carrier: shipmentData?.carrier || rec.carrier || 'Unknown',
          service: rec.originalService || shipmentData?.service || 'Unknown',
          currentRate: rec.currentCost || rec.published_rate || 0,
          newRate: rec.recommendedCost || rec.negotiated_rate || rec.published_rate || 0,
          savings: rec.savings || rec.savings_amount || 0,
          savingsPercent: (rec.currentCost || rec.published_rate || 0) > 0 ? 
            ((rec.savings || rec.savings_amount || 0) / (rec.currentCost || rec.published_rate || 1)) * 100 : 0
        });
      }
    });
    
    // Calculate missing shipments
    dataIntegrityLog.missingShipments = Math.max(0, dataIntegrityLog.expectedShipments - dataIntegrityLog.processedShipments);
    
    console.log('📊 FINAL DATA INTEGRITY REPORT:', dataIntegrityLog);
    
    // Critical data integrity validation
    if (dataIntegrityLog.missingShipments > 0) {
      console.error('🚨 DATA INTEGRITY ERROR: Missing shipments detected!', {
        expected: dataIntegrityLog.expectedShipments,
        processed: dataIntegrityLog.processedShipments,
        missing: dataIntegrityLog.missingShipments
      });
    }
    
    // Update UI state
    setShipmentData(validShipments);
    setOrphanedData(orphanedShipments);
    
    // Initialize service data for filtering
    const services = [...new Set(validShipments.map(item => item.service).filter(Boolean))] as string[];
    setAvailableServices(services);
    setSelectedServicesOverview([]);
    
    // Update filtered data for display
    setFilteredData(validShipments);
    
    // Update analysis summary
    const totalSavings = validShipments.reduce((sum, s) => sum + (s.savings || 0), 0);
    const totalCurrentCost = validShipments.reduce((sum, s) => sum + (s.currentCost || 0), 0);
    
    setAnalysisData({
      totalShipments: dataIntegrityLog.processedShipments,
      analyzedShipments: dataIntegrityLog.validShipments,
      completedShipments: dataIntegrityLog.validShipments,
      errorShipments: dataIntegrityLog.orphanedShipments,
      totalCurrentCost,
      totalPotentialSavings: totalSavings,
      savingsPercentage: totalCurrentCost > 0 ? (totalSavings / totalCurrentCost) * 100 : 0,
      averageSavingsPercent: totalCurrentCost > 0 ? (totalSavings / totalCurrentCost) * 100 : 0,
      recommendations: validShipments,
      orphanedShipments: orphanedShipments,
      file_name: analysisMetadata.fileName
    });
    
    setLoading(false);
    
    console.log('✅ DATA INTEGRITY: Processing complete:', {
      validShipments: validShipments.length,
      orphanedShipments: orphanedShipments.length,
      totalShipments: dataIntegrityLog.processedShipments,
      dataIntegrityPassed: dataIntegrityLog.missingShipments === 0
    });
  };

  // New filtering and sorting logic
  useEffect(() => {
    let filtered = [...shipmentData];

    // Apply result filter (all/wins/losses)
    if (resultFilter === 'wins') {
      filtered = filtered.filter(item => item.savings > 0);
    } else if (resultFilter === 'losses') {
      filtered = filtered.filter(item => item.savings < 0);
    }

    // Apply service filter
    if (selectedService !== 'all') {
      filtered = filtered.filter(item => item.service === selectedService);
    }

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(item => 
        item.trackingId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.originZip.includes(searchTerm) ||
        item.destinationZip.includes(searchTerm) ||
        item.service.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply sorting
    if (sortConfig) {
      filtered.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];
        
        // Handle numeric values
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
        }
        
        // Handle string values
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortConfig.direction === 'asc' 
            ? aValue.localeCompare(bValue) 
            : bValue.localeCompare(aValue);
        }
        
        return 0;
      });
    }

    setFilteredData(filtered);
  }, [shipmentData, resultFilter, selectedService, availableServices.length, searchTerm, sortConfig]);

  // Handle column sorting
  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Get filtered statistics for overview page (for stats calculation, not table display)
  const getOverviewFilteredData = () => {
    if (selectedServicesOverview.length === 0) {
      return shipmentData; // Return all data if no services selected (treat as all selected)
    }
    return shipmentData.filter(item => selectedServicesOverview.includes(item.service));
  };

  // Get filtered statistics
  const getFilteredStats = () => {
    const dataToUse = getOverviewFilteredData();
    const totalShipments = dataToUse.length;
    const totalCurrentCost = dataToUse.reduce((sum, item) => sum + item.currentRate, 0);
    
    // Calculate Ship Pros Cost and Savings with markup
    const totalShipProsCost = dataToUse.reduce((sum, item) => {
      const markupInfo = getShipmentMarkup(item);
      return sum + markupInfo.markedUpPrice;
    }, 0);
    
    const totalSavings = dataToUse.reduce((sum, item) => {
      const markupInfo = getShipmentMarkup(item);
      const savings = item.currentRate - markupInfo.markedUpPrice;
      return sum + savings;
    }, 0);
    
    const averageSavingsPercent = totalCurrentCost > 0 ? (totalSavings / totalCurrentCost) * 100 : 0;
    
    return {
      totalShipments,
      totalCurrentCost,
      totalShipProsCost,
      totalSavings,
      averageSavingsPercent
    };
  };

  // Service multi-select component for overview
  const ServiceMultiSelect = () => {
    const toggleService = (service: string) => {
      setSelectedServicesOverview(prev => 
        prev.includes(service) 
          ? prev.filter(s => s !== service)
          : [...prev, service]
      );
    };

    const selectAll = () => {
      setSelectedServicesOverview(availableServices);
    };

    const clearAll = () => {
      setSelectedServicesOverview([]);
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Filter by Service Type</h3>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={selectAll}>
              Select All
            </Button>
            <Button variant="outline" size="sm" onClick={clearAll}>
              Clear All
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {availableServices.map(service => (
            <div key={service} className="flex items-center space-x-2">
              <Checkbox
                id={service}
                checked={selectedServicesOverview.includes(service)}
                onCheckedChange={() => toggleService(service)}
              />
              <label htmlFor={service} className="text-sm font-medium cursor-pointer">
                {service}
              </label>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Custom tick component for zone chart
  const ZoneTick = (props: any) => {
    const { x, y, payload } = props;
    const data = generateZoneChartData().find(item => item.zone === payload.value);
    if (!data) return null;
    
    return (
      <g transform={`translate(${x},${y})`}>
        <text x={0} y={0} dy={20} textAnchor="middle" fill="hsl(var(--foreground))" fontSize="16" fontWeight="700">
          {data.zoneName}
        </text>
        <text x={0} y={0} dy={38} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="12" fontWeight="500">
          {data.shipmentCount} shipments
        </text>
      </g>
    );
  };

  // Chart data generators - use overview filtered data
  const generateServiceChartData = () => {
    const dataToUse = getOverviewFilteredData();
    const serviceCount = dataToUse.reduce((acc, item) => {
      const service = item.service || 'Unknown';
      acc[service] = (acc[service] || 0) + 1;
      return acc;
    }, {});
    
    return Object.entries(serviceCount).map(([name, value]) => ({ name, value }));
  };

  // Weight ranges configuration
  const WEIGHT_RANGES = [
    { min: 1, max: 9, label: '01-09 lbs' },
    { min: 10, max: 19, label: '10-19 lbs' },
    { min: 20, max: 29, label: '20-29 lbs' },
    { min: 30, max: 39, label: '30-39 lbs' },
    { min: 40, max: 49, label: '40-49 lbs' },
    { min: 50, max: 69, label: '50-69 lbs' },
    { min: 70, max: 99, label: '70-99 lbs' },
    { min: 100, max: 139, label: '100-139 lbs' },
    { min: 140, max: 149, label: '140-149 lbs' },
    { min: 150, max: 999, label: '150+ lbs' }
  ];

  // Calculate shipping zone based on origin and destination ZIP codes
  const calculateShippingZone = (originZip: string, destZip: string): number => {
    const originState = getStateFromZip(originZip)?.state;
    const destState = getStateFromZip(destZip)?.state;
    
    if (!originState || !destState) return 8; // Default to highest zone for invalid ZIPs
    
    if (originState === destState) return 2; // Same state
    
    // Define regional zones
    const regions = {
      northeast: ['CT', 'ME', 'MA', 'NH', 'NJ', 'NY', 'PA', 'RI', 'VT'],
      southeast: ['AL', 'AR', 'DE', 'FL', 'GA', 'KY', 'LA', 'MD', 'MS', 'NC', 'OK', 'SC', 'TN', 'TX', 'VA', 'WV'],
      midwest: ['IL', 'IN', 'IA', 'KS', 'MI', 'MN', 'MO', 'NE', 'ND', 'OH', 'SD', 'WI'],
      west: ['AK', 'AZ', 'CA', 'CO', 'HI', 'ID', 'MT', 'NV', 'NM', 'OR', 'UT', 'WA', 'WY']
    };
    
    const getRegion = (state: string) => {
      for (const [region, states] of Object.entries(regions)) {
        if (states.includes(state)) return region;
      }
      return 'other';
    };
    
    const originRegion = getRegion(originState);
    const destRegion = getRegion(destState);
    
    if (originRegion === destRegion) return 3; // Same region
    
    // Adjacent regions
    const adjacentRegions: Record<string, string[]> = {
      northeast: ['southeast', 'midwest'],
      southeast: ['northeast', 'midwest'],
      midwest: ['northeast', 'southeast', 'west'],
      west: ['midwest']
    };
    
    if (adjacentRegions[originRegion]?.includes(destRegion)) return 4;
    
    // Coast to coast
    if ((originRegion === 'northeast' && destRegion === 'west') || 
        (originRegion === 'west' && destRegion === 'northeast')) return 7;
    
    return 5; // Default for other combinations
  };

  const generateServiceCostData = () => {
    const dataToUse = getOverviewFilteredData();
    const serviceStats = dataToUse.reduce((acc, item) => {
      const service = item.service || 'Unknown';
      if (!acc[service]) {
        acc[service] = { 
          totalCurrent: 0, 
          totalNew: 0, 
          shipments: 0,
          totalSavings: 0,
          bestServices: [] as string[]
        };
      }
      
      const markupInfo = getShipmentMarkup(item);
      const savings = item.currentRate - markupInfo.markedUpPrice;
      
      acc[service].totalCurrent += item.currentRate;
      acc[service].totalNew += markupInfo.markedUpPrice;
      acc[service].shipments += 1;
      acc[service].totalSavings += savings;
      acc[service].bestServices.push(item.bestService || 'UPS Ground');
      return acc;
    }, {});
    
    return Object.entries(serviceStats).map(([name, stats]: [string, any]) => {
      // Find the most common Ship Pros service for this current service
      const serviceCounts = stats.bestServices.reduce((acc: any, srv: string) => {
        acc[srv] = (acc[srv] || 0) + 1;
        return acc;
      }, {});
      const mostCommonShipProsService = Object.entries(serviceCounts)
        .sort(([,a], [,b]) => (b as number) - (a as number))[0]?.[0] || 'UPS Ground';
      
      const avgCurrentCost = stats.totalCurrent / stats.shipments;
      const avgNewCost = stats.totalNew / stats.shipments;
      const isWin = avgNewCost < avgCurrentCost;
      
      return {
        currentService: name,
        shipProsService: mostCommonShipProsService,
        currentCost: stats.totalCurrent,
        newCost: stats.totalNew,
        avgCurrentCost,
        avgNewCost,
        savings: stats.totalSavings,
        shipments: stats.shipments,
        isWin,
        newCostColor: isWin ? "#22c55e" : "#ef4444"
      };
    });
  };

  // Generate chart data for weight breakdown
  const generateWeightChartData = () => {
    const filteredShipments = getOverviewFilteredData();
    
    if (filteredShipments.length === 0) {
      return [];
    }

    const weightStats = new Map();
    
    // Initialize all weight ranges
    WEIGHT_RANGES.forEach(range => {
      weightStats.set(range.label, {
        weightRange: range.label,
        totalCurrent: 0,
        totalNew: 0,
        count: 0
      });
    });
    
    filteredShipments.forEach(shipment => {
      const weight = shipment.weight || 0;
      const range = WEIGHT_RANGES.find(r => weight >= r.min && weight <= r.max);
      
      if (range) {
        const stats = weightStats.get(range.label);
        const markupInfo = getShipmentMarkup(shipment);
        stats.totalCurrent += shipment.currentRate || 0;
        stats.totalNew += markupInfo.markedUpPrice || 0;
        stats.count += 1;
      }
    });
    
    return Array.from(weightStats.values())
      .filter(stats => stats.count > 0)
      .map(stats => ({
        weightRange: stats.weightRange,
        avgCurrentCost: stats.totalCurrent / stats.count,
        avgNewCost: stats.totalNew / stats.count,
        shipmentCount: stats.count
      }));
  };

  // Generate chart data for zone breakdown
  const generateZoneChartData = () => {
    const filteredShipments = getOverviewFilteredData();
    
    if (filteredShipments.length === 0) {
      return [];
    }

    const zoneStats = new Map();
    
    filteredShipments.forEach(shipment => {
      const zone = calculateShippingZone(shipment.originZip || '', shipment.destinationZip || '');
      const zoneLabel = `Zone ${zone}`;
      
      if (!zoneStats.has(zoneLabel)) {
        zoneStats.set(zoneLabel, {
          zone: zoneLabel,
          totalCurrent: 0,
          totalNew: 0,
          count: 0
        });
      }
      
      const stats = zoneStats.get(zoneLabel);
      const markupInfo = getShipmentMarkup(shipment);
      stats.totalCurrent += shipment.currentRate || 0;
      stats.totalNew += markupInfo.markedUpPrice || 0;
      stats.count += 1;
    });
    
    return Array.from(zoneStats.values())
      .sort((a, b) => parseInt(a.zone.replace('Zone ', '')) - parseInt(b.zone.replace('Zone ', '')))
      .map(stats => ({
        zone: stats.zone,
        zoneName: stats.zone,
        shipmentCount: stats.count,
        avgCurrentCost: stats.totalCurrent / stats.count,
        avgNewCost: stats.totalNew / stats.count
      }));
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto p-6">
          <div className="text-center animate-fade-in">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-muted rounded w-1/3 mx-auto"></div>
              <div className="h-4 bg-muted rounded w-1/2 mx-auto"></div>
            </div>
            <p className="text-lg mt-4">Loading analysis results...</p>
          </div>
      </div>

      {/* Save Report Dialog */}
      <SaveReportDialog
        open={showSaveDialog}
        onOpenChange={setShowSaveDialog}
        analysisId={currentAnalysisId || searchParams.get('analysisId') || ''}
        currentReportName={analysisData?.report_name || analysisData?.file_name || ''}
        currentClientId={analysisData?.client_id || ''}
        onSaved={async () => {
          // Reload analysis data to show updated status
          const analysisId = searchParams.get('analysisId') || currentAnalysisId;
          if (analysisId) {
            try {
              await loadFromDatabase(analysisId);
            } catch (error) {
              console.error('Error reloading analysis data:', error);
            }
          }
        }}
      />
    </DashboardLayout>
  );
}

  if (!analysisData || shipmentData.length === 0) {
  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto p-6">
          <div className="text-center">
            <AlertCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-2xl font-semibold mb-2">No Analysis Results Found</h2>
            <p className="text-muted-foreground">Please run an analysis first to see results here.</p>
            <Button className="mt-4" onClick={() => window.location.href = '/upload'}>
              Start New Analysis
            </Button>
          </div>
      </div>

    </DashboardLayout>
  );
}

  // Calculate filtered stats and chart data before rendering
  const filteredStats = getFilteredStats();
  const serviceChartData = generateServiceChartData();
  const serviceCostData = generateServiceCostData();
  const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF7C7C'];

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto p-6 animate-fade-in">
        {/* Breadcrumb Navigation */}
        {(searchParams.get('analysisId') || currentAnalysisId) && (
          <div className="mb-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Link to="/" className="hover:text-foreground transition-colors">
                <Home className="h-4 w-4" />
              </Link>
              <span>/</span>
              <Link to="/reports" className="hover:text-foreground transition-colors">
                Reports
              </Link>
              <span>/</span>
              <span className="text-foreground font-medium">Analysis Results</span>
            </div>
          </div>
        )}

        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              {(searchParams.get('analysisId') || currentAnalysisId) && (
                <Link to="/reports">
                  <Button
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Reports
                  </Button>
                </Link>
              )}
              <Button
                variant="outline"
                onClick={() => navigate('/upload')}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Upload
              </Button>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                  Analysis Results
                </h1>
                <p className="text-muted-foreground mt-2">
                  Comprehensive shipping analysis for {analysisData.totalShipments} shipments
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              {analysisData && (
                <Button variant="default" size="sm" onClick={async () => {
                  // Ensure analysis is saved to database before showing save dialog
                  const analysisId = await autoSaveAnalysis(true);
                  if (analysisId) {
                    setShowSaveDialog(true);
                  }
                }}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Report
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')}>
                <Home className="h-4 w-4 mr-2" />
                Dashboard
              </Button>
              <Button variant="outline" size="sm" onClick={exportToCSV}>
                <Download className="h-4 w-4 mr-2" />
                Export Report
              </Button>
              <Button size="sm" onClick={() => navigate('/upload')}>
                <Upload className="h-4 w-4 mr-2" />
                New Analysis
              </Button>
            </div>
          </div>

        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="shipment-data" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Shipment Data
            </TabsTrigger>
            <TabsTrigger value="orphaned-data" className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Orphaned Data ({orphanedData.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">

            {/* Snapshot Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Input
                    type="number"
                    value={snapshotDays}
                    onChange={(e) => setSnapshotDays(parseInt(e.target.value) || 30)}
                    className="w-20 text-2xl font-bold border-none p-0 h-auto bg-transparent"
                    min="1"
                    max="365"
                  />
                  <span>Day Snapshot</span>
                </CardTitle>
                <CardDescription>
                  {filteredStats.totalShipments} shipments selected out of {shipmentData.length} total shipments
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                  <Card className="border-l-4 border-l-purple-500">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <Target className="h-8 w-8 text-purple-500" />
                        <div>
                          <p className="text-sm text-muted-foreground">Current Cost</p>
                          <p className="text-2xl font-bold">{formatCurrency(filteredStats.totalCurrentCost)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-l-4 border-l-blue-500">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <Zap className="h-8 w-8 text-blue-500" />
                        <div>
                          <p className="text-sm text-muted-foreground">Ship Pros Cost</p>
                          <p className="text-2xl font-bold text-primary">{formatCurrency(filteredStats.totalShipProsCost)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-l-4 border-l-green-500">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <DollarSign className="h-8 w-8 text-green-500" />
                        <div>
                          <p className="text-sm text-muted-foreground">Savings ($)</p>
                          <p className={cn("text-2xl font-bold", getSavingsColor(filteredStats.totalSavings))}>{formatCurrency(filteredStats.totalSavings)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-l-4 border-l-orange-500">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <TrendingUp className="h-8 w-8 text-orange-500" />
                        <div>
                          <p className="text-sm text-muted-foreground">Savings (%)</p>
                          <p className={cn("text-2xl font-bold", getSavingsColor(filteredStats.totalSavings))}>{formatPercentage(filteredStats.averageSavingsPercent)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-l-4 border-l-green-500">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <Calendar className="h-8 w-8 text-green-500" />
                        <div>
                          <p className="text-sm text-muted-foreground">Estimated Annual Savings</p>
                          <p className={cn("text-2xl font-bold", getSavingsColor((filteredStats.totalSavings * 365) / snapshotDays))}>{formatCurrency((filteredStats.totalSavings * 365) / snapshotDays)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>

            {/* Markup Configuration Section */}
            <MarkupConfiguration
              shipmentData={shipmentData}
              analysisId={currentAnalysisId}
              onMarkupChange={setMarkupData}
              initialMarkupData={markupData}
            />

            {/* Service Analysis Table */}
            <Card>
              <CardHeader>
                <CardTitle>Service Analysis Overview</CardTitle>
                <CardDescription>Detailed breakdown by service type with savings analysis</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow className="border-b border-border">
                        <TableHead className="text-foreground w-12">
                          <Checkbox 
                            checked={selectedServicesOverview.length === availableServices.length}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedServicesOverview(availableServices);
                              } else {
                                setSelectedServicesOverview([]);
                              }
                            }}
                          />
                        </TableHead>
                        <TableHead className="text-foreground">Current Service Type</TableHead>
                        <TableHead className="text-right text-foreground">Avg Cost Current</TableHead>
                        <TableHead className="text-right text-foreground">Ship Pros Cost</TableHead>
                        <TableHead className="text-foreground">Ship Pros Service Type</TableHead>
                        <TableHead className="text-right text-foreground">Shipment Count</TableHead>
                        <TableHead className="text-right text-foreground">Volume %</TableHead>
                        <TableHead className="text-right text-foreground">Avg Weight</TableHead>
                        <TableHead className="text-right text-foreground">Avg Savings ($)</TableHead>
                        <TableHead className="text-right text-foreground">Avg Savings (%)</TableHead>
                        <TableHead className="text-foreground">Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                     <TableBody className="bg-background">
                       {(() => {
                         // Show ALL services in the table, not just selected ones
                         const serviceAnalysis = shipmentData.reduce((acc, item) => {
                           const service = item.service || 'Unknown';
                           if (!acc[service]) {
                             acc[service] = {
                               currentCost: 0,
                               newCost: 0,
                               savings: 0,
                               weight: 0,
                               count: 0,
                               carrier: item.carrier || 'Unknown'
                             };
                           }
                           acc[service].currentCost += item.currentRate;
                           acc[service].newCost += item.newRate;
                           acc[service].savings += item.savings;
                           acc[service].weight += item.weight;
                           acc[service].count += 1;
                           return acc;
                         }, {} as Record<string, any>);

                         return Object.entries(serviceAnalysis).map(([service, data]: [string, any]) => {
                           const avgCurrentCost = data.currentCost / data.count;
                           const avgNewCost = data.newCost / data.count;
                           const avgSavings = data.savings / data.count;
                           const avgWeight = data.weight / data.count;
                           const volumePercent = (data.count / shipmentData.length) * 100;
                           const avgSavingsPercent = avgCurrentCost > 0 ? (avgSavings / avgCurrentCost) * 100 : 0;
                            // Determine the most common Ship Pros service for this current service
                            const shipProsSample = shipmentData.filter(item => item.service === service);
                            const upsServices = shipProsSample.map(item => item.bestService || 'UPS Ground');
                            const mostCommonUpsService = upsServices.reduce((acc, srv) => {
                              acc[srv] = (acc[srv] || 0) + 1;
                              return acc;
                            }, {} as Record<string, number>);
                            const spServiceType = Object.entries(mostCommonUpsService)
                              .sort(([,a], [,b]) => (b as number) - (a as number))[0]?.[0] || 'UPS Ground';
                           
                            // Calculate markup info for this service
                            const serviceShipments = shipmentData.filter(item => item.service === service);
                            const avgMarkedUpPrice = serviceShipments.reduce((sum, item) => {
                              const markupInfo = getShipmentMarkup(item);
                              return sum + markupInfo.markedUpPrice;
                            }, 0) / serviceShipments.length;
                            
                            // Update savings calculations to use marked-up price
                            const avgSavingsWithMarkup = avgCurrentCost - avgMarkedUpPrice;
                            const avgSavingsPercentWithMarkup = avgCurrentCost > 0 ? (avgSavingsWithMarkup / avgCurrentCost) * 100 : 0;

                            return (
                              <TableRow key={service} className="hover:bg-muted/30 border-b border-border/30">
                                <TableCell className="w-12">
                                  <Checkbox 
                                    checked={selectedServicesOverview.includes(service)}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setSelectedServicesOverview(prev => [...prev, service]);
                                      } else {
                                        setSelectedServicesOverview(prev => prev.filter(s => s !== service));
                                      }
                                    }}
                                  />
                                </TableCell>
                                <TableCell className="font-medium text-foreground">{service}</TableCell>
                                 <TableCell className="text-right font-medium">{formatCurrency(avgCurrentCost)}</TableCell>
                                 <TableCell className="text-right font-medium text-primary">{formatCurrency(avgMarkedUpPrice)}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-xs">
                                    {spServiceType}
                                  </Badge>
                                </TableCell>
                                 <TableCell className="text-right font-medium">{data.count.toLocaleString()}</TableCell>
                                 <TableCell className="text-right">{formatPercentage(volumePercent)}</TableCell>
                                 <TableCell className="text-right">{(avgWeight || 0).toFixed(1)}</TableCell>
                                 <TableCell className="text-right">
                                   <span className={cn("font-medium", getSavingsColor(avgSavingsWithMarkup))}>
                                     {formatCurrency(avgSavingsWithMarkup)}
                                   </span>
                                 </TableCell>
                                 <TableCell className="text-right">
                                   <span className={cn("font-medium", getSavingsColor(avgSavingsWithMarkup))}>
                                     {formatPercentage(avgSavingsPercentWithMarkup)}
                                   </span>
                                 </TableCell>
                                <TableCell>
                                  <div className="text-xs text-muted-foreground">
                                    {avgSavingsPercentWithMarkup > 20 ? "High savings potential" : 
                                     avgSavingsPercentWithMarkup > 10 ? "Good savings" : 
                                     avgSavingsPercentWithMarkup > 0 ? "Moderate savings" : 
                                     "Review needed"}
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                         });
                       })()}
                     </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Service Distribution Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Service Distribution</CardTitle>
                  <CardDescription>Breakdown of shipments by service type</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={serviceChartData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                           label={({ name, percent }) => {
                             const shortName = name.length > 12 ? name.split(' ').slice(0, 2).join(' ') : name;
                             return `${shortName}\n${((percent || 0) * 100).toFixed(0)}%`;
                           }}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {serviceChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Service Cost Comparison */}
              <Card>
                <CardHeader>
                  <CardTitle>Cost Comparison by Service</CardTitle>
                  <CardDescription>Current vs Ship Pros rates by service type</CardDescription>
                </CardHeader>
                <CardContent className="p-2">
                  {/* Legend */}
                  <div className="flex items-center justify-center gap-6 mb-4 p-2 bg-muted/30 rounded">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-destructive rounded"></div>
                      <span className="text-sm">Current Cost</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-green-500 rounded"></div>
                      <span className="text-sm">Ship Pros Savings (Green = Lower Cost)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-red-500 rounded"></div>
                      <span className="text-sm">Ship Pros Increase (Red = Higher Cost)</span>
                    </div>
                  </div>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={serviceCostData} margin={{ top: 5, right: 5, left: 5, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                         <XAxis 
                           dataKey="currentService" 
                           tick={{ fill: 'hsl(var(--foreground))', fontSize: 11 }}
                           interval={0}
                           height={50}
                           angle={-45}
                           textAnchor="end"
                           axisLine={{ stroke: 'hsl(var(--border))' }}
                         />
                         <YAxis 
                           tickFormatter={(value) => `$${value}`} 
                           tick={{ fill: 'hsl(var(--foreground))' }}
                           axisLine={{ stroke: 'hsl(var(--border))' }}
                         />
                         <Tooltip 
                           formatter={(value, name) => [formatCurrency(Number(value)), name]} 
                           labelFormatter={(label) => {
                             const item = serviceCostData.find(d => d.currentService === label);
                             return item ? `${item.currentService} → ${item.shipProsService}` : label;
                           }}
                           contentStyle={{
                             backgroundColor: 'hsl(var(--popover))',
                             border: '1px solid hsl(var(--border))',
                             borderRadius: '6px',
                             color: 'hsl(var(--popover-foreground))'
                           }}
                         />
                         <Bar dataKey="currentCost" fill="hsl(var(--destructive))" name="Current Cost" radius={[2, 2, 0, 0]} />
                         <Bar dataKey="newCost" name="Ship Pros Cost" radius={[2, 2, 0, 0]}>
                           {serviceCostData.map((entry, index) => (
                             <Cell key={`cell-${index}`} fill={entry.newCostColor} />
                           ))}
                         </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Weight Breakdown Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Rate Comparison by Weight
                  </CardTitle>
                  <CardDescription>
                    Average cost comparison by weight ranges (lbs)
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-2">
                  {/* Legend */}
                  <div className="flex items-center justify-center gap-6 mb-4 p-2 bg-muted/30 rounded">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-destructive rounded"></div>
                      <span className="text-sm">Current Cost</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-green-500 rounded"></div>
                      <span className="text-sm">Ship Pros Cost (Lower = Green)</span>
                    </div>
                  </div>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={generateWeightChartData()} margin={{ top: 5, right: 5, left: 5, bottom: 50 }}>
                         <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                         <XAxis 
                           dataKey="weightRange" 
                           tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }}
                           angle={-45}
                           textAnchor="end"
                           height={50}
                           axisLine={{ stroke: 'hsl(var(--border))' }}
                         />
                         <YAxis 
                           tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }} 
                           tickFormatter={(value) => `$${value}`}
                           axisLine={{ stroke: 'hsl(var(--border))' }}
                         />
                         <Tooltip 
                           formatter={(value: any, name: string) => [
                             formatCurrency(value), 
                             name === 'avgCurrentCost' ? 'Current Cost' : 'Ship Pros Cost'
                           ]}
                           contentStyle={{
                             backgroundColor: 'hsl(var(--popover))',
                             border: '1px solid hsl(var(--border))',
                             borderRadius: '6px',
                             color: 'hsl(var(--popover-foreground))'
                           }}
                         />
                        <Bar dataKey="avgCurrentCost" fill="hsl(var(--destructive))" name="Current Cost" radius={[2, 2, 0, 0]} />
                        <Bar dataKey="avgNewCost" fill="#22c55e" name="Ship Pros Cost" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Zone Breakdown Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Rate Comparison by Zone
                  </CardTitle>
                  <CardDescription>
                    Average cost comparison by shipping zones
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-2">
                  {/* Legend */}
                  <div className="flex items-center justify-center gap-6 mb-4 p-2 bg-muted/30 rounded">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-destructive rounded"></div>
                      <span className="text-sm">Current Cost</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-green-500 rounded"></div>
                      <span className="text-sm">Ship Pros Cost (Lower = Green)</span>
                    </div>
                  </div>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={generateZoneChartData()} margin={{ top: 5, right: 5, left: 5, bottom: 50 }}>
                         <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                         <XAxis 
                           dataKey="zone" 
                           tick={ZoneTick}
                           interval={0}
                           height={50}
                           axisLine={{ stroke: 'hsl(var(--border))' }}
                         />
                         <YAxis 
                           tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }} 
                           tickFormatter={(value) => `$${value}`}
                           axisLine={{ stroke: 'hsl(var(--border))' }}
                         />
                         <Tooltip 
                           formatter={(value: any, name: string) => [
                             formatCurrency(value), 
                             name === 'avgCurrentCost' ? 'Current Cost' : 'Ship Pros Cost'
                           ]}
                           labelFormatter={(label) => {
                             const item = generateZoneChartData().find(d => d.zone === label);
                             return item ? `${item.zoneName} (${item.shipmentCount} shipments)` : label;
                           }}
                           contentStyle={{
                             backgroundColor: 'hsl(var(--popover))',
                             border: '1px solid hsl(var(--border))',
                             borderRadius: '6px',
                             color: 'hsl(var(--popover-foreground))'
                           }}
                         />
                        <Bar dataKey="avgCurrentCost" fill="hsl(var(--destructive))" name="Current Cost" radius={[2, 2, 0, 0]} />
                        <Bar dataKey="avgNewCost" fill="#22c55e" name="Ship Pros Cost" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="shipment-data" className="space-y-6">
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl">Shipment Analysis</CardTitle>
                    <CardDescription>
                      Detailed view of all analyzed shipments with current vs Ship Pros rates
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-sm">
                    {filteredData.length} of {shipmentData.length} shipments
                  </Badge>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-4 pt-4">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Filters:</span>
                  </div>
                  
                  <ResultFilter value={resultFilter} onChange={setResultFilter} />
                  
                  <Select value={selectedService} onValueChange={setSelectedService}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Filter by service" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Services</SelectItem>
                      {availableServices.map(service => (
                        <SelectItem key={service} value={service}>{service}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Input
                    placeholder="Search tracking ID, zip codes..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-64"
                  />
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow className="border-b border-border">
                        <TableHead className="text-foreground">Tracking ID</TableHead>
                        <TableHead className="text-foreground">Origin</TableHead>
                        <TableHead className="text-foreground">Destination</TableHead>
                        <TableHead className="text-foreground">Weight (lbs)</TableHead>
                        <TableHead className="text-foreground">Carrier</TableHead>
                        <TableHead className="text-foreground">Service</TableHead>
                        <TableHead className="text-right text-foreground">Current Rate</TableHead>
                        <TableHead className="text-right text-foreground">Ship Pros Cost</TableHead>
                        <TableHead className="text-right text-foreground">Savings</TableHead>
                        <TableHead className="text-right text-foreground">Savings %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="bg-background">
                      {filteredData.map((item, index) => (
                        <TableRow 
                          key={item.id} 
                          className={cn(
                            "hover:bg-muted/30 border-b border-border/30",
                            index % 2 === 0 ? "bg-background" : "bg-muted/20"
                          )}
                        >
                          <TableCell className="font-medium text-foreground">
                            {item.trackingId}
                          </TableCell>
                          <TableCell className="text-foreground">
                            {item.originZip}
                          </TableCell>
                          <TableCell className="text-foreground">
                            {item.destinationZip}
                          </TableCell>
                          <TableCell className="text-foreground">
                            {(item.weight || 0).toFixed(1)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {item.carrier || 'Unknown'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {item.service}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium text-foreground">
                            {formatCurrency(item.currentRate)}
                          </TableCell>
                          <TableCell className="text-right font-medium text-primary">
                            {(() => {
                              const markupInfo = getShipmentMarkup(item);
                              return formatCurrency(markupInfo.markedUpPrice);
                            })()}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className={cn(
                              "flex items-center justify-end gap-1 font-medium",
                              getSavingsColor(item.currentRate - (() => {
                                const markupInfo = getShipmentMarkup(item);
                                return markupInfo.markedUpPrice;
                              })())
                            )}>
                              {(() => {
                                const markupInfo = getShipmentMarkup(item);
                                const savings = item.currentRate - markupInfo.markedUpPrice;
                                return savings > 0 ? (
                                  <CheckCircle2 className="h-4 w-4" />
                                ) : savings < 0 ? (
                                  <XCircle className="h-4 w-4" />
                                ) : null;
                              })()}
                              {(() => {
                                const markupInfo = getShipmentMarkup(item);
                                const savings = item.currentRate - markupInfo.markedUpPrice;
                                return formatCurrency(savings);
                              })()}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={cn("font-medium", getSavingsColor((() => {
                              const markupInfo = getShipmentMarkup(item);
                              const savings = item.currentRate - markupInfo.markedUpPrice;
                              return savings;
                            })()))}>
                              {(() => {
                                const markupInfo = getShipmentMarkup(item);
                                const savings = item.currentRate - markupInfo.markedUpPrice;
                                const savingsPercent = item.currentRate > 0 ? (savings / item.currentRate) * 100 : 0;
                                return formatPercentage(savingsPercent);
                              })()}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="orphaned-data" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Orphaned Shipments</CardTitle>
                <CardDescription>
                  Shipments that encountered errors during processing
                </CardDescription>
              </CardHeader>
              <CardContent>
                {orphanedData.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
                    <h3 className="text-xl font-medium mb-2">Perfect Processing!</h3>
                    <p className="text-muted-foreground">
                      All shipments were successfully analyzed with no errors.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow className="border-b border-border">
                           <TableHead className="text-foreground">Tracking ID</TableHead>
                           <TableHead className="text-foreground">Origin Zip</TableHead>
                           <TableHead className="text-foreground">Destination Zip</TableHead>
                           <TableHead className="text-right text-foreground">Weight</TableHead>
                           <TableHead className="text-foreground">Service Type</TableHead>
                           <TableHead className="text-foreground">Missing Fields</TableHead>
                           <TableHead className="text-foreground">Error Type</TableHead>
                           <TableHead className="text-foreground">Error Details</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                         {orphanedData.map((row, index) => (
                           <TableRow key={index} className="border-b border-border hover:bg-muted/50">
                             <TableCell className="font-medium text-foreground">{row.trackingId}</TableCell>
                             <TableCell className="text-foreground">
                               {row.originZip || <span className="text-muted-foreground italic">Missing</span>}
                             </TableCell>
                             <TableCell className="text-foreground">
                               {row.destinationZip || <span className="text-muted-foreground italic">Missing</span>}
                             </TableCell>
                              <TableCell className="text-right text-foreground">
                                {(row.weight && row.weight > 0) ? row.weight.toFixed(1) : <span className="text-muted-foreground italic">Missing</span>}
                              </TableCell>
                             <TableCell className="text-foreground">
                               {row.service || <span className="text-muted-foreground italic">Missing</span>}
                             </TableCell>
                             <TableCell>
                               {row.missingFields && row.missingFields.length > 0 ? (
                                 <div className="flex flex-wrap gap-1">
                                   {row.missingFields.map((field: string, idx: number) => (
                                     <Badge key={idx} variant="outline" className="text-xs text-orange-600 border-orange-300">
                                       {field}
                                     </Badge>
                                   ))}
                                 </div>
                               ) : (
                                 <span className="text-muted-foreground">-</span>
                               )}
                             </TableCell>
                             <TableCell>
                               <Badge variant="destructive">{row.errorType}</Badge>
                             </TableCell>
                             <TableCell>
                               <div className="max-w-xs truncate text-muted-foreground" title={row.error}>
                                 {row.error}
                               </div>
                             </TableCell>
                           </TableRow>
                         ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Results;