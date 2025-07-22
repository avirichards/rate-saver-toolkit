
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui-lov/Button';
import { ServiceMappingReview } from '@/components/ui-lov/ServiceMappingReview';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import { detectServiceTypes } from '@/utils/csvParser';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { calculateSavings } from '@/utils/analysisUtils';
import type { ServiceMapping } from '@/utils/csvParser';

interface LocationState {
  csvUploadId?: string;
  fileName?: string;
  mappings?: Record<string, string>;
  csvData?: any[];
  rowCount?: number;
  serviceColumn?: string;
  readyForServiceMapping?: boolean;
  originZipOverride?: string;
  uploadTimestamp?: number;
}

const ServiceMapping = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  const [csvData, setCsvData] = useState<any[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [csvUploadId, setCsvUploadId] = useState<string>('');
  const [rowCount, setRowCount] = useState<number>(0);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [serviceColumn, setServiceColumn] = useState<string>('');
  const [serviceMappings, setServiceMappings] = useState<ServiceMapping[]>([]);
  const [originZipOverride, setOriginZipOverride] = useState<string>('');
  const [uploadTimestamp, setUploadTimestamp] = useState<number>(0);
  
  // Check if we have the required data from column mapping
  useEffect(() => {
    const state = location.state as LocationState | null;
    
    if (!state || !state.readyForServiceMapping || !state.csvData || !state.mappings) {
      toast.error('Please complete column mapping first');
      navigate('/mapping');
      return;
    }

    console.log('ServiceMapping page - Received state:', state);
    
    setCsvData(state.csvData);
    setFileName(state.fileName || '');
    setCsvUploadId(state.csvUploadId || '');
    setRowCount(state.rowCount || 0);
    setUploadTimestamp(state.uploadTimestamp || 0);
    setMappings(state.mappings);
    setOriginZipOverride(state.originZipOverride || '');
    
    // Find the service column from mappings
    const serviceCol = Object.entries(state.mappings).find(([field]) => field === 'service')?.[1];
    
    if (!serviceCol) {
      toast.error('No service column mapped. Please go back and map a service column.');
      navigate('/mapping');
      return;
    }
    
    setServiceColumn(serviceCol);
    
    // Detect service types from the CSV data
    const detectedServices = detectServiceTypes(state.csvData, serviceCol);
    console.log('Detected service mappings:', detectedServices);
    setServiceMappings(detectedServices);
    
  }, [location, navigate]);
  
  const handleServiceMappingsConfirmed = async (confirmedMappings: ServiceMapping[]) => {
    console.log('🏠 ServiceMapping page - Service mappings confirmed:', confirmedMappings);
    console.log('🏠 ServiceMapping page - Residential data in confirmed mappings:', 
      confirmedMappings.map(m => ({
        original: m.original,
        isResidential: m.isResidential,
        residentialSource: m.residentialSource,
        isResidentialDetected: m.isResidentialDetected,
        residentialDetectionSource: m.residentialDetectionSource
      }))
    );
    
    // CRITICAL CHECK: Verify that manual residential settings are preserved
    const manualResidentialMappings = confirmedMappings.filter(m => m.residentialSource === 'manual');
    console.log('🏠 ServiceMapping page - Manual residential mappings being passed to Analysis:', manualResidentialMappings);
    
    toast.success('Service mappings confirmed! Processing analysis...');
    
    try {
      // Process ALL CSV data using mappings to create structured shipment records
      const processedShipments = csvData.map((row, index) => {
        const shipment: any = { id: index + 1 };
        
        Object.entries(mappings).forEach(([fieldName, csvHeader]) => {
          if (csvHeader && csvHeader !== "__NONE__" && row[csvHeader] !== undefined) {
            // Clean and validate the data as we process it
            let value = row[csvHeader];
            if (typeof value === 'string') {
              value = value.trim();
            }
            shipment[fieldName] = value;
          }
        });
        
        // Apply origin ZIP override if provided
        if (originZipOverride && originZipOverride.trim()) {
          shipment.originZip = originZipOverride.trim();
        }
        
        return shipment;
      });

      console.log(`Processing ${processedShipments.length} total shipments (sample):`, processedShipments.slice(0, 2));

      // Run the analysis using the same logic as the old Analysis page
      const { processedShipments: analyzedShipments, orphanedShipments, summary } = calculateSavings(processedShipments);

      // Create the analysis record with all data
      const analysisData = {
        user_id: user?.id,
        file_name: fileName,
        report_name: fileName,
        analysis_date: new Date().toISOString(),
        total_shipments: analyzedShipments.length + (orphanedShipments?.length || 0),
        total_savings: summary?.totalSavings || 0,
        status: 'completed',
        processed_shipments: analyzedShipments,
        orphaned_shipments: orphanedShipments || [],
        processing_metadata: {
          processedAt: new Date().toISOString(),
          totalProcessed: analyzedShipments.length,
          totalOrphaned: orphanedShipments?.length || 0,
          averageSavings: summary?.averageSavings || 0,
          totalCost: summary?.totalCost || 0
        },
        original_data: csvData,
        savings_analysis: summary || {},
        service_mappings: confirmedMappings,
        column_mappings: mappings,
        client_id: null
      };

      const { data: analysis, error } = await supabase
        .from('shipping_analyses')
        .insert([analysisData])
        .select()
        .single();

      if (error) throw error;

      console.log('✅ Analysis created successfully:', analysis.id);

      // Navigate directly to Results with the analysis ID (restoring original workflow)
      navigate('/results', {
        state: { analysisId: analysis.id }
      });

    } catch (error) {
      console.error('❌ Error creating analysis:', error);
      toast.error('Failed to process analysis');
    }
  };
  
  if (!csvData.length || !serviceColumn) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto p-6 text-center">
          <h1 className="text-2xl font-semibold mb-4">Loading...</h1>
          <p className="text-muted-foreground">Processing service mappings...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto p-6">
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate('/mapping')}
              iconLeft={<ArrowLeft className="h-4 w-4" />}
            >
              Back to Column Mapping
            </Button>
          </div>
          
          <h1 className="text-3xl font-semibold">Service Mapping Review</h1>
          <p className="text-muted-foreground mt-2">
            Review how your shipping services from <strong>{fileName}</strong> map to UPS services. 
            This ensures accurate rate comparisons for your {rowCount.toLocaleString()} shipments.
          </p>
        </div>
        
        {/* Service Mapping Review Component */}
        <ServiceMappingReview
          csvData={csvData}
          serviceColumn={serviceColumn}
          initialMappings={serviceMappings}
          onMappingsConfirmed={handleServiceMappingsConfirmed}
        />
      </div>
    </DashboardLayout>
  );
};

export default ServiceMapping;
