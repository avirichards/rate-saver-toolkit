import React, { useState, useEffect } from 'react';
import { useRef } from 'react';
import { useLocation, useParams, useSearchParams, Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ClientLayout } from '@/components/layout/ClientLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import * as AccordionComponents from '@/components/ui/accordion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui-lov/Card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Download, DollarSign, Package, TruckIcon, AlertCircle, Filter, CheckCircle2, XCircle, Calendar, Zap, Target, TrendingUp, TrendingDown, ArrowLeft, Upload, FileText, Home, Calculator } from 'lucide-react';
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
import { getSharedReport, updateViewCount } from '@/utils/shareUtils';
import { MarkupConfiguration, MarkupData } from '@/components/ui-lov/MarkupConfiguration';
import { InlineEditableField } from '@/components/ui-lov/InlineEditableField';
import { ClientCombobox } from '@/components/ui-lov/ClientCombobox';
import { SelectiveReanalysisModal } from '@/components/ui-lov/SelectiveReanalysisModal';
import { EditableShipmentRow } from '@/components/ui-lov/EditableShipmentRow';
import { OrphanedShipmentRow } from '@/components/ui-lov/OrphanedShipmentRow';
import { AccountComparisonView } from '@/components/ui-lov/AccountComparisonView';

import { useSelectiveReanalysis } from '@/hooks/useSelectiveReanalysis';
import { 
  processAnalysisData,
  formatShipmentData, 
  handleDataProcessingError,
  generateExportData,
  validateShipmentData,
  ProcessedAnalysisData,
  ProcessedShipmentData 
} from '@/utils/dataProcessing';
import * as XLSX from 'xlsx';

// Use the standardized interface from dataProcessing utils
type AnalysisData = ProcessedAnalysisData;

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

interface ResultsProps {
  isClientView?: boolean;
  shareToken?: string;
}

