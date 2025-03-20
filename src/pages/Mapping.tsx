
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { ColumnMapper } from '@/components/ui-lov/ColumnMapper';
import { toast } from 'sonner';

const Mapping = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [headers, setHeaders] = useState<string[]>([]);
  
  useEffect(() => {
    // In a real application, we would get the headers from the parsed CSV
    // For this prototype, we'll use the headers from the location state
    const state = location.state as { headers?: string[], fileUploaded?: boolean } | null;
    
    if (!state || !state.fileUploaded) {
      // If no file was uploaded, redirect to upload page
      toast.error('Please upload a file first');
      navigate('/upload');
      return;
    }
    
    setHeaders(state.headers || []);
  }, [location, navigate]);

  const handleMappingComplete = (mapping: Record<string, string>) => {
    // In a real application, we would store the mapping in a state or context
    // and use it to process the CSV data
    console.log('Column mapping:', mapping);
    
    // Navigate to the analysis page
    navigate('/analysis', { 
      state: { 
        columnMapping: mapping,
        readyForAnalysis: true
      } 
    });
  };

  return (
    <AppLayout showProgress={true} backButtonUrl="/upload">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-semibold mb-2">Map CSV Columns</h1>
        <p className="text-muted-foreground mb-6">
          Match your CSV columns to our expected fields. Required fields are marked with an asterisk (*).
        </p>

        {headers.length > 0 ? (
          <ColumnMapper 
            csvHeaders={headers}
            onMappingComplete={handleMappingComplete}
          />
        ) : (
          <div className="text-center py-8">
            <p>Loading CSV headers...</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Mapping;
