
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui-lov/Card';
import { Button } from '@/components/ui-lov/Button';
import { ColumnMapper } from '@/components/ui-lov/ColumnMapper';
import { toast } from 'sonner';
import { AlertTriangle, Check, ArrowRight } from 'lucide-react';

// Mock CSV headers that would come from the uploaded file
const mockCsvHeaders = [
  'tracking_number', 'service_name', 'weight', 'length', 'width', 
  'height', 'zone', 'from_zip', 'to_zip', 'ship_date', 'delivery_date', 
  'cost', 'status'
];

// Required fields for the analysis
const requiredFields = [
  { id: 'trackingId', label: 'Tracking ID', description: 'Unique identifier for the shipment' },
  { id: 'service', label: 'Service Type', description: 'Shipping service used (Ground, Express, etc.)' },
  { id: 'weight', label: 'Weight (lbs)', description: 'Package weight in pounds' },
  { id: 'cost', label: 'Current Cost ($)', description: 'Amount charged for the shipment' }
];

// Optional fields that can enhance the analysis
const optionalFields = [
  { id: 'originZip', label: 'Origin ZIP', description: 'Shipment origin postal code' },
  { id: 'destZip', label: 'Destination ZIP', description: 'Shipment destination postal code' },
  { id: 'length', label: 'Length (in)', description: 'Package length in inches' },
  { id: 'width', label: 'Width (in)', description: 'Package width in inches' },
  { id: 'height', label: 'Height (in)', description: 'Package height in inches' },
  { id: 'zone', label: 'Shipping Zone', description: 'Carrier shipping zone' },
  { id: 'shipDate', label: 'Ship Date', description: 'Date the package was shipped' },
  { id: 'deliveryDate', label: 'Delivery Date', description: 'Date the package was delivered' }
];

// Create a backward-compatible ColumnMapper component
const ColumnMapperAdapter = ({ field, csvHeaders, selectedHeader, onSelect, error, required }) => {
  return (
    <ColumnMapper
      field={field}
      csvHeaders={csvHeaders}
      selectedHeader={selectedHeader}
      onSelect={onSelect}
      error={error}
      required={required}
    />
  );
};

const Mapping = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [mappings, setMappings] = useState({});
  const [validationErrors, setValidationErrors] = useState({});
  const [allRequiredMapped, setAllRequiredMapped] = useState(false);
  
  // Check if we have file upload data from the previous step
  useEffect(() => {
    const state = location.state as { fileUploaded?: boolean, fileName?: string } | null;
    
    if (!state || !state.fileUploaded) {
      // If no file was uploaded, redirect to the upload page
      toast.error('Please upload a file first');
      navigate('/upload');
    }
  }, [location, navigate]);
  
  // Update validation whenever mappings change
  useEffect(() => {
    const errors = {};
    let allMapped = true;
    
    // Check if all required fields are mapped
    requiredFields.forEach(field => {
      if (!mappings[field.id]) {
        errors[field.id] = 'This field is required';
        allMapped = false;
      }
    });
    
    setValidationErrors(errors);
    setAllRequiredMapped(allMapped);
  }, [mappings]);
  
  const handleMapping = (fieldId, csvHeader) => {
    setMappings(prev => ({
      ...prev,
      [fieldId]: csvHeader
    }));
  };
  
  const handleContinue = () => {
    if (!allRequiredMapped) {
      toast.error('Please map all required fields before continuing');
      return;
    }
    
    // In a real app, we would save the mappings to state/context/backend
    console.log('Final mappings:', mappings);
    toast.success('Column mapping saved!');
    
    // Navigate to the analysis page
    navigate('/analysis', { 
      state: { 
        readyForAnalysis: true,
        mappings 
      } 
    });
  };
  
  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold">Map CSV Columns</h1>
          <p className="text-muted-foreground mt-2">
            Match your CSV columns to the required fields for analysis.
          </p>
        </div>
        
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Required Fields</CardTitle>
            <CardDescription>These fields are necessary for the analysis to work properly.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {requiredFields.map((field) => (
                <ColumnMapperAdapter
                  key={field.id}
                  field={field}
                  csvHeaders={mockCsvHeaders}
                  selectedHeader={mappings[field.id]}
                  onSelect={(header) => handleMapping(field.id, header)}
                  error={validationErrors[field.id]}
                  required={true}
                />
              ))}
            </div>
          </CardContent>
        </Card>
        
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Optional Fields</CardTitle>
            <CardDescription>These fields can enhance your analysis but are not required.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {optionalFields.map((field) => (
                <ColumnMapperAdapter
                  key={field.id}
                  field={field}
                  csvHeaders={mockCsvHeaders}
                  selectedHeader={mappings[field.id]}
                  onSelect={(header) => handleMapping(field.id, header)}
                  required={false}
                />
              ))}
            </div>
          </CardContent>
        </Card>
        
        <div className="flex items-center justify-between">
          <div>
            {!allRequiredMapped ? (
              <div className="flex items-center text-amber-500 text-sm">
                <AlertTriangle className="h-4 w-4 mr-2" />
                <span>Please map all required fields</span>
              </div>
            ) : (
              <div className="flex items-center text-green-500 text-sm">
                <Check className="h-4 w-4 mr-2" />
                <span>All required fields mapped</span>
              </div>
            )}
          </div>
          
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={() => navigate('/upload')}
            >
              Go Back
            </Button>
            <Button 
              variant="primary" 
              onClick={handleContinue}
              disabled={!allRequiredMapped}
              iconRight={<ArrowRight className="ml-1 h-4 w-4" />}
            >
              Continue to Analysis
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Mapping;
