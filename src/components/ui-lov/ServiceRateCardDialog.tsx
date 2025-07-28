import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui-lov/Button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, FileText, Download, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { UniversalServiceCategory } from '@/utils/universalServiceCategories';

interface ServiceRateCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  carrierId: string;
  serviceCode: string;
  serviceName: string;
  onSuccess: () => void;
  existingRateCard?: any;
}

const SERVICE_MAPPINGS = [
  { code: 'GROUND', name: 'Ground', category: UniversalServiceCategory.GROUND },
  { code: 'NEXT_DAY_AIR', name: 'Next Day Air', category: UniversalServiceCategory.OVERNIGHT },
  { code: '2ND_DAY_AIR', name: '2nd Day Air', category: UniversalServiceCategory.TWO_DAY },
  { code: 'EXPRESS', name: 'Express', category: UniversalServiceCategory.INTERNATIONAL_EXPRESS },
  { code: 'INTERNATIONAL', name: 'International', category: UniversalServiceCategory.INTERNATIONAL_STANDARD }
];

export const ServiceRateCardDialog = ({ 
  open, 
  onOpenChange, 
  carrierId, 
  serviceCode, 
  serviceName, 
  onSuccess,
  existingRateCard 
}: ServiceRateCardDialogProps) => {
  const [weightUnit, setWeightUnit] = useState<'lbs' | 'oz'>('lbs');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (existingRateCard) {
      setWeightUnit(existingRateCard.weight_unit || 'lbs');
    }
  }, [existingRateCard]);

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
    a.download = `${serviceName}-rate-card-sample.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    toast.success('Sample file downloaded');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'text/csv') {
      setCsvFile(file);
    } else {
      toast.error('Please select a CSV file');
      e.target.value = '';
    }
  };

  const parseCSVContent = (csvContent: string) => {
    const lines = csvContent.trim().split('\n');
    if (lines.length < 2) {
      throw new Error('CSV must have at least a header row and one data row');
    }

    const headerRow = lines[0].split(',');
    const zones = headerRow.slice(1); // Remove first column (Service column)
    
    if (!zones.every(zone => zone.startsWith('B'))) {
      throw new Error('Zone columns must start with B (e.g., B1, B2, B3...)');
    }

    const rates: any[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(',');
      const weight = row[0];
      
      if (!weight.startsWith('A')) {
        throw new Error('Weight rows must start with A (e.g., A2, A3, A4...)');
      }
      
      const weightValue = parseFloat(weight.substring(1));
      
      for (let j = 1; j < row.length && j <= zones.length; j++) {
        const rate = parseFloat(row[j]);
        if (!isNaN(rate)) {
          rates.push({
            weight_break: weightValue,
            zone: zones[j - 1],
            rate_amount: rate,
            service_code: serviceCode,
            service_name: serviceName
          });
        }
      }
    }
    
    return rates;
  };

  const saveServiceRateCard = async () => {
    if (!csvFile) {
      toast.error('Please select a CSV file');
      return;
    }

    setUploading(true);
    try {
      // Read CSV file
      const csvContent = await csvFile.text();
      const rates = parseCSVContent(csvContent);

      // Delete existing rates for this service
      if (existingRateCard) {
        const { error: deleteError } = await supabase
          .from('rate_card_rates')
          .delete()
          .eq('carrier_config_id', carrierId)
          .eq('service_code', serviceCode);

        if (deleteError) throw deleteError;
      }

      // Save new rate data
      const rateRecords = rates.map(rate => ({
        carrier_config_id: carrierId,
        ...rate,
        weight_unit: weightUnit
      }));

      const { error: rateError } = await supabase
        .from('rate_card_rates')
        .insert(rateRecords);

      if (rateError) throw rateError;

      toast.success(`${serviceName} rate card uploaded successfully`);
      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      console.error('Error uploading service rate card:', error);
      toast.error(error.message || 'Failed to upload rate card');
    } finally {
      setUploading(false);
    }
  };

  const deleteServiceRateCard = async () => {
    if (!confirm(`Are you sure you want to delete the ${serviceName} rate card?`)) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from('rate_card_rates')
        .delete()
        .eq('carrier_config_id', carrierId)
        .eq('service_code', serviceCode);

      if (error) throw error;

      toast.success(`${serviceName} rate card deleted successfully`);
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error deleting service rate card:', error);
      toast.error(error.message || 'Failed to delete rate card');
    } finally {
      setDeleting(false);
    }
  };

  const resetForm = () => {
    setCsvFile(null);
    setWeightUnit('lbs');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {existingRateCard ? 'Edit' : 'Add'} {serviceName} Rate Card
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="weight_unit">Weight Unit</Label>
            <Select 
              value={weightUnit} 
              onValueChange={(value: 'lbs' | 'oz') => setWeightUnit(value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lbs">Pounds (lbs)</SelectItem>
                <SelectItem value="oz">Ounces (oz)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="csv_file">Rate Card CSV *</Label>
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
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6">
              <input
                id="csv_file"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <label htmlFor="csv_file" className="cursor-pointer">
                <div className="flex flex-col items-center space-y-2">
                  {csvFile ? (
                    <>
                      <FileText className="h-8 w-8 text-success" />
                      <span className="text-sm font-medium">{csvFile.name}</span>
                      <span className="text-xs text-muted-foreground">Click to change file</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-8 w-8 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {existingRateCard ? 'Replace CSV File' : 'Upload CSV File'}
                      </span>
                      <span className="text-xs text-muted-foreground">Zones: B1-B20, Weights: A2-A200</span>
                    </>
                  )}
                </div>
              </label>
            </div>
          </div>

          <div className="flex justify-between">
            {existingRateCard && (
              <Button 
                variant="secondary" 
                onClick={deleteServiceRateCard}
                disabled={deleting}
                iconLeft={<Trash2 className="h-4 w-4" />}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button 
                variant="primary" 
                onClick={saveServiceRateCard}
                disabled={uploading}
                iconLeft={uploading ? undefined : <Upload className="h-4 w-4" />}
              >
                {uploading ? 'Uploading...' : existingRateCard ? 'Update' : 'Upload'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};