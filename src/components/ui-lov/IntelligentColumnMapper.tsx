import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui-lov/Card';
import { Button } from '@/components/ui-lov/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Zap, CheckCircle, AlertCircle, RotateCw, X, Pencil } from 'lucide-react';
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
  onMappingComplete: (mappings: Record<string, string>, serviceMappings: ServiceMapping[], originZipOverride?: string) => void;
  className?: string;
}

const ALL_FIELDS: Field[] = [
  { id: 'trackingId', label: 'Tracking ID', description: 'Shipment tracking number', required: false },
  { id: 'service', label: 'Service Type', description: 'Shipping service used', required: false },
  { id: 'carrier', label: 'Carrier (optional)', description: 'Shipping carrier (UPS, FedEx, etc.)', required: false },
  { id: 'weight', label: 'Weight', description: 'Package weight (lbs/oz)', required: true },
  { id: 'cost', label: 'Current Cost', description: 'Current shipping cost ($)', required: false },
  { id: 'originZip', label: 'Origin ZIP', description: 'Pickup ZIP code', required: true },
  { id: 'destZip', label: 'Destination ZIP', description: 'Delivery ZIP code', required: true },
  { id: 'zone', label: 'Shipping Zone', description: 'Carrier shipping zone (required for rate card analysis)', required: false },
  { id: 'length', label: 'Length', description: 'Package length (inches) - optional, defaults to 12"', required: false },
  { id: 'width', label: 'Width', description: 'Package width (inches) - optional, defaults to 12"', required: false },
  { id: 'height', label: 'Height', description: 'Package height (inches) - optional, defaults to 6"', required: false },
  { id: 'shipperName', label: 'Shipper Name', description: 'Sender company/person name', required: false },
  { id: 'shipperAddress', label: 'Shipper Address', description: 'Sender street address', required: false },
  { id: 'shipperCity', label: 'Shipper City', description: 'Sender city', required: false },
  { id: 'shipperState', label: 'Shipper State', description: 'Sender state/province', required: false },
  { id: 'recipientName', label: 'Recipient Name', description: 'Receiver company/person name', required: false },
  { id: 'recipientAddress', label: 'Recipient Address', description: 'Receiver street address', required: false },
  { id: 'recipientCity', label: 'Recipient City', description: 'Receiver city', required: false },
  { id: 'recipientState', label: 'Recipient State', description: 'Receiver state/province', required: false },
  { id: 'shipDate', label: 'Ship Date', description: 'Date the package was shipped', required: false },
  { id: 'deliveryDate', label: 'Delivery Date', description: 'Date the package was delivered', required: false }
];

