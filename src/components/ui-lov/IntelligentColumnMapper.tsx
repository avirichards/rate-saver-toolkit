import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, CheckCircle, AlertTriangle, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { parseCSV, detectServiceTypes, CSVParseResult, generateConservativeColumnMappings } from '@/utils/csvParser';

interface FieldMapping {
  fieldName: string;
  csvHeader: string;
  confidence: number;
  isAutoDetected: boolean;
}

interface ServiceMapping {
  original: string;
  standardized: string;
  standardizedService: string;
  confidence: number;
  serviceCode?: string;
  isResidential?: boolean;
  residentialSource?: string;
  isResidentialDetected?: boolean;
  residentialDetectionSource?: 'service_name' | 'address_pattern' | 'csv_data' | 'manual';
}

interface IntelligentColumnMapperProps {
  csvHeaders: string[];
  csvData: any[];
  onMappingComplete: (mappings: Record<string, string>, serviceMappings: ServiceMapping[], originZipOverride?: string) => void;
  className?: string;
}

const fieldDefinitions = [
  { name: 'trackingId', displayName: 'Tracking ID', description: 'Shipment tracking number', required: false },
  { name: 'service', displayName: 'Service Type', description: 'Shipping service used', required: true },
  { name: 'carrier', displayName: 'Carrier', description: 'Shipping carrier (UPS, FedEx, etc.)', required: false },
  { name: 'weight', displayName: 'Weight', description: 'Package weight (lbs/oz)', required: true },
  { name: 'currentRate', displayName: 'Current Cost', description: 'Current shipping cost ($)', required: true },
  { name: 'originZip', displayName: 'Origin ZIP', description: 'Pickup ZIP code', required: true },
  { name: 'destZip', displayName: 'Destination ZIP', description: 'Delivery ZIP code', required: true },
  { name: 'length', displayName: 'Length', description: 'Package length (inches) - optional, defaults to 12"', required: false },
  { name: 'width', displayName: 'Width', description: 'Package width (inches) - optional, defaults to 12"', required: false },
  { name: 'height', displayName: 'Height', description: 'Package height (inches) - optional, defaults to 6"', required: false },
  { name: 'shipperName', displayName: 'Shipper Name', description: 'Sender company/person name', required: false },
  { name: 'shipperAddress', displayName: 'Shipper Address', description: 'Sender street address', required: false },
  { name: 'shipperCity', displayName: 'Shipper City', description: 'Sender city', required: false },
  { name: 'shipperState', displayName: 'Shipper State', description: 'Sender state/province', required: false },
  { name: 'recipientName', displayName: 'Recipient Name', description: 'Receiver company/person name', required: false },
  { name: 'recipientAddress', displayName: 'Recipient Address', description: 'Receiver street address', required: false },
  { name: 'recipientCity', displayName: 'Recipient City', description: 'Receiver city', required: false },
  { name: 'recipientState', displayName: 'Recipient State', description: 'Receiver state/province', required: false },
  { name: 'zone', displayName: 'Shipping Zone', description: 'Carrier shipping zone', required: false },
  { name: 'isResidential', displayName: 'Residential Flag', description: 'Whether delivery is residential', required: false },
  { name: 'shipDate', displayName: 'Ship Date', description: 'Date the package was shipped', required: false },
  { name: 'deliveryDate', displayName: 'Delivery Date', description: 'Date the package was delivered', required: false }
];

