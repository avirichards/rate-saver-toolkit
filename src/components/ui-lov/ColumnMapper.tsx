
import React, { useState } from 'react';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from './Card';
import { Button } from './Button';
import { ArrowRight, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface ColumnMappingField {
  required: boolean;
  name: string;
  description: string;
  mappedTo: string | null;
}

export interface ColumnMapperProps {
  csvHeaders: string[];
  onMappingComplete?: (mapping: Record<string, string>) => void;
  className?: string;
  field?: { id: string; label: string; description: string };
  selectedHeader?: any;
  onSelect?: (header: any) => void;
  error?: any;
  required?: boolean;
}

export const ColumnMapper: React.FC<ColumnMapperProps> = ({
  csvHeaders,
  onMappingComplete = () => {}, // Add default empty function
  className,
  field,
  selectedHeader,
  onSelect,
  error,
  required,
}) => {
  const [fields, setFields] = useState<ColumnMappingField[]>([
    { required: true, name: 'trackingNumber', description: 'Shipment tracking ID', mappedTo: null },
    { required: true, name: 'weight', description: 'Package weight', mappedTo: null },
    { required: true, name: 'serviceType', description: 'Shipping service used', mappedTo: null },
    { required: true, name: 'cost', description: 'Current shipping cost', mappedTo: null },
    { required: false, name: 'destination', description: 'Shipping destination', mappedTo: null },
    { required: false, name: 'length', description: 'Package length', mappedTo: null },
    { required: false, name: 'width', description: 'Package width', mappedTo: null },
    { required: false, name: 'height', description: 'Package height', mappedTo: null },
    { required: false, name: 'isResidential', description: 'Residential delivery indicator', mappedTo: null },
  ]);

  React.useEffect(() => {
    if (csvHeaders.length > 0) {
      const newFields = [...fields];
      let changedAny = false;
      
      fields.forEach((field, index) => {
        if (field.mappedTo) return;
        
        const exactMatch = csvHeaders.find(
          header => header.toLowerCase() === field.name.toLowerCase()
        );
        
        if (exactMatch) {
          newFields[index] = { ...field, mappedTo: exactMatch };
          changedAny = true;
          return;
        }
        
        const partialMatches = csvHeaders.filter(
          header => header.toLowerCase().includes(field.name.toLowerCase()) ||
                    field.name.toLowerCase().includes(header.toLowerCase())
        );
        
        if (partialMatches.length === 1) {
          newFields[index] = { ...field, mappedTo: partialMatches[0] };
          changedAny = true;
        }
      });
      
      if (changedAny) {
        setFields(newFields);
        toast.info('Some fields were automatically mapped based on column names');
      }
    }
  }, [csvHeaders]);

  const handleFieldMapping = (fieldName: string, csvHeader: string) => {
    setFields(prev => 
      prev.map(field => 
        field.name === fieldName 
          ? { ...field, mappedTo: csvHeader } 
          : field
      )
    );
  };

  const isRequiredFieldsMapped = () => {
    return fields
      .filter(field => field.required)
      .every(field => field.mappedTo !== null);
  };

  const handleMappingComplete = () => {
    if (!isRequiredFieldsMapped()) {
      toast.error('Please map all required fields');
      return;
    }
    
    const mapping: Record<string, string> = {};
    fields.forEach(field => {
      if (field.mappedTo) {
        mapping[field.name] = field.mappedTo;
      }
    });
    
    onMappingComplete(mapping);
    toast.success('Column mapping completed successfully');
  };

  if (field && onSelect !== undefined) {
    return (
      <div className="flex items-center mb-2">
        <div className="w-1/3">
          <span className="font-medium">{field.label}</span>
          {required && <span className="text-red-500 ml-1">*</span>}
        </div>
        <div className="w-1/3 text-sm text-muted-foreground">{field.description}</div>
        <div className="w-1/3">
          <Select
            value={selectedHeader || ""}
            onValueChange={onSelect}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select column" />
            </SelectTrigger>
            <SelectContent>
              {csvHeaders.map(header => (
                <SelectItem key={header} value={header}>{header}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Map CSV Columns</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {fields.map((field) => (
            <div key={field.name} className="flex items-center">
              <div className="w-1/3 flex items-center">
                <span className="font-medium text-sm">
                  {field.name}
                </span>
                {field.required && (
                  <span className="text-red-500 ml-1">*</span>
                )}
              </div>
              <div className="w-1/3 text-sm text-muted-foreground">
                {field.description}
              </div>
              <div className="w-1/3">
                <Select
                  value={field.mappedTo || ''}
                  onValueChange={(value) => handleFieldMapping(field.name, value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a column" />
                  </SelectTrigger>
                  <SelectContent>
                    {csvHeaders.map((header) => (
                      <SelectItem key={header} value={header}>
                        {header}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
          
          <div className="pt-4 flex justify-between items-center">
            <div className="flex items-center">
              {isRequiredFieldsMapped() ? (
                <div className="flex items-center text-sm text-app-green-600">
                  <CheckCircle className="h-4 w-4 mr-1" />
                  All required fields mapped
                </div>
              ) : (
                <div className="flex items-center text-sm text-amber-600">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  Map all required fields to continue
                </div>
              )}
            </div>
            <Button
              variant="primary"
              iconRight={<ArrowRight className="h-4 w-4" />}
              disabled={!isRequiredFieldsMapped()}
              onClick={handleMappingComplete}
            >
              Continue
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
