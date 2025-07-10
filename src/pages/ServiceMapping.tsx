import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui-lov/Button';
import { ServiceMappingReview } from '@/components/ui-lov/ServiceMappingReview';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import { detectServiceTypes } from '@/utils/csvParser';
import type { ServiceMapping } from '@/utils/csvParser';

interface LocationState {
  csvUploadId?: string;
  fileName?: string;
  mappings?: Record<string, string>;
  csvData?: any[];
  rowCount?: number;
  serviceColumn?: string;
  readyForServiceMapping?: boolean;
}

const ServiceMapping = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [csvData, setCsvData] = useState<any[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [csvUploadId, setCsvUploadId] = useState<string>('');
  const [rowCount, setRowCount] = useState<number>(0);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [serviceColumn, setServiceColumn] = useState<string>('');
  const [serviceMappings, setServiceMappings] = useState<ServiceMapping[]>([]);
  
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
    setMappings(state.mappings);
    
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
  
  const handleServiceMappingsConfirmed = (confirmedMappings: ServiceMapping[]) => {
    console.log('Service mappings confirmed:', confirmedMappings);
    
    toast.success('Service mappings confirmed!');
    
    // Navigate to analysis with all the data including confirmed service mappings
    navigate('/analysis', { 
      state: { 
        csvUploadId,
        fileName,
        mappings,
        serviceMappings: confirmedMappings,
        rowCount,
        csvData,
        readyForAnalysis: true
      } 
    });
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