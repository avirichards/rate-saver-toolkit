import React, { useState } from 'react';
import { Button } from '@/components/ui-lov/Button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Upload, FileText, Download, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export interface RateCardData {
  id: string;
  service_type: string;
  weight_unit: 'lbs' | 'oz';
  csv_file: File | null;
  service_name: string;
}

interface RateCardEntryProps {
  index: number;
  rateCard: RateCardData;
  onUpdate: (id: string, updates: Partial<RateCardData>) => void;
  onDelete: (id: string) => void;
}

const SERVICE_TYPES = [
  { value: 'ground', label: 'Ground' },
  { value: 'next_day_air', label: 'Next Day Air' },
  { value: 'next_day_air_saver', label: 'Next Day Air Saver' },
  { value: '2nd_day_air', label: '2nd Day Air' },
  { value: '3_day_select', label: '3 Day Select' },
  { value: 'express', label: 'Express' },
  { value: 'expedited', label: 'Expedited' },
  { value: 'standard', label: 'Standard' },
  { value: 'priority', label: 'Priority' },
];

export const RateCardEntry = ({ index, rateCard, onUpdate, onDelete }: RateCardEntryProps) => {
  const downloadSampleFile = () => {
    const sampleCSV = `Service,B1,B2,B3,B4,B5,B6,B7,B8
A2,10.50,11.25,12.00,13.75,15.50,17.25,19.00,20.75
A3,11.00,11.75,12.50,14.25,16.00,17.75,19.50,21.25
A4,11.50,12.25,13.00,14.75,16.50,18.25,20.00,21.75
A5,12.00,12.75,13.50,15.25,17.00,18.75,20.50,22.25`;

    const blob = new Blob([sampleCSV], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rate-card-${rateCard.service_type}-sample.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    toast.success('Sample file downloaded');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'text/csv') {
      onUpdate(rateCard.id, { csv_file: file });
    } else {
      toast.error('Please select a CSV file');
      e.target.value = '';
    }
  };

  return (
    <div className="border border-border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">Rate Card {index + 1}</h4>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onDelete(rateCard.id)}
          iconLeft={<Trash2 className="h-4 w-4" />}
        >
          Delete
        </Button>
      </div>

      <div className="space-y-2">
        <Label>Service Type *</Label>
        <Select 
          value={rateCard.service_type} 
          onValueChange={(value) => {
            const serviceType = SERVICE_TYPES.find(s => s.value === value);
            onUpdate(rateCard.id, { 
              service_type: value,
              service_name: serviceType?.label || value
            });
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select service type" />
          </SelectTrigger>
          <SelectContent>
            {SERVICE_TYPES.map(service => (
              <SelectItem key={service.value} value={service.value}>
                {service.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        <Label>Weight Unit *</Label>
        <RadioGroup 
          value={rateCard.weight_unit} 
          onValueChange={(value: 'lbs' | 'oz') => onUpdate(rateCard.id, { weight_unit: value })}
          className="flex gap-6"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="lbs" id={`lbs-${rateCard.id}`} />
            <Label htmlFor={`lbs-${rateCard.id}`}>Pounds (lbs)</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="oz" id={`oz-${rateCard.id}`} />
            <Label htmlFor={`oz-${rateCard.id}`}>Ounces (oz)</Label>
          </div>
        </RadioGroup>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>CSV File *</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={downloadSampleFile}
            iconLeft={<Download className="h-4 w-4" />}
          >
            Download Sample
          </Button>
        </div>
        <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4">
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="hidden"
            id={`csv-${rateCard.id}`}
          />
          <label htmlFor={`csv-${rateCard.id}`} className="cursor-pointer">
            <div className="flex flex-col items-center space-y-2">
              {rateCard.csv_file ? (
                <>
                  <FileText className="h-6 w-6 text-success" />
                  <span className="text-sm font-medium">{rateCard.csv_file.name}</span>
                  <span className="text-xs text-muted-foreground">Click to change file</span>
                </>
              ) : (
                <>
                  <Upload className="h-6 w-6 text-muted-foreground" />
                  <span className="text-sm font-medium">Upload CSV File</span>
                  <span className="text-xs text-muted-foreground">Zones: B1-B20, Weights: A2-A200</span>
                </>
              )}
            </div>
          </label>
        </div>
      </div>
    </div>
  );
};