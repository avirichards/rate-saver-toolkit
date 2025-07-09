import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './Card';
import { Button } from './Button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, AlertTriangle, Zap, ArrowRight, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { generateColumnMappings, detectServiceTypes, type FieldMapping, type ServiceMapping } from '@/utils/csvParser';

interface Field {
  id: string;
  label: string;
  description: string;
  required: boolean;
}

interface IntelligentColumnMapperProps {
  csvHeaders: string[];
  csvData: any[];
  onMappingComplete: (mappings: Record<string, string>, serviceMappings: ServiceMapping[]) => void;
  className?: string;
}

const REQUIRED_FIELDS: Field[] = [
  { id: 'trackingId', label: 'Tracking ID', description: 'Unique identifier for the shipment', required: true },
  { id: 'service', label: 'Service Type', description: 'Shipping service used (Ground, Express, etc.)', required: true },
  { id: 'weight', label: 'Weight (lbs)', description: 'Package weight in pounds', required: true },
  { id: 'cost', label: 'Current Cost ($)', description: 'Amount charged for the shipment', required: true }
];

const OPTIONAL_FIELDS: Field[] = [
  { id: 'originZip', label: 'Origin ZIP', description: 'Shipment origin postal code', required: false },
  { id: 'destZip', label: 'Destination ZIP', description: 'Shipment destination postal code', required: false },
  { id: 'length', label: 'Length (in)', description: 'Package length in inches', required: false },
  { id: 'width', label: 'Width (in)', description: 'Package width in inches', required: false },
  { id: 'height', label: 'Height (in)', description: 'Package height in inches', required: false },
  { id: 'zone', label: 'Shipping Zone', description: 'Carrier shipping zone', required: false },
  { id: 'shipDate', label: 'Ship Date', description: 'Date the package was shipped', required: false },
  { id: 'deliveryDate', label: 'Delivery Date', description: 'Date the package was delivered', required: false }
];

