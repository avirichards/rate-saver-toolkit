import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui-lov/Button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { FileUpload } from '@/components/ui-lov/FileUpload';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

interface RateCardUploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CARRIER_TYPES = [
  { value: 'ups', label: 'UPS' },
  { value: 'fedex', label: 'FedEx' },
  { value: 'dhl', label: 'DHL' },
  { value: 'usps', label: 'USPS' }
] as const;

export const RateCardUploadDialog: React.FC<RateCardUploadDialogProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    carrier_type: 'ups' as const,
    account_name: '',
    account_group: '',
    dimensional_divisor: 166,
    fuel_surcharge_percent: 0,
    fuel_auto_lookup: false,
    is_sandbox: false
  });

  const resetForm = () => {
    setSelectedFile(null);
    setFormData({
      carrier_type: 'ups',
      account_name: '',
      account_group: '',
      dimensional_divisor: 166,
      fuel_surcharge_percent: 0,
      fuel_auto_lookup: false,
      is_sandbox: false
    });
  };

  const parseRateCardCSV = (csvContent: string) => {
    const lines = csvContent.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    
    // Expected columns: service_code, service_name, zone, weight_break, rate_amount
    const requiredColumns = ['service_code', 'zone', 'weight_break', 'rate_amount'];
    const missingColumns = requiredColumns.filter(col => !headers.includes(col));
    
    if (missingColumns.length > 0) {
      throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
    }

    const rates = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      if (values.length < headers.length) continue;

      const rate: any = {};
      headers.forEach((header, index) => {
        rate[header] = values[index];
      });

      // Validate and convert numeric fields
      const weightBreak = parseFloat(rate.weight_break);
      const rateAmount = parseFloat(rate.rate_amount);
      
      if (isNaN(weightBreak) || isNaN(rateAmount)) {
        console.warn(`Skipping invalid rate on line ${i + 1}: weight_break=${rate.weight_break}, rate_amount=${rate.rate_amount}`);
        continue;
      }

      rates.push({
        service_code: rate.service_code,
        service_name: rate.service_name || rate.service_code,
        zone: rate.zone,
        weight_break: weightBreak,
        rate_amount: rateAmount
      });
    }

    return rates;
  };

  const parseRateCardExcel = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
          
          if (jsonData.length < 2) {
            throw new Error('Excel file must have at least a header row and one data row');
          }

          const headers = jsonData[0].map((h: any) => String(h).trim().toLowerCase());
          const requiredColumns = ['service_code', 'zone', 'weight_break', 'rate_amount'];
          const missingColumns = requiredColumns.filter(col => !headers.includes(col));
          
          if (missingColumns.length > 0) {
            throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
          }

          const rates = [];
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row || row.length === 0) continue;

            const rate: any = {};
            headers.forEach((header, index) => {
              rate[header] = row[index];
            });

            const weightBreak = parseFloat(rate.weight_break);
            const rateAmount = parseFloat(rate.rate_amount);
            
            if (isNaN(weightBreak) || isNaN(rateAmount)) {
              console.warn(`Skipping invalid rate on row ${i + 1}`);
              continue;
            }

            rates.push({
              service_code: rate.service_code,
              service_name: rate.service_name || rate.service_code,
              zone: rate.zone,
              weight_break: weightBreak,
              rate_amount: rateAmount
            });
          }

          resolve(rates);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read Excel file'));
      reader.readAsArrayBuffer(file);
    });
  };

  const uploadRateCard = async () => {
    if (!selectedFile || !formData.account_name.trim()) {
      toast.error('Please select a file and enter an account name');
      return;
    }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Parse the rate card file
      let rates: any[];
      const fileExtension = selectedFile.name.split('.').pop()?.toLowerCase();
      
      if (fileExtension === 'csv') {
        const csvContent = await selectedFile.text();
        rates = parseRateCardCSV(csvContent);
      } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        rates = await parseRateCardExcel(selectedFile);
      } else {
        throw new Error('Only CSV and Excel files are supported');
      }

      if (rates.length === 0) {
        throw new Error('No valid rate data found in file');
      }

      // Upload file to storage
      const filePath = `${user.id}/${Date.now()}-${selectedFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from('rate-cards')
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      // Create carrier config record
      const { data: carrierConfig, error: configError } = await supabase
        .from('carrier_configs')
        .insert({
          user_id: user.id,
          carrier_type: formData.carrier_type,
          account_name: formData.account_name,
          account_group: formData.account_group || null,
          is_rate_card: true,
          rate_card_filename: selectedFile.name,
          rate_card_uploaded_at: new Date().toISOString(),
          dimensional_divisor: formData.dimensional_divisor,
          fuel_surcharge_percent: formData.fuel_surcharge_percent,
          fuel_auto_lookup: formData.fuel_auto_lookup,
          is_sandbox: formData.is_sandbox,
          is_active: true,
          enabled_services: []
        })
        .select()
        .single();

      if (configError) throw configError;

      // Insert rate data
      const rateRecords = rates.map(rate => ({
        carrier_config_id: carrierConfig.id,
        service_code: rate.service_code,
        service_name: rate.service_name,
        zone: rate.zone,
        weight_break: rate.weight_break,
        rate_amount: rate.rate_amount
      }));

      const { error: rateError } = await supabase
        .from('rate_card_rates')
        .insert(rateRecords);

      if (rateError) throw rateError;

      toast.success(`Rate card uploaded successfully! ${rates.length} rates imported.`);
      onSuccess();
      onClose();
      resetForm();
    } catch (error: any) {
      console.error('Error uploading rate card:', error);
      toast.error(`Failed to upload rate card: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    if (!uploading) {
      onClose();
      resetForm();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Rate Card</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="carrier_type">Carrier Type *</Label>
              <Select 
                value={formData.carrier_type} 
                onValueChange={(value: any) => setFormData(prev => ({ ...prev, carrier_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CARRIER_TYPES.map(carrier => (
                    <SelectItem key={carrier.value} value={carrier.value}>
                      {carrier.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="account_name">Rate Card Name *</Label>
              <Input
                id="account_name"
                value={formData.account_name}
                onChange={(e) => setFormData(prev => ({ ...prev, account_name: e.target.value }))}
                placeholder="Enter a name for this rate card"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="account_group">Account Group</Label>
              <Input
                id="account_group"
                value={formData.account_group}
                onChange={(e) => setFormData(prev => ({ ...prev, account_group: e.target.value }))}
                placeholder="Optional group name"
              />
            </div>
          </div>

          {/* Rate Card Configuration */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Rate Card Configuration</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dimensional_divisor">Dimensional Divisor</Label>
                <Input
                  id="dimensional_divisor"
                  type="number"
                  value={formData.dimensional_divisor}
                  onChange={(e) => setFormData(prev => ({ ...prev, dimensional_divisor: parseFloat(e.target.value) || 166 }))}
                  placeholder="166"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fuel_surcharge">Fuel Surcharge (%)</Label>
                <Input
                  id="fuel_surcharge"
                  type="number"
                  step="0.1"
                  value={formData.fuel_surcharge_percent}
                  onChange={(e) => setFormData(prev => ({ ...prev, fuel_surcharge_percent: parseFloat(e.target.value) || 0 }))}
                  placeholder="0"
                  disabled={formData.fuel_auto_lookup}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="fuel_auto_lookup"
                checked={formData.fuel_auto_lookup}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, fuel_auto_lookup: checked }))}
              />
              <Label htmlFor="fuel_auto_lookup">Auto-lookup fuel surcharge</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_sandbox"
                checked={formData.is_sandbox}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_sandbox: checked }))}
              />
              <Label htmlFor="is_sandbox">Test/Sandbox rates</Label>
            </div>
          </div>

          {/* File Upload */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Upload Rate Card File</h3>
            <FileUpload
              accept=".csv,.xlsx,.xls"
              maxFileSizeMB={10}
              onFileSelect={setSelectedFile}
              acceptedFileTypes={['csv', 'xlsx', 'xls']}
              className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6"
            />
            {selectedFile && (
              <p className="text-sm text-muted-foreground">
                Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          {/* Help Text */}
          <div className="bg-muted/50 p-4 rounded-lg">
            <h4 className="text-sm font-medium mb-2">Rate Card Format Requirements:</h4>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• CSV or Excel file with headers</li>
              <li>• Required columns: service_code, zone, weight_break, rate_amount</li>
              <li>• Optional columns: service_name</li>
              <li>• Example: service_code=GND, zone=2, weight_break=1, rate_amount=10.50</li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={handleClose} disabled={uploading}>
              Cancel
            </Button>
            <Button onClick={uploadRateCard} disabled={uploading || !selectedFile}>
              {uploading ? 'Uploading...' : 'Upload Rate Card'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};