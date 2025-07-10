
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui-lov/Card';
import { Button } from '@/components/ui-lov/Button';
import { IntelligentColumnMapper } from '@/components/ui-lov/IntelligentColumnMapper';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { ServiceMapping } from '@/utils/csvParser';

interface LocationState {
  csvUploadId?: string;
  fileName?: string;
  headers?: string[];
  data?: any[];
  rowCount?: number;
  fileUploaded?: boolean;
}

const Mapping = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [csvUploadId, setCsvUploadId] = useState<string>('');
  const [rowCount, setRowCount] = useState<number>(0);
  
  // Check if we have file upload data from the previous step
  useEffect(() => {
    const state = location.state as LocationState | null;
    
    if (!state || !state.fileUploaded || !state.headers) {
      toast.error('Please upload a file first');
      navigate('/upload');
      return;
    }

    console.log('Mapping page - CSV Headers received:', state.headers);
    console.log('Mapping page - CSV Data sample:', state.data?.slice(0, 2));
    
    setCsvHeaders(state.headers);
    setCsvData(state.data || []);
    setFileName(state.fileName || '');
    setCsvUploadId(state.csvUploadId || '');
    setRowCount(state.rowCount || 0);
  }, [location, navigate]);
  
  const handleMappingComplete = async (mappings: Record<string, string>, serviceMappings: ServiceMapping[]) => {
    if (!user || !csvUploadId) {
      toast.error('Missing required data');
      return;
    }

    try {
      // Save column mappings to database
      const mappingInserts = Object.entries(mappings)
        .filter(([_, csvHeader]) => csvHeader && csvHeader !== "__NONE__")
        .map(([fieldName, csvHeader]) => ({
          csv_upload_id: csvUploadId,
          field_name: fieldName,
          csv_header: csvHeader,
          is_required: ['trackingId', 'service', 'weight', 'cost', 'originZip', 'destZip', 'length', 'width', 'height'].includes(fieldName),
          is_auto_detected: true,
          confidence_score: 1.0
        }));

      const { error: mappingError } = await supabase
        .from('column_mappings')
        .insert(mappingInserts);

      if (mappingError) {
        throw mappingError;
      }

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
        
        return shipment;
      });

      console.log(`Processing ${processedShipments.length} total shipments (sample):`, processedShipments.slice(0, 2));

      toast.success('Column mapping saved successfully!');
      
      // Navigate to the analysis page with processed data
      navigate('/analysis', { 
        state: { 
          csvUploadId,
          fileName,
          mappings,
          serviceMappings,
          rowCount,
          processedShipments,
          readyForAnalysis: true
        } 
      });
      
    } catch (error) {
      console.error('Error saving mappings:', error);
      toast.error('Failed to save column mappings');
    }
  };
  
  if (!csvHeaders.length) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto p-6 text-center">
          <h1 className="text-2xl font-semibold mb-4">Loading...</h1>
          <p className="text-muted-foreground">Processing your uploaded file...</p>
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
              onClick={() => navigate('/upload')}
              iconLeft={<ArrowLeft className="h-4 w-4" />}
            >
              Back to Upload
            </Button>
          </div>
          
          <h1 className="text-3xl font-semibold">Smart Column Mapping</h1>
          <p className="text-muted-foreground mt-2">
            We've analyzed <strong>{fileName}</strong> and detected {csvHeaders.length} columns 
            with {rowCount.toLocaleString()} rows. Review and confirm the field mappings below.
          </p>
        </div>
        
        {/* File Preview */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>File Preview</CardTitle>
            <CardDescription>
              First few rows from your uploaded file
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-xs border-collapse">
                 <thead>
                   <tr className="border-b bg-muted/50">
                     {csvHeaders.map((header, index) => (
                       <th key={index} className="text-left py-2 px-3 font-medium">
                         {header}
                       </th>
                     ))}
                   </tr>
                 </thead>
                 <tbody className="max-h-64 overflow-y-auto">
                   {csvData.slice(0, 20).map((row, rowIndex) => (
                     <tr key={rowIndex} className="border-b border-border/50">
                       {csvHeaders.map((header, colIndex) => (
                         <td key={colIndex} className="py-2 px-3 text-muted-foreground">
                           {row[header] || '-'}
                         </td>
                       ))}
                     </tr>
                   ))}
                 </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        
        {/* Intelligent Column Mapper */}
        <IntelligentColumnMapper
          csvHeaders={csvHeaders}
          csvData={csvData}
          onMappingComplete={handleMappingComplete}
        />
      </div>
    </DashboardLayout>
  );
};

export default Mapping;