export const IntelligentColumnMapper: React.FC<IntelligentColumnMapperProps> = ({
  csvHeaders,
  csvData,
  onMappingComplete,
  className
}) => {
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [autoMappings, setAutoMappings] = useState<FieldMapping[]>([]);
  const [serviceMappings, setServiceMappings] = useState<ServiceMapping[]>([]);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Generate intelligent mappings when headers change
  useEffect(() => {
    if (csvHeaders.length > 0) {
      setIsAnalyzing(true);
      
      // Small delay to show the analyzing state
      setTimeout(() => {
        const autoDetected = generateColumnMappings(csvHeaders);
        setAutoMappings(autoDetected);
        
        // Apply auto-mappings
        const initialMappings: Record<string, string> = {};
        autoDetected.forEach(mapping => {
          initialMappings[mapping.fieldName] = mapping.csvHeader;
        });
        setMappings(initialMappings);
        
        // Show success message
        const autoMappedCount = autoDetected.length;
        if (autoMappedCount > 0) {
          toast.success(`Automatically mapped ${autoMappedCount} fields!`);
        }
        
        setIsAnalyzing(false);
      }, 1000);
    }
  }, [csvHeaders]);

  // Detect service types when service field is mapped
  useEffect(() => {
    const serviceColumn = mappings.service;
    if (serviceColumn && csvData.length > 0) {
      const detected = detectServiceTypes(csvData, serviceColumn);
      setServiceMappings(detected);
    }
  }, [mappings.service, csvData]);

  // Validate mappings
  useEffect(() => {
    const errors: Record<string, string> = {};
    
    REQUIRED_FIELDS.forEach(field => {
      if (!mappings[field.id]) {
        errors[field.id] = 'This field is required';
      }
    });
    
    setValidationErrors(errors);
  }, [mappings]);

  const handleMapping = (fieldId: string, csvHeader: string) => {
    setMappings(prev => ({
      ...prev,
      [fieldId]: csvHeader
    }));
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'bg-green-100 text-green-800';
    if (confidence >= 0.7) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getConfidenceText = (confidence: number) => {
    if (confidence >= 0.9) return 'High';
    if (confidence >= 0.7) return 'Medium';
    return 'Low';
  };

  const isRequiredFieldsMapped = () => {
    return REQUIRED_FIELDS.every(field => mappings[field.id]);
  };

  const handleContinue = () => {
    if (!isRequiredFieldsMapped()) {
      toast.error('Please map all required fields before continuing');
      return;
    }
    
    onMappingComplete(mappings, serviceMappings);
  };

  const handleReanalyze = () => {
    setIsAnalyzing(true);
    setTimeout(() => {
      const autoDetected = generateColumnMappings(csvHeaders);
      setAutoMappings(autoDetected);
      
      const newMappings: Record<string, string> = {};
      autoDetected.forEach(mapping => {
        newMappings[mapping.fieldName] = mapping.csvHeader;
      });
      setMappings(newMappings);
      
      setIsAnalyzing(false);
      toast.success('Re-analysis complete!');
    }, 1000);
  };

  const renderFieldMapping = (field: Field) => {
    const autoMapping = autoMappings.find(m => m.fieldName === field.id);
    const selectedHeader = mappings[field.id];
    const error = validationErrors[field.id];

    return (
      <div key={field.id} className="flex items-center py-3 border-b border-gray-100 last:border-b-0">
        <div className="w-1/4">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{field.label}</span>
            {field.required && <span className="text-red-500">*</span>}
            {autoMapping && (
              <div className="flex items-center gap-1">
                <Zap className="h-3 w-3 text-primary" />
                <Badge 
                  variant="secondary" 
                  className={`text-xs ${getConfidenceColor(autoMapping.confidence)}`}
                >
                  {getConfidenceText(autoMapping.confidence)}
                </Badge>
              </div>
            )}
          </div>
        </div>
        
        <div className="w-1/3 px-4">
          <p className="text-xs text-muted-foreground">{field.description}</p>
        </div>
        
        <div className="w-1/3">
          <Select
            value={selectedHeader || ""}
            onValueChange={(value) => handleMapping(field.id, value)}
          >
            <SelectTrigger className={error ? 'border-red-300' : ''}>
              <SelectValue placeholder="Select column" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">None</SelectItem>
              {csvHeaders.map(header => (
                <SelectItem key={header} value={header}>
                  {header}
                  {autoMapping?.csvHeader === header && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      Auto-detected
                    </Badge>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>
      </div>
    );
  };

  return (
    <div className={className}>
      {/* Analysis Status */}
      {isAnalyzing && (
        <Card className="mb-6 border-primary/20 bg-primary/5">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="animate-spin">
                <RefreshCw className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-primary">Analyzing CSV structure...</p>
                <p className="text-sm text-primary/70">Detecting field patterns and generating suggestions</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Required Fields */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Required Fields
                {autoMappings.filter(m => REQUIRED_FIELDS.find(f => f.id === m.fieldName)).length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    <Zap className="h-3 w-3 mr-1" />
                    Auto-detected
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                These fields are necessary for the analysis to work properly.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReanalyze}
              disabled={isAnalyzing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isAnalyzing ? 'animate-spin' : ''}`} />
              Re-analyze
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {REQUIRED_FIELDS.map(renderFieldMapping)}
          </div>
        </CardContent>
      </Card>

      {/* Optional Fields */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Optional Fields</CardTitle>
          <CardDescription>
            These fields can enhance your analysis but are not required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {OPTIONAL_FIELDS.map(renderFieldMapping)}
          </div>
        </CardContent>
      </Card>

      {/* Service Type Detection */}
      {serviceMappings.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Detected Service Types</CardTitle>
            <CardDescription>
              Found {serviceMappings.length} unique service types in your data.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {serviceMappings.map((mapping, index) => (
                <div key={index} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-sm">{mapping.original}</span>
                    <span className="text-gray-400">→</span>
                    <span className="text-sm text-muted-foreground">{mapping.standardized}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {mapping.carrier}
                    </Badge>
                    <Badge 
                      variant="secondary" 
                      className={`text-xs ${getConfidenceColor(mapping.confidence)}`}
                    >
                      {getConfidenceText(mapping.confidence)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Continue Button */}
      <div className="flex items-center justify-between">
        <div>
          {!isRequiredFieldsMapped() ? (
            <div className="flex items-center text-amber-500 text-sm">
              <AlertTriangle className="h-4 w-4 mr-2" />
              <span>Please map all required fields</span>
            </div>
          ) : (
            <div className="flex items-center text-green-500 text-sm">
              <CheckCircle className="h-4 w-4 mr-2" />
              <span>All required fields mapped</span>
            </div>
          )}
        </div>
        
        <Button 
          variant="primary" 
          onClick={handleContinue}
          disabled={!isRequiredFieldsMapped() || isAnalyzing}
          iconRight={<ArrowRight className="ml-1 h-4 w-4" />}
        >
          Continue to Analysis
        </Button>
      </div>
    </div>
  );
};