export const IntelligentColumnMapper: React.FC<IntelligentColumnMapperProps> = ({
  csvHeaders,
  csvData,
  onMappingComplete,
  className
}) => {
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [serviceMappings, setServiceMappings] = useState<ServiceMapping[]>([]);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [userOverrides, setUserOverrides] = useState<Set<string>>(new Set());

  // Apply conservative auto-mapping on CSV load
  useEffect(() => {
    console.log('🗂️ useEffect triggered - csvHeaders:', csvHeaders.length, 'userOverrides:', userOverrides.size);
    
    if (csvHeaders.length > 0) {
      console.log('🗂️ Applying conservative auto-mapping...');
      
      const autoMappings = generateConservativeColumnMappings(csvHeaders);
      console.log('🗂️ Generated auto-mappings:', autoMappings);
      
      const initialMappings: Record<string, string> = {};
      
      autoMappings.forEach(mapping => {
        // Only apply auto-mapping if user hasn't manually set this field
        if (!userOverrides.has(mapping.fieldName)) {
          initialMappings[mapping.fieldName] = mapping.csvHeader;
          console.log(`✅ Auto-mapped: ${mapping.fieldName} → ${mapping.csvHeader} (${mapping.confidence}% confidence)`);
        }
      });
      
      setMappings(prev => ({ ...prev, ...initialMappings }));
      
      if (autoMappings.length > 0) {
        toast.success(`Auto-mapped ${autoMappings.length} columns. You can adjust any mapping as needed.`);
      }
    }
  }, [csvHeaders, userOverrides]);

  const getFieldDisplayName = (fieldName: string): string => {
    const field = fieldDefinitions.find(f => f.name === fieldName);
    return field?.displayName || fieldName;
  };

  const handleMappingChange = (fieldName: string, csvHeader: string) => {
    setMappings(prev => ({ ...prev, [fieldName]: csvHeader }));
    // Track that user manually changed this field
    setUserOverrides(prev => new Set([...prev, fieldName]));
  };

  const validateMappings = (): boolean => {
    const errors: Record<string, string> = {};
    
    // Check required fields
    fieldDefinitions.forEach(field => {
      if (field.required && (!mappings[field.name] || mappings[field.name] === "__NONE__")) {
        errors[field.name] = `${field.displayName} is required`;
      }
    });
    
    // Check for duplicate mappings
    const usedHeaders = new Set<string>();
    Object.entries(mappings).forEach(([fieldName, csvHeader]) => {
      if (csvHeader && csvHeader !== "__NONE__") {
        if (usedHeaders.has(csvHeader)) {
          errors[fieldName] = `Column "${csvHeader}" is already mapped to another field`;
        }
        usedHeaders.add(csvHeader);
      }
    });
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const getCostDataPreview = (headerName: string): { isValid: boolean; preview: string[]; issues: string[] } => {
    if (!csvData.length || !headerName) {
      return { isValid: false, preview: [], issues: ['No data available'] };
    }
    
    const sampleValues = csvData.slice(0, 5).map(row => row[headerName]).filter(val => val !== null && val !== undefined && val !== '');
    const issues: string[] = [];
    let validCount = 0;
    
    sampleValues.forEach(val => {
      const numVal = parseFloat(String(val).replace(/[,$]/g, ''));
      if (!isNaN(numVal) && numVal > 0) {
        validCount++;
      } else {
        issues.push(`"${val}" doesn't appear to be a valid cost`);
      }
    });
    
    const validationRate = sampleValues.length > 0 ? (validCount / sampleValues.length) * 100 : 0;
    
    return {
      isValid: validationRate >= 60, // 60% of sample data should be valid costs
      preview: sampleValues.map(val => String(val)).slice(0, 3),
      issues: issues.slice(0, 2) // Limit to 2 issues
    };
  };

  const handleProceed = async () => {
    if (!validateMappings()) {
      toast.error('Please fix mapping errors before proceeding');
      return;
    }
    
    // Detect service mappings if service column is mapped
    let detectedServiceMappings: ServiceMapping[] = [];
    if (mappings.service && csvData.length > 0) {
      try {
        detectedServiceMappings = detectServiceTypes(csvData, mappings.service);
        setServiceMappings(detectedServiceMappings);
      } catch (error) {
        console.error('Error detecting service types:', error);
      }
    }
    
    onMappingComplete(mappings, detectedServiceMappings);
  };

  const mappedCount = Object.keys(mappings).filter(key => mappings[key] && mappings[key] !== "__NONE__").length;
  const requiredFields = fieldDefinitions.filter(f => f.required);
  const requiredMappedCount = requiredFields.filter(f => mappings[f.name] && mappings[f.name] !== "__NONE__").length;

  return (
    <div className={className}>
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Column Mapping</h2>
            <p className="text-muted-foreground">Map your CSV columns to the required fields</p>
          </div>
        </div>

        {/* Mapping Statistics */}
        <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-muted/50 rounded-lg">
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">{mappedCount}</p>
            <p className="text-sm text-muted-foreground">Fields Mapped</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{requiredMappedCount}/{requiredFields.length}</p>
            <p className="text-sm text-muted-foreground">Required Fields</p>
          </div>
        </div>

        {/* Manual Mapping Section */}
        <div className="space-y-4">
          {fieldDefinitions.map(field => {
            const selectedColumn = mappings[field.name];
            const hasError = validationErrors[field.name];
            const costPreview = field.name === 'currentRate' && selectedColumn ? getCostDataPreview(selectedColumn) : null;
            
            return (
              <div key={field.name} className="p-4 border border-border rounded-lg bg-card">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <label className="text-sm font-medium text-foreground">
                        {field.displayName}
                        {field.required && <span className="text-destructive ml-1">*</span>}
                      </label>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">{field.description}</p>
                    
                    <Select
                      value={selectedColumn || "__NONE__"}
                      onValueChange={(value) => handleMappingChange(field.name, value === "__NONE__" ? "" : value)}
                    >
                      <SelectTrigger className={cn(
                        "w-full text-left",
                        hasError && "border-destructive"
                      )}>
                        <SelectValue placeholder="Select a column..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__NONE__">
                          <span className="text-muted-foreground">-- No Column Selected --</span>
                        </SelectItem>
                        {csvHeaders.map(header => (
                          <SelectItem key={header} value={header}>
                            {header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    {hasError && (
                      <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {hasError}
                      </p>
                    )}
                    
                    {/* Cost Data Preview */}
                    {costPreview && (
                      <div className={cn(
                        "mt-3 p-3 rounded border text-xs",
                        costPreview.isValid ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"
                      )}>
                        <div className="flex items-center gap-2 mb-2">
                          <DollarSign className="h-3 w-3" />
                          <span className="font-medium">Cost Data Preview:</span>
                        </div>
                        <div className="space-y-1">
                          <div className="flex gap-2">
                            <span className="text-muted-foreground">Sample:</span>
                            <span className="font-mono">{costPreview.preview.join(', ')}</span>
                          </div>
                          <div className={cn(
                            "flex items-center gap-1",
                            costPreview.isValid ? "text-green-700" : "text-amber-700"
                          )}>
                            {costPreview.isValid ? (
                              <CheckCircle className="h-3 w-3" />
                            ) : (
                              <AlertTriangle className="h-3 w-3" />
                            )}
                            <span>
                              {costPreview.isValid 
                                ? "✓ Valid cost data detected" 
                                : `⚠ Potential issues: ${costPreview.issues[0]}`
                              }
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Service Mapping Preview */}
        {mappings.service && serviceMappings.length > 0 && (
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h3 className="font-semibold mb-2 text-blue-900">Service Type Detection</h3>
            <p className="text-sm text-blue-700 mb-3">
              Found {serviceMappings.length} unique service types in your data
            </p>
            <div className="flex flex-wrap gap-2">
              {serviceMappings.slice(0, 5).map((mapping, index) => (
                <Badge key={index} variant="secondary" className="bg-blue-100 text-blue-800">
                  {mapping.original} → {mapping.standardized}
                </Badge>
              ))}
              {serviceMappings.length > 5 && (
                <Badge variant="outline">+{serviceMappings.length - 5} more</Badge>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 mt-6">
          <Button
            onClick={handleProceed}
            disabled={requiredMappedCount < requiredFields.length}
            className="flex items-center gap-2"
          >
            <CheckCircle className="h-4 w-4" />
            Proceed to Service Mapping
          </Button>
        </div>
      </Card>
    </div>
  );
};