// Ensure the constant is properly exported/accessible
const REQUIRED_FIELDS = ALL_FIELDS.filter(f => f.required);

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
  const [userModifiedFields, setUserModifiedFields] = useState<Set<string>>(new Set());
  const [showCostDataPreview, setShowCostDataPreview] = useState(false);
  
  const [useManualOriginZip, setUseManualOriginZip] = useState(false);
  const [manualOriginZip, setManualOriginZip] = useState('');

  useEffect(() => {
    console.log('IntelligentColumnMapper - Starting auto-detection with headers:', csvHeaders);
    if (csvHeaders.length > 0) {
      performAutoDetection();
    }
  }, [csvHeaders]);

  const performAutoDetection = () => {
    setIsAnalyzing(true);
    
    setTimeout(() => {
      console.log('Running auto-detection for CSV headers:', csvHeaders);
      const autoDetected = generateColumnMappings(csvHeaders);
      console.log('Auto-detection results:', autoDetected);
      setAutoMappings(autoDetected);
      
      const newMappings: Record<string, string> = {};
      autoDetected.forEach(mapping => {
        newMappings[mapping.fieldName] = mapping.csvHeader;
      });
      setMappings(newMappings);
      
      setIsAnalyzing(false);
      toast.success('Auto-detection complete!');
    }, 1000);
  };

  const handleMappingChange = (fieldId: string, csvHeader: string) => {
    const newMappings = { ...mappings };
    
    // Mark this field as user-modified
    const newUserModifiedFields = new Set(userModifiedFields);
    newUserModifiedFields.add(fieldId);
    setUserModifiedFields(newUserModifiedFields);
    
    if (csvHeader === "__NONE__") {
      delete newMappings[fieldId];
    } else {
      // Check if this header is already mapped to another field
      const conflictingField = Object.entries(mappings).find(
        ([existingFieldId, existingHeader]) => 
          existingHeader === csvHeader && existingFieldId !== fieldId
      );
      
      if (conflictingField) {
        // Clear the conflicting mapping
        delete newMappings[conflictingField[0]];
        const conflictingFieldLabel = ALL_FIELDS.find(f => f.id === conflictingField[0])?.label || conflictingField[0];
        toast.info(`Moved "${csvHeader}" from ${conflictingFieldLabel} to ${ALL_FIELDS.find(f => f.id === fieldId)?.label}`);
      }
      
      newMappings[fieldId] = csvHeader;
    }
    
    setMappings(newMappings);
    
    // Clear validation errors for affected fields
    const newErrors = { ...validationErrors };
    delete newErrors[fieldId];
    // Also clear error from previously conflicting field if it exists
    if (Object.entries(mappings).find(([_, header]) => header === csvHeader)) {
      Object.keys(newErrors).forEach(errorFieldId => {
        if (mappings[errorFieldId] === csvHeader) {
          delete newErrors[errorFieldId];
        }
      });
    }
    setValidationErrors(newErrors);
  };

  const validateMappings = (): boolean => {
    const errors: Record<string, string> = {};
    
    // Check required fields
    ALL_FIELDS.forEach(field => {
      if (field.required && field.id !== 'originZip' && (!mappings[field.id] || mappings[field.id] === "__NONE__")) {
        errors[field.id] = `${field.label} is required for UPS rate calculations`;
      }
    });
    
    // Special validation for Origin ZIP
    if (!useManualOriginZip && (!mappings.originZip || mappings.originZip === "__NONE__")) {
      errors.originZip = 'Origin ZIP is required for UPS rate calculations';
    }
    if (useManualOriginZip && !manualOriginZip.trim()) {
      errors.originZip = 'Please enter a manual Origin ZIP code';
    }
    if (useManualOriginZip && manualOriginZip.trim() && !/^\d{5}(-\d{4})?$/.test(manualOriginZip.trim())) {
      errors.originZip = 'Please enter a valid ZIP code (12345 or 12345-6789)';
    }
    
    // Check for duplicate mappings - improved error messages
    const headerToField = new Map<string, string>();
    const duplicateFields = new Set<string>();
    
    // First pass: find all duplicates
    Object.entries(mappings).forEach(([fieldId, header]) => {
      if (header && header !== "__NONE__") {
        if (headerToField.has(header)) {
          // Mark both fields as having conflicts
          const conflictingFieldId = headerToField.get(header)!;
          duplicateFields.add(fieldId);
          duplicateFields.add(conflictingFieldId);
        }
        headerToField.set(header, fieldId);
      }
    });
    
    // Second pass: add specific error messages for all conflicting fields
    duplicateFields.forEach(fieldId => {
      const header = mappings[fieldId];
      const conflictingFieldId = Array.from(headerToField.entries())
        .find(([h, fId]) => h === header && fId !== fieldId)?.[1];
      
      if (conflictingFieldId) {
        const conflictingField = ALL_FIELDS.find(f => f.id === conflictingFieldId);
        const conflictingFieldLabel = conflictingField?.label || conflictingFieldId;
        errors[fieldId] = `Column "${header}" is already mapped to ${conflictingFieldLabel}`;
      }
    });
    
    // Debug logging
    console.log('Validation state:', {
      mappings,
      headerToField: Object.fromEntries(headerToField),
      duplicateFields: Array.from(duplicateFields),
      errors
    });
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleReAnalyze = () => {
    setIsAnalyzing(true);
    setTimeout(() => {
      const autoDetected = generateColumnMappings(csvHeaders);
      setAutoMappings(autoDetected);
      
      // Preserve user selections - only update fields that haven't been manually modified
      const newMappings: Record<string, string> = { ...mappings };
      autoDetected.forEach(mapping => {
        // Only apply auto-detection if user hasn't manually modified this field
        if (!userModifiedFields.has(mapping.fieldName)) {
          newMappings[mapping.fieldName] = mapping.csvHeader;
        }
      });
      setMappings(newMappings);
      
      setIsAnalyzing(false);
      toast.success('Re-analysis complete! Your manual selections were preserved.');
    }, 1000);
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

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return 'bg-green-100 text-green-800';
    if (confidence >= 0.6) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getConfidenceText = (confidence: number): string => {
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.6) return 'Medium';
    return 'Low';
  };

  const renderFieldMapping = (field: Field) => {
    const autoMapping = autoMappings.find(m => m.fieldName === field.id);
    const selectedHeader = mappings[field.id];
    const error = validationErrors[field.id];

    // Special handling for Origin ZIP field
    if (field.id === 'originZip') {
      return (
        <div key={field.id} className="flex items-center py-3 border-b border-border/50 last:border-b-0">
          <div className="w-1/4">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{field.label}</span>
              <span className="text-red-500">*</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setUseManualOriginZip(!useManualOriginZip)}
                className="h-6 w-6 p-0"
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <div className="flex items-center gap-1">
                <Switch
                  checked={useManualOriginZip}
                  onCheckedChange={setUseManualOriginZip}
                  id="manual-origin-toggle"
                  className="scale-75"
                />
                <Label htmlFor="manual-origin-toggle" className="text-xs">
                  {useManualOriginZip ? 'Fixed' : 'CSV'}
                </Label>
              </div>
              {useManualOriginZip && (
                <Badge variant="secondary" className="text-xs">
                  Manual
                </Badge>
              )}
              {autoMapping && !useManualOriginZip && (
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
            {useManualOriginZip ? (
              <Input
                placeholder="Enter ZIP code (e.g., 12345)"
                value={manualOriginZip}
                onChange={(e) => setManualOriginZip(e.target.value)}
                className={error ? 'border-red-500' : ''}
              />
            ) : (
              <Select 
                value={selectedHeader || "__NONE__"} 
                onValueChange={(value) => handleMappingChange(field.id, value)}
              >
                <SelectTrigger className={`w-full ${error ? 'border-red-500' : ''}`}>
                  <SelectValue placeholder="Select column..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__NONE__" disabled>
                    <div className="flex items-center gap-2">
                      <X className="h-4 w-4 text-muted-foreground" />
                      <span>Required field</span>
                    </div>
                  </SelectItem>
                  {csvHeaders.filter(header => header && header.trim()).map((header) => (
                    <SelectItem key={header} value={header}>
                      {header}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          </div>
        </div>
      );
    }

    return (
      <div key={field.id} className="flex items-center py-3 border-b border-border/50 last:border-b-0">
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
            value={selectedHeader || "__NONE__"} 
            onValueChange={(value) => handleMappingChange(field.id, value)}
          >
            <SelectTrigger className={`w-full ${error ? 'border-red-500' : ''}`}>
              <SelectValue placeholder="Select column..." />
            </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__NONE__" disabled={field.required}>
                    <div className="flex items-center gap-2">
                      <X className="h-4 w-4 text-muted-foreground" />
                      <span>{field.required ? 'Required field' : 'Skip this field'}</span>
                    </div>
                  </SelectItem>
                  {csvHeaders.filter(header => header && header.trim()).map((header) => {
                    // Check if this header is already mapped to another field
                    const mappedToOtherField = Object.entries(mappings).find(
                      ([otherFieldId, otherHeader]) => 
                        otherHeader === header && otherFieldId !== field.id
                    );
                    const mappedFieldLabel = mappedToOtherField ? 
                      ALL_FIELDS.find(f => f.id === mappedToOtherField[0])?.label : null;
                    
                    return (
                      <SelectItem 
                        key={header} 
                        value={header}
                        className={mappedToOtherField ? 'text-orange-600' : ''}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span>{header}</span>
                          {mappedToOtherField && (
                            <Badge variant="outline" className="ml-2 text-xs text-orange-600 border-orange-300">
                              Used by {mappedFieldLabel}
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
          </Select>
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          
          {/* Cost field data preview */}
          {field.id === 'cost' && selectedHeader && selectedHeader !== "__NONE__" && (
            <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
              {(() => {
                const preview = getCostDataPreview(selectedHeader);
                return (
                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      {preview.isValid ? (
                        <CheckCircle className="h-3 w-3 text-green-600" />
                      ) : (
                        <AlertCircle className="h-3 w-3 text-orange-600" />
                      )}
                      <span className="font-medium">
                        {preview.isValid ? 'Data looks good!' : 'Data validation warning'}
                      </span>
                    </div>
                    {preview.preview.length > 0 && (
                      <div className="mb-1">
                        <span className="text-muted-foreground">Sample: </span>
                        <span>{preview.preview.join(', ')}</span>
                      </div>
                    )}
                    {preview.issues.length > 0 && (
                      <div className="text-orange-600">
                        {preview.issues.join('; ')}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    );
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
    
    onMappingComplete(mappings, detectedServiceMappings, useManualOriginZip ? manualOriginZip.trim() : undefined);
  };

  const mappedCount = Object.keys(mappings).filter(key => mappings[key] && mappings[key] !== "__NONE__").length;
  const requiredCount = ALL_FIELDS.filter(f => f.required).length;
  const requiredMappedCount = ALL_FIELDS.filter(f => {
    if (!f.required) return false;
    if (f.id === 'originZip') {
      // Count Origin ZIP as mapped if either CSV mapping exists or manual override is valid
      return (mappings[f.id] && mappings[f.id] !== "__NONE__") || 
             (useManualOriginZip && manualOriginZip.trim() && /^\d{5}(-\d{4})?$/.test(manualOriginZip.trim()));
    }
    return mappings[f.id] && mappings[f.id] !== "__NONE__";
  }).length;

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Intelligent Field Mapping
                {isAnalyzing && <RotateCw className="h-4 w-4 animate-spin text-primary" />}
              </CardTitle>
              <CardDescription>
                We've analyzed your CSV and auto-detected field mappings. Review and adjust as needed.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReAnalyze}
              disabled={isAnalyzing}
              iconLeft={<RotateCw className="h-4 w-4" />}
            >
              Re-analyze
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Mapping Statistics */}
          <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-muted/50 rounded-lg">
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{mappedCount}</p>
              <p className="text-sm text-muted-foreground">Fields Mapped</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{requiredMappedCount}/{requiredCount}</p>
              <p className="text-sm text-muted-foreground">Required Fields</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{autoMappings.length}</p>
              <p className="text-sm text-muted-foreground">Auto-Detected</p>
            </div>
          </div>
          
          {/* All Fields */}
          <div className="mb-6">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-orange-500" />
              Field Mapping
            </h3>
            <div className="space-y-1">
              {ALL_FIELDS.map(renderFieldMapping)}
            </div>
          </div>
          
          {/* Service Mapping Preview */}
          {mappings.service && serviceMappings.length > 0 && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
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
          <div className="flex justify-end gap-3">
            <Button
              variant="primary"
              onClick={handleProceed}
              disabled={requiredMappedCount < requiredCount}
              iconRight={<CheckCircle className="ml-1 h-4 w-4" />}
            >
              Proceed to Analysis
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};