const Results: React.FC<ResultsProps> = ({ isClientView = false, shareToken }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [shipmentData, setShipmentData] = useState<ProcessedShipmentData[]>([]);
  const [orphanedData, setOrphanedData] = useState<any[]>([]);
  const [shipmentRates, setShipmentRates] = useState<any[]>([]);
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
  const [clients, setClients] = useState<any[]>([]);
  const [serviceNotes, setServiceNotes] = useState<Record<string, string>>({});
  const [accountNames, setAccountNames] = useState<Record<string, string>>({});
  const hasTriedAutoSave = useRef(false);
  
  // Selective re-analysis state
  const [editMode, setEditMode] = useState(false);
  const [selectedShipments, setSelectedShipments] = useState<Set<number>>(new Set());
  const [isReanalysisModalOpen, setIsReanalysisModalOpen] = useState(false);
  
  
  // Use selective re-analysis hook
  const { 
    isReanalyzing, 
    reanalyzingShipments, 
    reanalyzeShipments, 
    applyServiceCorrections, 
    fixOrphanedShipment 
  } = useSelectiveReanalysis();

  // Function to generate unique file name with numbering - simplified to prevent nested parentheses
  const generateUniqueFileName = async (baseName: string): Promise<string> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return baseName;

    // Get existing analyses for this user to check for name conflicts
    const { data: existingAnalyses } = await supabase
      .from('shipping_analyses')
      .select('file_name, report_name')
      .eq('user_id', user.id)
      .eq('is_deleted', false);

    if (!existingAnalyses) return baseName;

    // Check both file_name and report_name to avoid conflicts
    const existingNames = new Set([
      ...existingAnalyses.map(a => a.file_name),
      ...existingAnalyses.map(a => a.report_name).filter(Boolean)
    ]);
    
    // If base name doesn't exist, use it
    if (!existingNames.has(baseName)) {
      return baseName;
    }

    // Find the highest number suffix - avoid nested parentheses
    let counter = 1;
    let uniqueName: string;
    
    // Remove existing parentheses pattern to avoid nesting
    const cleanBaseName = baseName.replace(/\s*\(\d+\)$/, '');
    
    do {
      uniqueName = `${cleanBaseName} (${counter})`;
      counter++;
    } while (existingNames.has(uniqueName));
    
    return uniqueName;
  };

  // Function to auto-save analysis data to database - prevent duplicate saves
  // Skip auto-save in client view mode
  const autoSaveAnalysis = async (isManualSave = false) => {
    // Don't auto-save in client view mode
    if (isClientView) {
      console.log('⚠️ Auto-save skipped: Client view mode');
      return null;
    }
    // Prevent multiple saves of the same analysis
    if (!analysisData || currentAnalysisId) {
      console.log('⚠️ Auto-save skipped:', { 
        hasAnalysisData: !!analysisData, 
        currentAnalysisId,
        reason: !analysisData ? 'No analysis data' : 'Already saved'
      });
      return currentAnalysisId;
    }
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      if (isManualSave) {
        toast.error('Please log in to save reports');
      }
      return null;
    }

    try {
      console.log('💾 Starting auto-save for analysis:', analysisData.file_name);
      
      const baseName = analysisData.file_name || 'Untitled Analysis';
      const uniqueFileName = await generateUniqueFileName(baseName);

      // Include savings_analysis data for better reporting
      const savingsAnalysisData = {
        totalSavings: analysisData.totalPotentialSavings || 0,
        completedShipments: analysisData.totalShipments || 0,
        savingsPercentage: analysisData.totalPotentialSavings && analysisData.totalShipments ? 
          (analysisData.totalPotentialSavings / (analysisData.totalShipments * 10)) * 100 : 0 // Rough estimate
      };

      // Prepare processing metadata
      const processingMetadata = {
        savedAt: new Date().toISOString(),
        totalSavings: analysisData.totalPotentialSavings || 0,
        completedShipments: analysisData.completedShipments || 0,
        errorShipments: analysisData.errorShipments || 0,
        dataSource: 'new_analysis'
      };

      const analysisRecord = {
        user_id: user.id,
        file_name: uniqueFileName,
        total_shipments: analysisData.totalShipments || 0,
        total_savings: Math.max(0, analysisData.totalPotentialSavings || 0),
        status: 'completed',
        original_data: analysisData.recommendations as any,
        recommendations: analysisData.recommendations as any,
        processed_shipments: shipmentData as any, // Centralized data
        orphaned_shipments: orphanedData as any, // Centralized data
        processing_metadata: processingMetadata as any, // Centralized metadata
        markup_data: markupData as any,
        savings_analysis: savingsAnalysisData as any
      };

      const { data, error } = await supabase
        .from('shipping_analyses')
        .insert(analysisRecord)
        .select()
        .single();

      if (error) throw error;
      
      console.log('✅ Analysis auto-saved successfully:', data.id);
      setCurrentAnalysisId(data.id);
      
      // Load service notes for the newly saved analysis
      loadServiceNotes(data.id);
      loadShipmentRates(data.id);
      
      return data.id;
    } catch (error) {
      console.error('❌ Error saving analysis:', error);
      if (isManualSave) {
        toast.error('Failed to save analysis to database');
      }
      return null;
    }
  };

  // Legacy function for backward compatibility
  const saveAnalysisToDatabase = () => autoSaveAnalysis(true);

  // Load clients for client assignment
  const loadClients = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('clients')
      .select('id, company_name')
      .eq('user_id', user.id)
      .order('company_name');

    setClients(data || []);
  };

  // Load service notes for current analysis
  const loadServiceNotes = async (analysisId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('service_notes')
      .select('service_name, notes')
      .eq('analysis_id', analysisId)
      .eq('user_id', user.id);

    if (data) {
      const notesMap = data.reduce((acc, note) => {
        acc[note.service_name] = note.notes || '';
        return acc;
      }, {} as Record<string, string>);
      setServiceNotes(notesMap);
    }
  };

  // Load account names for carrier configs
  const loadAccountNames = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get all unique account IDs from shipment data and shipment updates
    const accountIds = new Set<string>();
    
    // Add account IDs from original shipment data
    shipmentData.forEach(shipment => {
      if (shipment.accountId) {
        accountIds.add(shipment.accountId);
      }
    });
    
    // Add account IDs from shipment data
    shipmentData.forEach(shipment => {
      if (shipment.accountId) {
        accountIds.add(shipment.accountId);
      }
    });

    if (accountIds.size === 0) return;

    const { data } = await supabase
      .from('carrier_configs')
      .select('id, account_name')
      .eq('user_id', user.id)
      .in('id', Array.from(accountIds));

    if (data) {
      const namesMap = data.reduce((acc, config) => {
        acc[config.id] = config.account_name;
        return acc;
      }, {} as Record<string, string>);
      setAccountNames(namesMap);
    }
  };


  // Save updated shipment data to database after reanalysis
  const saveShipmentData = async (updatedShipmentData?: any[]) => {
    if (!currentAnalysisId) return;
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const dataToSave = updatedShipmentData || shipmentData;

    try {
      console.log('💾 Saving updated shipment data to database:', dataToSave.length, 'shipments');
      
      const { error } = await supabase
        .from('shipping_analyses')
        .update({
          processed_shipments: dataToSave as any,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentAnalysisId)
        .eq('user_id', user.id);

      if (error) {
        console.error('❌ Error saving shipment data:', error);
      } else {
        console.log('✅ Shipment data saved successfully');
      }
    } catch (error) {
      console.error('❌ Error saving shipment data:', error);
    }
  };

  // Load shipment rates for account comparison
  const loadShipmentRates = async (analysisId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('shipment_rates')
      .select('*')
      .eq('analysis_id', analysisId);

    if (data) {
      setShipmentRates(data);
      console.log('📊 Loaded shipment rates for best account calculation:', data.length);
    }
    return data;
  };

  // Save or update service note
  const saveServiceNote = async (serviceName: string, notes: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !currentAnalysisId) return;

    try {
      const { error } = await supabase
        .from('service_notes')
        .upsert({
          analysis_id: currentAnalysisId,
          service_name: serviceName,
          notes: notes,
          user_id: user.id
        }, {
          onConflict: 'analysis_id,service_name'
        });

      if (error) throw error;
      
      // Update local state
      setServiceNotes(prev => ({
        ...prev,
        [serviceName]: notes
      }));
    } catch (error) {
      console.error('Error saving service note:', error);
      toast.error('Failed to save note');
    }
  };

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

  // Selective re-analysis handlers
  const handleSelectShipment = (shipmentId: number, selected: boolean) => {
    setSelectedShipments(prev => {
      const next = new Set(prev);
      if (selected) {
        next.add(shipmentId);
      } else {
        next.delete(shipmentId);
      }
      return next;
    });
  };

  const handleSelectAllShipments = (selected: boolean) => {
    if (selected) {
      setSelectedShipments(new Set(filteredData.map(item => item.id)));
    } else {
      setSelectedShipments(new Set());
    }
  };

  const handleFieldUpdate = (shipmentId: number, field: string, value: string) => {
    // Auto-select the shipment when any field is edited
    setSelectedShipments(prev => new Set([...prev, shipmentId]));
    
    // Update shipment data directly
    setShipmentData(prev => prev.map(shipment => {
      if (shipment.id === shipmentId) {
        // For Ship Pros Service field, always use 'newService' for consistency
        const fieldToUpdate = field === 'shipProsService' ? 'newService' : field;
        
        console.log('🔄 Field update:', { shipmentId, field: fieldToUpdate, value });
        return { ...shipment, [fieldToUpdate]: value };
      }
      return shipment;
    }));
    
    // Save to database immediately
    setTimeout(() => saveShipmentData(), 100);
  };

  const handleBatchResidentialUpdate = (isResidential: boolean) => {
    if (selectedShipments.size === 0) {
      toast.error('Please select shipments to update');
      return;
    }

    // Update all selected shipments
    selectedShipments.forEach(shipmentId => {
      handleFieldUpdate(shipmentId, 'isResidential', isResidential ? 'true' : 'false');
    });

    toast.success(`Marked ${selectedShipments.size} shipments as ${isResidential ? 'residential' : 'commercial'}`);
  };

  const handleReanalyzeSelected = async () => {
    if (selectedShipments.size === 0) {
      toast.error('Please select shipments to re-analyze');
      return;
    }

    if (!currentAnalysisId) {
      toast.error('Analysis ID not found');
      return;
    }

    const selectedData = filteredData.filter(item => selectedShipments.has(item.id));
    const shipmentsToReanalyze = selectedData; // No need to apply updates - already in shipmentData

    try {
      const result = await reanalyzeShipments(shipmentsToReanalyze, currentAnalysisId);
      
      console.log('🔄 Re-analysis result:', result);
      
      // Update local state with re-analyzed data WITHOUT exiting edit mode
      const updatedShipmentData = shipmentData.map(item => {
        const reanalyzed = result.success.find((r: any) => r.id === item.id);
        if (reanalyzed) {
          console.log('📦 Updating shipment:', item.id, 'with new rate:', reanalyzed.newRate, 'service:', reanalyzed.newService);
          // Merge the re-analyzed data with the original item
          return { 
            ...item, 
            ...reanalyzed,
            // Ensure critical fields are updated - use newService for Ship Pros Service
            newRate: reanalyzed.newRate,
            newService: reanalyzed.newService || reanalyzed.bestService,
            estimatedSavings: item.currentRate ? (item.currentRate - reanalyzed.newRate) : 0
          };
        }
        return item;
      });
      
      setShipmentData(updatedShipmentData);

      // Save updated shipment data to database
      await saveShipmentData(updatedShipmentData);

      // Update shipment updates to include the service changes from re-analysis
      // This ensures the service changes persist when navigating away and back
      const reanalyzedUpdates: Record<number, any> = {};
      result.success.forEach((reanalyzed: any) => {
        reanalyzedUpdates[reanalyzed.id] = {
          newService: reanalyzed.newService || reanalyzed.bestService,
          newRate: reanalyzed.newRate,
          accountId: reanalyzed.accountId,
          analyzedWithAccount: reanalyzed.analyzedWithAccount
        };
      });
      
      // Updates are applied directly to shipmentData in the reanalyzeShipments hook

      // Keep edit mode ON and don't clear selections - user stays in edit mode
      toast.success(`Successfully re-analyzed ${result.success.length} shipments`);

    } catch (error) {
      console.error('Re-analysis failed:', error);
      toast.error('Re-analysis failed. Please try again.');
    }
  };

  const handleReanalyzeSingle = async (shipmentId: number) => {
    if (!currentAnalysisId) {
      toast.error('Analysis ID not found');
      return;
    }

    const shipmentToReanalyze = filteredData.find(item => item.id === shipmentId);
    if (!shipmentToReanalyze) {
      toast.error('Shipment not found');
      return;
    }

    const shipmentWithUpdates = shipmentToReanalyze; // No need to apply updates - already in shipmentData

    try {
      const result = await reanalyzeShipments([shipmentWithUpdates], currentAnalysisId);
      
      console.log('🔄 Single re-analysis result:', result);
      
      // Update local state with re-analyzed data
      const updatedShipmentData = shipmentData.map(item => {
        const reanalyzed = result.success.find((r: any) => r.id === item.id);
        if (reanalyzed) {
          console.log('📦 Updating single shipment:', item.id, 'with new rate:', reanalyzed.newRate, 'service:', reanalyzed.newService);
          // Merge the re-analyzed data with the original item
          return { 
            ...item, 
            ...reanalyzed,
            // Ensure critical fields are updated - use newService for Ship Pros Service
            newRate: reanalyzed.newRate,
            newService: reanalyzed.newService || reanalyzed.bestService,
            estimatedSavings: item.currentRate ? (item.currentRate - reanalyzed.newRate) : 0
          };
        }
        return item;
      });
      
      setShipmentData(updatedShipmentData);

      // Save updated shipment data to database
      await saveShipmentData(updatedShipmentData);

      // Update shipment updates to include the service changes from re-analysis
      const reanalyzed = result.success[0];
      // Reanalyzed data is already applied to shipmentData above
      toast.success(`Successfully re-analyzed shipment`);

      toast.success(`Successfully re-analyzed shipment`);

    } catch (error) {
      console.error('Single re-analysis failed:', error);
      toast.error('Re-analysis failed. Please try again.');
    }
  };

  const handleServiceCorrections = async (corrections: any[]) => {
    if (!currentAnalysisId) {
      toast.error('Analysis ID not found');
      return;
    }

    try {
      // Apply corrections to ALL shipments with matching services, not just selected ones
      const allAffectedShipments = shipmentData.filter(shipment => {
        return corrections.some(correction => {
          const currentService = shipment.service || shipment.originalService || '';
          return currentService === correction.from;
        });
      });

      if (allAffectedShipments.length === 0) {
        toast.error('No shipments found with the specified service types');
        return;
      }

      console.log(`Applying corrections to ${allAffectedShipments.length} shipments`);
      const result = await applyServiceCorrections(corrections, allAffectedShipments, currentAnalysisId);
      
      // Update local state with the corrected data instead of reloading the page
      if (result && result.success) {
        // Update shipmentData with the new results
        setShipmentData(prev => prev.map(item => {
          const updated = result.success.find((r: any) => r.id === item.id);
          return updated ? { ...item, ...updated } : item;
        }));

        // Don't clear selections or exit edit mode - keep user in edit mode
        setIsReanalysisModalOpen(false);
        
        toast.success(`Successfully applied corrections and re-analyzed ${result.success.length} shipments`);
      } else {
        toast.error('No shipments were successfully processed');
      }
    } catch (error) {
      console.error('Service corrections failed:', error);
      toast.error('Failed to apply corrections. Please try again.');
    }
  };

  const handleFixOrphaned = async (shipmentId: number, updatedData: any) => {
    if (!currentAnalysisId) {
      toast.error('Analysis ID not found');
      return;
    }

    try {
      await fixOrphanedShipment(updatedData, currentAnalysisId);
      
      // Remove from orphaned and add to processed
      setOrphanedData(prev => prev.filter(item => item.id !== shipmentId));
      setShipmentData(prev => [...prev, updatedData]);
      
    } catch (error) {
      console.error('Fix orphaned shipment failed:', error);
    }
  };

  // Export functionality - uses standardized download function
  const exportToExcel = async () => {
    let analysisId = currentAnalysisId;
    
    // For client view, get analysis ID from share token by looking up the shared report
    if (isClientView && shareToken && !analysisId) {
      try {
        const { getSharedReport } = await import('@/utils/shareUtils');
        const sharedData = await getSharedReport(shareToken);
        analysisId = sharedData.shipping_analyses.id;
      } catch (error) {
        console.error('Error getting analysis ID from share token:', error);
        toast.error('Unable to export: Could not access report data');
        return;
      }
    }
    
    // For regular view, try to save if no analysis ID exists
    if (!isClientView && !analysisId) {
      const savedId = await autoSaveAnalysis(true);
      if (!savedId) {
        toast.error('Unable to export: Please save the analysis first');
        return;
      }
      analysisId = savedId;
    }
    
    if (!analysisId) {
      toast.error('Unable to export: Analysis data not available');
      return;
    }
    
    try {
      const { downloadReportExcel } = await import('@/utils/exportUtils');
      await downloadReportExcel(analysisId);
      toast.success('Report downloaded successfully');
    } catch (error) {
      console.error('Error exporting report:', error);
      toast.error('Failed to export report');
    }
  };

  useEffect(() => {
    const loadAnalysisData = async () => {
      try {
        if (isClientView && shareToken) {
          // Load shared report for client view
          const sharedData = await getSharedReport(shareToken);
          await updateViewCount(shareToken);

          const analysis = sharedData.shipping_analyses;
          
          // Set markup data first
          if (analysis.markup_data) {
            setMarkupData(analysis.markup_data as any as MarkupData);
          }
          
          // Create a markup function that uses the markup data directly from the analysis
          const getMarkupWithData = (shipment: any) => {
            const markupDataFromAnalysis = analysis.markup_data as any;
            if (!markupDataFromAnalysis) return { markedUpPrice: shipment.newRate, margin: 0, marginPercent: 0 };
            
            const shipProsCost = shipment.newRate || 0;
            let markupPercent = 0;
            
            if (markupDataFromAnalysis.markupType === 'global') {
              markupPercent = markupDataFromAnalysis.globalMarkup;
            } else {
              markupPercent = markupDataFromAnalysis.perServiceMarkup[shipment.service] || 0;
            }
            
            const markedUpPrice = shipProsCost * (1 + markupPercent / 100);
            const margin = markedUpPrice - shipProsCost;
            const marginPercent = shipProsCost > 0 ? (margin / shipProsCost) * 100 : 0;
            
            return { markedUpPrice, margin, marginPercent };
          };
          
          const processedData = processAnalysisData(analysis, getMarkupWithData);
          
          setAnalysisData(processedData);
          setShipmentData(processedData.recommendations || []);
          setOrphanedData(processedData.orphanedShipments || []);
          
          setLoading(false);
          return;
        }
        
        const state = location.state as { analysisComplete?: boolean; analysisData?: AnalysisData } | null;
        const analysisIdFromQuery = searchParams.get('analysisId');
        
        if (analysisIdFromQuery) {
          // Loading from Reports tab
          await loadFromDatabase(analysisIdFromQuery);
        } else if (state?.analysisComplete && state.analysisData) {
          setAnalysisData(state.analysisData);
          
          // Auto-save the analysis after a short delay
          setTimeout(() => {
            autoSaveAnalysis(false);
          }, 1000);
          
          // Process the recommendations using the utility function with service mappings
          const processedShipmentData = formatShipmentData(
            state.analysisData.recommendations,
            shipmentRates,
            state.analysisData.bestAccount,
            state.analysisData.serviceMappings // Pass service mappings if available
          );
          setShipmentData(processedShipmentData);
          
          // Handle orphaned shipments from state
          const orphanedFromState = state.analysisData.orphanedShipments || [];
          setOrphanedData(orphanedFromState);
          
          // Also handle additional orphans from analysisData if available
          if (state.analysisData.orphanedShipments && state.analysisData.orphanedShipments.length > 0) {
            const additionalOrphans = state.analysisData.orphanedShipments.map((orphan: any, index: number) => ({
              id: orphanedFromState.length + index + 1,
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
              fromOrphanedShipments: additionalOrphans.length,
              total: orphanedFromState.length + additionalOrphans.length
            });
          }
          
          // Initialize service data
          const services = [...new Set(processedShipmentData.map(item => item.service).filter(Boolean))] as string[];
          setAvailableServices(services);
          setSelectedServicesOverview([]); // Default to unchecked
          
          setLoading(false);
        } else if (params.id) {
          await loadFromDatabase(params.id);
        } else {
          await loadMostRecentAnalysis();
        }
        } catch (error) {
        handleDataProcessingError(error, isClientView ? 'client view' : 'normal view');
        setLoading(false);
      }
    };

    loadAnalysisData();
  }, [location, params.id, searchParams, isClientView, shareToken]);

  // Auto-save effect - triggers when analysis data is loaded and user is authenticated
  // IMPORTANT: Only auto-save ONCE per analysis to prevent duplicates
  // SKIP auto-save in client view mode
  useEffect(() => {
    // Don't auto-save in client view mode
    if (isClientView) return;
    
    const performAutoSave = async () => {
      // Only auto-save if we have analysis data but no current analysis ID (not already saved)
      if (analysisData && !currentAnalysisId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          console.log('🔄 Auto-saving analysis data...');
          
          // Check if this analysis already exists based on recommendations data
          if (analysisData.recommendations && analysisData.recommendations.length > 0) {
            // Try to find existing analysis with matching data
            const sampleRecommendation = analysisData.recommendations[0];
            const { data: existingAnalyses, error } = await supabase
              .from('shipping_analyses')
              .select('id')
              .eq('user_id', user.id)
              .eq('status', 'completed')
              .gte('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString()) // Within last 10 minutes
              .order('created_at', { ascending: false })
              .limit(3);
              
            if (!error && existingAnalyses && existingAnalyses.length > 0) {
              // Check if any recent analysis has shipment rates (indicating it was created during processing)
              for (const analysis of existingAnalyses) {
                const { data: ratesCheck } = await supabase
                  .from('shipment_rates')
                  .select('id')
                  .eq('analysis_id', analysis.id)
                  .limit(1);
                  
                if (ratesCheck && ratesCheck.length > 0) {
                  console.log('📋 Found existing analysis with rates, using ID:', analysis.id);
                  setCurrentAnalysisId(analysis.id);
                  loadServiceNotes(analysis.id);
                  return analysis.id;
                }
              }
            }
          }
          
          const savedId = await autoSaveAnalysis(false);
          if (savedId) {
            console.log('✅ Analysis auto-saved with ID:', savedId);
          }
        }
      }
    };

    // Add a small delay to ensure all data is loaded, but only run once
    if (analysisData && !currentAnalysisId && !hasTriedAutoSave.current) {
      hasTriedAutoSave.current = true;
      const timer = setTimeout(performAutoSave, 2000);
      return () => clearTimeout(timer);
    }
  }, [analysisData, currentAnalysisId, isClientView]);

  // Load clients on component mount
  useEffect(() => {
    loadClients();
  }, []);

  // Load service notes when analysis ID changes
  useEffect(() => {
    if (currentAnalysisId) {
      loadServiceNotes(currentAnalysisId);
      loadShipmentRates(currentAnalysisId);
    }
  }, [currentAnalysisId]);

  // Load account names when shipment data changes
  useEffect(() => {
    if (shipmentData.length > 0) {
      loadAccountNames();
    }
  }, [shipmentData]);


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
    
    // Service is optional for orphan classification - missing service doesn't make a shipment invalid
    // but we'll note it as a warning
    const hasService = shipment.service && shipment.service.trim() !== '';
    
    // Only consider shipment invalid if it's missing critical shipping data (tracking, addresses, weight)
    // Service issues should preserve the shipment as orphaned data, not exclude it entirely
    const isValid = missingFields.length === 0 && hasService;
    const errorType = missingFields.length > 0 ? 'Missing Critical Data' : 
                     !hasService ? 'Missing Service' : 'Valid';
    
    // Add service to missing fields for tracking, but don't invalidate shipment
    if (!hasService) {
      missingFields.push('Service');
    }
    
    return { isValid, missingFields, errorType };
  };

  const processAnalysisFromDatabase = async (data: any) => {
    console.log('🔍 Processing analysis from database with unified approach:', data.id);

    try {
      // Set current analysis ID and load markup data
      setCurrentAnalysisId(data.id);
      if (data.markup_data) {
        setMarkupData(data.markup_data as MarkupData);
      }

      // account_assignments removed - using processed_shipments as single source of truth

      // Load shipment rates first to determine best account
      const loadedRates = await loadShipmentRates(data.id);
      
      // Use the unified processing function with markup calculations and shipment rates
      const processedData = processAnalysisData(data, getShipmentMarkup, loadedRates || shipmentRates);
      
      setAnalysisData(processedData);
      
      // Check if processed_shipments exists (contains user's choices), otherwise use formatShipmentData for initial processing
      let formattedShipmentData;
      if (data.processed_shipments && Array.isArray(data.processed_shipments) && data.processed_shipments.length > 0) {
        console.log('🔍 Loading shipment data from processed_shipments (user choices preserved)');
        formattedShipmentData = data.processed_shipments;
      } else {
        console.log('🔍 Formatting shipment data from recommendations (initial analysis)');
        formattedShipmentData = formatShipmentData(
          processedData.recommendations || [], 
          loadedRates || shipmentRates, 
          processedData.bestAccount,
          data.service_mappings // Pass service mappings from database
        );
        // Save the initial analysis to processed_shipments
        await supabase
          .from('shipping_analyses')
          .update({ 
            processed_shipments: formattedShipmentData as any,
            updated_at: new Date().toISOString()
          })
          .eq('id', data.id);
      }

      setShipmentData(formattedShipmentData);
      setOrphanedData(processedData.orphanedShipments || []);
      
      // Initialize services from the processed data
      const services = [...new Set((processedData.recommendations || []).map((item: any) => item.service).filter(Boolean))] as string[];
      setAvailableServices(services);
      setSelectedServicesOverview([]);
      
      console.log('✅ Unified data processing complete:', {
        processed: processedData.recommendations?.length || 0,
        orphaned: processedData.orphanedShipments?.length || 0,
        total: processedData.totalShipments,
        services: services.length,
        bestAccount: processedData.bestAccount
      });
      
      setLoading(false);

    } catch (error: any) {
      console.error('❌ Error processing analysis from database:', error);
      setError(`Failed to load analysis data: ${error.message}`);
      setLoading(false);
    }
  };

  const processLegacyDataAndMigrate = async (data: any, analysisMetadata: any) => {
    let dataToUse = null;

    // CRITICAL: Check if original_data or recommendations are missing/empty and recover from rate_quotes
    const hasValidOriginalData = Array.isArray(data.original_data) && data.original_data.length > 0;
    const hasValidRecommendations = Array.isArray(data.recommendations) && data.recommendations.length > 0;
    
    console.log('📊 LEGACY DATA: Availability check:', {
      hasValidOriginalData,
      hasValidRecommendations,
      needsRecovery: !hasValidOriginalData || !hasValidRecommendations
    });

    if (!hasValidOriginalData || !hasValidRecommendations) {
      console.warn('⚠️ LEGACY DATA: Missing analysis data, attempting recovery from rate_quotes...');
      
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
          rateQuotesCount: rateQuotes.length
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

    console.log('📊 LEGACY DATA: Final data selection:', {
      dataSource: dataToUse === data.recommendations ? 'recommendations' : 
                 dataToUse === data.original_data ? 'original_data' : 'rate_quotes',
      dataCount: Array.isArray(dataToUse) ? dataToUse.length : 0,
      willMigrateToNewFormat: true
    });

    // Process legacy data and migrate to centralized format
    await processShipmentData(dataToUse, analysisMetadata, data.original_data, data.id);
  };

  const processShipmentData = async (dataToUse: any[], analysisMetadata: any, originalData?: any[], analysisId?: string) => {
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
        console.log('🔄 Converting rate_quote to shipment format for:', {
          hasShipmentData: !!rec.shipment_data,
          shipmentDataType: typeof rec.shipment_data,
          trackingId: rec.shipment_data?.shipFrom?.Address?.PostalCode || 'unknown'
        });
        
        // Convert rate_quote structure to shipment format
        shipmentData = {
          trackingId: rec.shipment_data?.trackingId || `Rate-${index + 1}`,
          originZip: rec.shipment_data?.shipFrom?.Address?.PostalCode || '',
          destZip: rec.shipment_data?.shipTo?.Address?.PostalCode || '',
          weight: rec.shipment_data?.Package?.PackageWeight?.Weight || 0,
          service: rec.shipment_data?.Service?.Description || 'Unknown',
          carrier: 'UPS'
        };
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
          carrier: shipmentData?.carrier || rec.carrier || 'UPS',
          service: rec.originalService || shipmentData?.service || 'Unknown',
          // Try multiple field names for rates based on different data sources
          currentRate: rec.currentCost || rec.current_rate || rec.published_rate || 0,
          newRate: rec.recommendedCost || rec.recommended_cost || rec.negotiated_rate || rec.newRate || 0,
          savings: rec.savings || rec.savings_amount || 0,
          savingsPercent: (() => {
            const current = rec.currentCost || rec.current_rate || rec.published_rate || 0;
            const savings = rec.savings || rec.savings_amount || 0;
            return current > 0 ? (savings / current) * 100 : 0;
          })()
        });
      }
    });
    
    // Calculate missing shipments and CREATE orphaned entries for them
    dataIntegrityLog.missingShipments = Math.max(0, dataIntegrityLog.expectedShipments - dataIntegrityLog.processedShipments);
    
    // Create orphaned entries for missing shipments
    if (dataIntegrityLog.missingShipments > 0) {
      console.log('🔍 CREATING ORPHANED ENTRIES for missing shipments:', dataIntegrityLog.missingShipments);
      console.log('🔍 Available originalData:', !!originalData, originalData?.length);
      
      for (let i = 0; i < dataIntegrityLog.missingShipments; i++) {
        const missingIndex = dataIntegrityLog.processedShipments + i;
        const originalShipment = originalData?.[missingIndex];
        
        console.log(`🔍 Creating orphaned entry for missing shipment ${missingIndex + 1}:`, {
          hasOriginalData: !!originalShipment,
          originalShipment
        });
        
        // Use original shipment data if available, otherwise create empty record
        const shipmentData = originalShipment?.shipment || originalShipment || {};
        
        orphanedShipments.push({
          id: missingIndex + 1,
          trackingId: shipmentData.trackingId || `Missing-${missingIndex + 1}`,
          originZip: shipmentData.originZip || '',
          destinationZip: shipmentData.destZip || shipmentData.destinationZip || '',
          weight: parseFloat(shipmentData.weight || '0'),
          service: originalShipment?.originalService || shipmentData.service || '',
          error: 'Missing from analysis data - shipment was not processed during analysis',
          errorType: 'Missing Data',
          missingFields: originalShipment ? ['Analysis incomplete'] : ['All data missing']
        });
        dataIntegrityLog.orphanedShipments++;
      }
    }
    
    console.log('📊 FINAL DATA INTEGRITY REPORT:', dataIntegrityLog);
    
    // Critical data integrity validation (skip warnings in client view)
    if (dataIntegrityLog.missingShipments > 0 && !isClientView) {
      console.error('🚨 DATA INTEGRITY ERROR: Missing shipments detected!', {
        expected: dataIntegrityLog.expectedShipments,
        processed: dataIntegrityLog.processedShipments,
        missing: dataIntegrityLog.missingShipments,
        orphanedEntriesCreated: dataIntegrityLog.missingShipments
      });
    }
    
    // Update UI state
    console.log('🔍 SETTING ORPHANED DATA:', {
      orphanedCount: orphanedShipments.length,
      validCount: validShipments.length,
      orphanedItems: orphanedShipments.map(o => ({ trackingId: o.trackingId, error: o.error }))
    });
    setShipmentData(validShipments);
    setOrphanedData(orphanedShipments);
    
    // Initialize service data for filtering
    const services = [...new Set(validShipments.map(item => item.service).filter(Boolean))] as string[];
    setAvailableServices(services);
    setSelectedServicesOverview([]);
    
    // Update filtered data for display
    setFilteredData(validShipments);
    
    // Update analysis summary - use all savings (including negative ones for losses)
    const totalSavings = validShipments.reduce((sum, s) => sum + (s.savings || 0), 0);
    const totalCurrentCost = validShipments.reduce((sum, s) => sum + (s.currentRate || 0), 0);
    
    console.log('🔍 SAVINGS DEBUG: Calculated values:', {
      totalSavings,
      totalCurrentCost,
      databaseSavings: analysisMetadata.totalSavings,
      shipmentCount: validShipments.length,
      sampleSavings: validShipments.slice(0, 3).map(s => ({ savings: s.savings, currentRate: s.currentRate }))
    });
    
    // FORCE database update every time to ensure Reports page shows correct values
    if (currentAnalysisId) {
      console.log('📊 FORCE UPDATING DATABASE: total_savings from', analysisMetadata.totalSavings, 'to', totalSavings);
      const { error } = await supabase
        .from('shipping_analyses')
        .update({ 
          total_savings: totalSavings,
          savings_analysis: {
            totalShipments: analysisMetadata.totalShipments, // Use original CSV total
            completedShipments: dataIntegrityLog.validShipments,
            errorShipments: dataIntegrityLog.orphanedShipments,
            totalCurrentCost: totalCurrentCost,
            totalSavings: totalSavings,
            savingsPercentage: totalCurrentCost > 0 ? (totalSavings / totalCurrentCost) * 100 : 0
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', currentAnalysisId);
      
      if (error) {
        console.error('Failed to update analysis savings:', error);
      }
    }
    
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
      file_name: analysisMetadata.fileName,
      report_name: analysisMetadata.reportName,
      client_id: analysisMetadata.clientId
    });
    
    // Always migrate to centralized data format when processing legacy data
    if (analysisId) {
      console.log('🔄 MIGRATING TO CENTRALIZED FORMAT:', analysisId);
      
      const processingMetadata = {
        migratedAt: new Date().toISOString(),
        originalDataCount: dataToUse.length,
        processedCount: validShipments.length,
        orphanedCount: orphanedShipments.length,
        totalSavings: totalSavings,
        migrationSource: 'legacy_processing',
        dataIntegrityReport: dataIntegrityLog
      };
      
      try {
        const { error: updateError } = await supabase
          .from('shipping_analyses')
          .update({
            processed_shipments: validShipments,
            orphaned_shipments: orphanedShipments,
            processing_metadata: processingMetadata,
            total_savings: totalSavings,
            updated_at: new Date().toISOString()
          })
          .eq('id', analysisId);

        if (updateError) {
          console.error('❌ Failed to migrate to centralized format:', updateError);
          throw updateError;
        } else {
          console.log('✅ Successfully migrated to centralized format:', {
            processedShipments: validShipments.length,
            orphanedShipments: orphanedShipments.length,
            totalSavings: totalSavings
          });
        }
      } catch (error) {
        console.error('❌ Migration error:', error);
        // Don't fail the entire process if migration fails
        console.warn('⚠️ Continuing with local data despite migration failure');
      }
    }
    
    setLoading(false);
    
    console.log('✅ DATA INTEGRITY: Processing complete:', {
      validShipments: validShipments.length,
      orphanedShipments: orphanedShipments.length,
      totalShipments: dataIntegrityLog.processedShipments,
      dataIntegrityPassed: dataIntegrityLog.missingShipments === 0,
      migratedToCentralized: !!analysisId
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
              <div className="h-32 bg-muted rounded"></div>
            </div>
          </div>
        </div>
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
            <p className="text-muted-foreground mb-4">
              We couldn't find any analysis results to display. Please run an analysis first.
            </p>
            <Button onClick={() => navigate('/upload')}>
              <Upload className="h-4 w-4 mr-2" />
              Start New Analysis
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const Layout = isClientView ? ClientLayout : DashboardLayout;
  const layoutProps = isClientView ? {} : {};

  return (
    <Layout {...layoutProps}>
      <div className="max-w-7xl mx-auto p-6 animate-fade-in">

        {/* Header Section */}
        <div className="mb-12">
          {/* Navigation buttons - Hidden in client view */}
          {!isClientView && (
            <div className="flex items-center gap-4 mb-8">
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
            </div>
          )}

          <div className="space-y-8">
            {/* Header Section with improved layout */}
            <div className="flex items-start justify-between gap-6">
              {/* Left side - Title and info */}
              <div className="flex-1 space-y-4">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                  {isClientView ? (
                    analysisData?.report_name || analysisData?.file_name || 'Untitled Report'
                  ) : (
                    <InlineEditableField
                      value={analysisData?.report_name || analysisData?.file_name || 'Untitled Report'}
                      onSave={async (value) => {
                        if (currentAnalysisId) {
                          const { error } = await supabase
                            .from('shipping_analyses')
                            .update({ 
                              report_name: value,
                              updated_at: new Date().toISOString()
                            })
                            .eq('id', currentAnalysisId);
                          
                          if (error) throw error;
                          
                          // Update local state
                          setAnalysisData(prev => prev ? { ...prev, report_name: value } : null);
                          toast.success('Report name updated');
                        }
                      }}
                      placeholder="Click to edit report name"
                      required
                      minWidth="300px"
                    />
                  )}
                </h1>
                
                {!isClientView && (
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground font-medium">Client:</span>
                    <div className="min-w-[200px]">
                      <ClientCombobox
                        value={analysisData?.client_id || ''}
                        onValueChange={async (clientId) => {
                          if (currentAnalysisId) {
                            const { error } = await supabase
                              .from('shipping_analyses')
                              .update({ 
                                client_id: clientId || null,
                                updated_at: new Date().toISOString()
                              })
                              .eq('id', currentAnalysisId);
                            
                            if (error) throw error;
                            
                            // Update local state
                            setAnalysisData(prev => prev ? { ...prev, client_id: clientId } : null);
                            toast.success('Client updated');
                          }
                        }}
                        placeholder="Select client"
                        disabled={!currentAnalysisId}
                      />
                    </div>
                  </div>
                )}
                
                <div className="text-muted-foreground text-lg">
                  {shipmentData.length} shipments analyzed
                </div>
              </div>
              
              {/* Right side - Action buttons */}
              <div className="flex flex-col gap-3 min-w-[200px]">
                <Button variant="outline" onClick={exportToExcel} className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Export Report
                </Button>
                {!isClientView && (
                  <Button onClick={() => navigate('/upload')} className="w-full">
                    <Upload className="h-4 w-4 mr-2" />
                    New Analysis
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Markup Configuration - Hidden in client view */}
        {!isClientView && (
          <div className="mb-8">
            <AccordionComponents.Accordion type="single" collapsible className="w-full">
              <AccordionComponents.AccordionItem value="markup" className="border rounded-lg">
                <AccordionComponents.AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Calculator className="h-4 w-4" />
                    <span className="font-medium">Markup Configuration</span>
                  </div>
                </AccordionComponents.AccordionTrigger>
                <AccordionComponents.AccordionContent className="px-4 pb-4">
                  <MarkupConfiguration
                    shipmentData={shipmentData}
                    analysisId={currentAnalysisId}
                    onMarkupChange={setMarkupData}
                    initialMarkupData={markupData}
                  />
                </AccordionComponents.AccordionContent>
              </AccordionComponents.AccordionItem>
            </AccordionComponents.Accordion>
          </div>
        )}

        {/* Main Content Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="account-comparison" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Account Comparison
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
                  {isClientView ? (
                    <span>{snapshotDays} Day Snapshot</span>
                  ) : (
                    <>
                      <Input
                        type="number"
                        value={snapshotDays}
                        onChange={(e) => {
                          const value = e.target.value;
                          
                          if (value === '') {
                            // Allow empty during editing, but don't update snapshotDays yet
                            return;
                          }
                          
                          const parsedValue = parseInt(value);
                          const newValue = isNaN(parsedValue) || parsedValue < 1 ? 30 : parsedValue;
                          
                          setSnapshotDays(newValue);
                          
                          // Auto-save snapshot days if we have an analysis ID
                          if (currentAnalysisId) {
                            const timeoutId = setTimeout(async () => {
                              try {
                                await supabase
                                  .from('shipping_analyses')
                                  .update({ 
                                    recommendations: { snapshotDays: newValue },
                                    updated_at: new Date().toISOString()
                                  })
                                  .eq('id', currentAnalysisId);
                              } catch (error) {
                                console.error('Failed to auto-save snapshot days:', error);
                              }
                            }, 1500);
                            
                            return () => clearTimeout(timeoutId);
                          }
                        }}
                        onBlur={(e) => {
                          // Reset to 30 if field is empty when user leaves the field
                          const value = e.target.value;
                          if (value === '' || value === '0') {
                            setSnapshotDays(30);
                          }
                        }}
                        placeholder="30"
                        className="w-20 text-2xl font-bold border-none p-0 h-auto bg-transparent"
                        min="1"
                        max="365"
                      />
                      <span>Day Snapshot</span>
                    </>
                  )}
                </CardTitle>
                <CardDescription>
                  {filteredData.length} shipments selected out of {shipmentData.length} total shipments
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Summary Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Current Cost */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Current Cost</p>
                      <p className="text-2xl font-bold">{formatCurrency(getFilteredStats().totalCurrentCost)}</p>
                    </div>
                    <DollarSign className="h-8 w-8 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>

              {/* Ship Pros Cost */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Ship Pros Cost</p>
                      <p className="text-2xl font-bold">{formatCurrency(getFilteredStats().totalShipProsCost)}</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>

              {/* Total Savings */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Savings</p>
                      <p className={`text-2xl font-bold ${getFilteredStats().totalSavings >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(Math.abs(getFilteredStats().totalSavings))}
                      </p>
                      <p className={`text-sm ${getFilteredStats().totalSavings >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {getFilteredStats().totalSavings >= 0 ? '+' : '-'}{Math.abs(getFilteredStats().averageSavingsPercent).toFixed(1)}%
                      </p>
                    </div>
                    <TrendingDown className={`h-8 w-8 ${getFilteredStats().totalSavings >= 0 ? 'text-green-600' : 'text-red-600'}`} />
                  </div>
                </CardContent>
              </Card>

              {/* Estimated Annual Savings */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Est. Annual Savings</p>
                      <p className={`text-2xl font-bold ${getFilteredStats().totalSavings >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(Math.abs(getFilteredStats().totalSavings * (365 / snapshotDays)))}
                      </p>
                      <p className="text-xs text-muted-foreground">Based on {snapshotDays}-day snapshot</p>
                    </div>
                    <Calendar className={`h-8 w-8 ${getFilteredStats().totalSavings >= 0 ? 'text-green-600' : 'text-red-600'}`} />
                  </div>
                </CardContent>
              </Card>
            </div>

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
                        <TableHead className="text-foreground">Account</TableHead>
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
                                   {(() => {
                                       // Get all accounts used for this service
                                       const serviceShipments = shipmentData
                                         .filter(item => item.service === service);
                                      
                                      const accountCounts = serviceShipments.reduce((acc, item) => {
                                         // Use the same account resolution logic as the Shipment Data tab
                                         const account = item.account || 
                                                        item.analyzedWithAccount || 
                                                        (item.accountId ? accountNames[item.accountId] : null) ||
                                                        item.accountName || 
                                                        analysisData?.bestAccount || 
                                                        'Best Overall';
                                        acc[account] = (acc[account] || 0) + 1;
                                        return acc;
                                      }, {} as Record<string, number>);
                                     
                                     const accounts = Object.entries(accountCounts);
                                     
                                     // If only one account, show single badge
                                     if (accounts.length === 1) {
                                       return (
                                         <Badge variant="secondary" className="text-xs">
                                           {accounts[0][0]}
                                         </Badge>
                                       );
                                     }
                                     
                                     // If multiple accounts, show all with counts
                                     return (
                                       <div className="flex flex-wrap gap-1">
                                         {accounts
                                           .sort(([,a], [,b]) => (b as number) - (a as number))
                                           .map(([account, count]) => (
                                              <Badge key={account} variant="secondary" className="text-xs">
                                                {account} ({count as number})
                                              </Badge>
                                           ))
                                         }
                                       </div>
                                     );
                                   })()}
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
                          data={generateServiceChartData()}
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
                          {generateServiceChartData().map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF7C7C'][index % 8]} />
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
                      <BarChart data={generateServiceCostData()} margin={{ top: 5, right: 5, left: 5, bottom: 60 }}>
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
                             const item = generateServiceCostData().find(d => d.currentService === label);
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
                           {generateServiceCostData().map((entry, index) => (
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

          <TabsContent value="account-comparison" className="space-y-6">
            <AccountComparisonView 
              shipmentRates={shipmentRates}
              shipmentData={shipmentData}
              onOptimizationChange={(selections) => {
                console.log('Applying optimization selections:', selections);
                
                // Apply the optimization by updating shipment data with selected accounts
                const optimizedShipmentData = shipmentData.map(shipment => {
                  const selectedAccount = selections[shipment.service];
                  if (selectedAccount) {
                    // Find the rate for this shipment with the selected account
                    const optimizedRate = shipmentRates.find(rate => 
                      rate.account_name === selectedAccount &&
                      rate.service_name === shipment.service &&
                      rate.shipment_data?.trackingId === shipment.trackingId
                    );
                    
                    if (optimizedRate) {
                      const newSavings = shipment.currentRate - optimizedRate.rate_amount;
                      const optimizedShipment = {
                        ...shipment,
                        newRate: optimizedRate.rate_amount,
                        savings: newSavings,
                        account: selectedAccount,
                        // Also update accountName for consistency
                        accountName: selectedAccount
                      };
                      
                      console.log('🔄 Optimizing shipment:', {
                        trackingId: shipment.trackingId,
                        service: shipment.service,
                        originalAccount: shipment.account || shipment.accountName,
                        newAccount: selectedAccount,
                        optimizedShipment
                      });
                      
                      return optimizedShipment;
                    }
                  }
                  return shipment;
                });
                
                // Update the shipment data state
                setShipmentData(optimizedShipmentData);
                
                // Save optimization to processed_shipments immediately
                saveShipmentData(optimizedShipmentData);
                
                // Recalculate totals
                const totalSavings = optimizedShipmentData.reduce((sum, shipment) => sum + (shipment.savings || 0), 0);
                const totalShipments = optimizedShipmentData.length;
                
                // Update analysis data if it exists
                if (analysisData) {
                  setAnalysisData({
                    ...analysisData,
                    totalPotentialSavings: totalSavings,
                    totalShipments: totalShipments
                  });
                }
                
                toast.success(`Optimization applied! New total savings: ${formatCurrency(totalSavings)}`);
              }}
            />
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

                {/* Filters and Edit Controls */}
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-4">
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

                      {/* Edit Mode Controls */}
                      {!isClientView && (
                        <div className="flex items-center justify-between p-4 bg-muted/20 rounded-lg border border-dashed">
                          <div className="flex items-center gap-4">
                            <Button
                              variant={editMode ? "secondary" : "outline"}
                              onClick={() => setEditMode(!editMode)}
                              className="h-9"
                            >
                              {editMode ? 'Exit Edit Mode' : 'Edit Mode'}
                            </Button>
                            
                            {editMode && (
                              <>
                                <div className="text-sm text-muted-foreground">
                                  Select shipments to edit and re-analyze
                                </div>
                                <Button
                                  size="sm"
                                  onClick={() => setIsReanalysisModalOpen(true)}
                                  className="h-8"
                                >
                                  Batch Corrections
                                </Button>
                              </>
                            )}
                          </div>

                           {editMode && selectedShipments.size > 0 && (
                             <div className="flex items-center gap-2">
                               <Badge variant="secondary">
                                 {selectedShipments.size} selected
                               </Badge>
                               <div className="flex items-center gap-1">
                                 <Button
                                   size="sm"
                                   variant="outline"
                                   onClick={() => handleBatchResidentialUpdate(true)}
                                   className="h-8 text-xs"
                                 >
                                   Mark Residential
                                 </Button>
                                 <Button
                                   size="sm"
                                   variant="outline"
                                   onClick={() => handleBatchResidentialUpdate(false)}
                                   className="h-8 text-xs"
                                 >
                                   Mark Commercial
                                 </Button>
                                 <Button
                                   size="sm"
                                   onClick={handleReanalyzeSelected}
                                   disabled={isReanalyzing}
                                   className="h-8"
                                 >
                                   {isReanalyzing ? 'Re-analyzing...' : 'Re-analyze Selected'}
                                 </Button>
                               </div>
                             </div>
                           )}
                        </div>
                      )}
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow className="border-b border-border">
                          {editMode && (
                            <TableHead className="w-12">
                              <Checkbox
                                checked={selectedShipments.size === filteredData.length && filteredData.length > 0}
                                onCheckedChange={handleSelectAllShipments}
                              />
                            </TableHead>
                          )}
                          <TableHead className="text-foreground w-24">Tracking ID</TableHead>
                          <TableHead className="text-foreground w-16">Origin</TableHead>
                          <TableHead className="text-foreground w-16">Destination</TableHead>
                           <TableHead className="text-foreground w-14">Weight (lbs)</TableHead>
                           <TableHead className="text-foreground w-24">Dimensions (L×W×H)</TableHead>
                           <TableHead className="text-foreground w-16">Residential</TableHead>
                          <TableHead className="text-foreground w-20">Current Service</TableHead>
                           <TableHead className="text-foreground w-24">Ship Pros Service</TableHead>
                           {editMode && <TableHead className="text-foreground w-32">Account Selection</TableHead>}
                           <TableHead className="text-right text-foreground w-20">Current Rate</TableHead>
                           <TableHead className="text-right text-foreground w-20">Ship Pros Cost</TableHead>
                           <TableHead className="text-right text-foreground w-20">Savings</TableHead>
                           {editMode && <TableHead className="text-foreground w-16">Actions</TableHead>}
                           {!editMode && <TableHead className="text-foreground w-20">Account</TableHead>}
                        </TableRow>
                      </TableHeader>
                     <TableBody className="bg-background">
                       {filteredData.map((item, index) => 
                         editMode ? (
                            <EditableShipmentRow
                              key={item.id}
                              shipment={item}
                              isSelected={selectedShipments.has(item.id)}
                              onSelect={(selected) => handleSelectShipment(item.id, selected)}
                              onFieldUpdate={handleFieldUpdate}
                                onReanalyze={() => handleReanalyzeSingle(item.id)}
                              isReanalyzing={reanalyzingShipments.has(item.id)}
                              editMode={editMode}
                              getShipmentMarkup={getShipmentMarkup}
                            />
                         ) : (
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
                              {parseFloat(item.weight || 0).toFixed(1)}
                            </TableCell>
                            <TableCell className="text-foreground text-xs">
                              {item.length && item.width && item.height 
                                ? `${item.length}×${item.width}×${item.height}` 
                                : item.dimensions || '12×12×6'}
                            </TableCell>
                             <TableCell>
                                {(() => {
                                  // Check residential status from shipment data
                                  const isResidential = item.isResidential === 'true' || item.isResidential === true;
                                 
                                 return (
                                   <Badge variant={isResidential ? "default" : "outline"} className="text-xs">
                                     {isResidential ? 'Residential' : 'Commercial'}
                                   </Badge>
                                 );
                               })()}
                             </TableCell>
                           <TableCell>
                             <Badge variant="outline" className="text-xs">
                               {item.originalService || item.service}
                             </Badge>
                           </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs text-primary">
                                {item.bestService || item.newService || 'UPS Ground'}
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
                                "flex flex-col items-end gap-1 font-medium",
                                getSavingsColor(item.currentRate - (() => {
                                  const markupInfo = getShipmentMarkup(item);
                                  return markupInfo.markedUpPrice;
                                })())
                              )}>
                                <div className="flex items-center gap-1">
                                  {(() => {
                                    const markupInfo = getShipmentMarkup(item);
                                    const savings = item.currentRate - markupInfo.markedUpPrice;
                                    return savings > 0 ? (
                                      <CheckCircle2 className="h-3 w-3" />
                                    ) : savings < 0 ? (
                                      <XCircle className="h-3 w-3" />
                                    ) : null;
                                  })()}
                                  {(() => {
                                    const markupInfo = getShipmentMarkup(item);
                                    const savings = item.currentRate - markupInfo.markedUpPrice;
                                    return formatCurrency(savings);
                                  })()}
                                </div>
                                <span className="text-xs">
                                  {(() => {
                                    const markupInfo = getShipmentMarkup(item);
                                    const savings = item.currentRate - markupInfo.markedUpPrice;
                                    const savingsPercent = item.currentRate > 0 ? (savings / item.currentRate) * 100 : 0;
                                    return formatPercentage(savingsPercent);
                                  })()}
                                </span>
                              </div>
                            </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="text-xs">
                                  {item.analyzedWithAccount?.name || item.accountName || analysisData?.bestAccount || 'Unknown Account'}
                                </Badge>
                              </TableCell>
                           </TableRow>
                         )
                       )}
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
                                 {(row.weight && parseFloat(row.weight) > 0) ? parseFloat(row.weight).toFixed(1) : <span className="text-muted-foreground italic">Missing</span>}
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

      {/* Selective Re-analysis Modal */}
      <SelectiveReanalysisModal
        isOpen={isReanalysisModalOpen}
        onClose={() => setIsReanalysisModalOpen(false)}
        onApplyCorrections={handleServiceCorrections}
        selectedShipments={filteredData.filter(item => selectedShipments.has(item.id))}
        allShipments={shipmentData}
      />
    </Layout>
  );
};

export default Results;
