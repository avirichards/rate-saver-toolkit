import React, { useState, useEffect } from 'react';
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
import { UNIVERSAL_SERVICES, UniversalServiceCategory } from '@/utils/universalServiceCategories';
import { Download } from 'lucide-react';

interface RateCardUploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editConfig?: any; // Rate card config to edit, if any
  preSelectedCarrierType?: string;
  preSelectedServiceCode?: string;
}

const CARRIER_TYPES = [
  { value: 'ups', label: 'UPS' },
  { value: 'fedex', label: 'FedEx' },
  { value: 'dhl', label: 'DHL' },
  { value: 'usps', label: 'USPS' },
  { value: 'amazon', label: 'Amazon' }
] as const;

export const RateCardUploadDialog: React.FC<RateCardUploadDialogProps> = ({
  isOpen,
  onClose,
  onSuccess,
  editConfig,
  preSelectedCarrierType,
  preSelectedServiceCode
}) => {
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    carrier_type: 'ups' as const,
    account_name: '',
    account_group: '',
    service_type: '' as UniversalServiceCategory | '',
    weight_unit: 'lbs' as 'lbs' | 'oz',
    dimensional_divisor: 166,
    fuel_surcharge_percent: 0,
    is_active: true
  });

  const isEditMode = !!editConfig;

  // Pre-populate form when editing or with pre-selected values
  useEffect(() => {
    if (editConfig) {
      setFormData({
        carrier_type: editConfig.carrier_type,
        account_name: editConfig.account_name || '',
        account_group: editConfig.account_group || '',
        service_type: '',
        weight_unit: editConfig.weight_unit || 'lbs',
        dimensional_divisor: editConfig.dimensional_divisor || 166,
        fuel_surcharge_percent: editConfig.fuel_surcharge_percent || 0,
        is_active: editConfig.is_active ?? true
      });

      // For rate cards, fetch service type from rate_card_rates table
      if (editConfig.is_rate_card) {
        fetchServiceTypeFromRates(editConfig.id);
      }
    } else if (preSelectedCarrierType || preSelectedServiceCode) {
      setFormData(prev => ({
        ...prev,
        carrier_type: preSelectedCarrierType as any || prev.carrier_type,
        service_type: preSelectedServiceCode as any || prev.service_type
      }));
    }
    
    // Handle editConfig with preSelectedServiceCode
    if (editConfig?.preSelectedServiceCode) {
      setFormData(prev => ({
        ...prev,
        service_type: editConfig.preSelectedServiceCode,
        carrier_type: editConfig.carrier_type,
        account_name: editConfig.account_name
      }));
    }
  }, [editConfig, preSelectedCarrierType, preSelectedServiceCode]);

  const fetchServiceTypeFromRates = async (carrierConfigId: string) => {
    try {
      const { data, error } = await supabase
        .from('rate_card_rates')
        .select('service_code')
        .eq('carrier_config_id', carrierConfigId)
        .limit(1)
        .single();

      if (!error && data?.service_code) {
        setFormData(prev => ({ ...prev, service_type: data.service_code as UniversalServiceCategory }));
      }
    } catch (error) {
      console.error('Error fetching service type from rates:', error);
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setFormData({
      carrier_type: 'ups',
      account_name: '',
      account_group: '',
      service_type: '',
      weight_unit: 'lbs',
      dimensional_divisor: 166,
      fuel_surcharge_percent: 0,
      is_active: true
    });
  };

  const parseStandardizedRateCard = async (file: File) => {
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    let rawData: any[][] = [];
    
    if (fileExtension === 'csv') {
      const csvContent = await file.text();
      const lines = csvContent.split('\n').filter(line => line.trim());
      rawData = lines.map(line => line.split(',').map(cell => cell.trim()));
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(new Uint8Array(data), { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    } else {
      throw new Error('Only CSV and Excel files are supported');
    }

    if (rawData.length < 2) {
      throw new Error('File must have at least zone headers and one weight row');
    }

    // Parse zones from row 1 (B1, C1, D1, etc.)
    const zones = [];
    for (let col = 1; col < rawData[0].length; col++) {
      const zoneValue = rawData[0][col];
      if (zoneValue !== undefined && zoneValue !== null && zoneValue !== '') {
        zones.push(String(zoneValue));
      }
    }

    if (zones.length === 0) {
      throw new Error('No zones found in row 1 (columns B, C, D, etc.)');
    }

    // Parse rates starting from row 2 (A2, B2, C2, etc.)
    const rates = [];
    for (let row = 1; row < rawData.length; row++) {
      const weightValue = rawData[row][0];
      if (weightValue === undefined || weightValue === null || weightValue === '') {
        continue;
      }

      const weight = parseFloat(String(weightValue));
      if (isNaN(weight)) {
        console.warn(`Skipping invalid weight on row ${row + 1}: ${weightValue}`);
        continue;
      }

      // Convert weight to lbs if needed
      const weightInLbs = formData.weight_unit === 'oz' ? weight / 16 : weight;

      // Parse rates for each zone
      for (let col = 1; col < rawData[row].length && col - 1 < zones.length; col++) {
        const rateValue = rawData[row][col];
        if (rateValue === undefined || rateValue === null || rateValue === '') {
          continue;
        }

        // Clean rate value (remove $ and other non-numeric characters except decimal point)
        const cleanRate = String(rateValue).replace(/[^0-9.]/g, '');
        const rate = parseFloat(cleanRate);
        
        if (isNaN(rate)) {
          console.warn(`Skipping invalid rate on row ${row + 1}, col ${col + 1}: ${rateValue}`);
          continue;
        }

        rates.push({
          service_code: formData.service_type,
          service_name: UNIVERSAL_SERVICES[formData.service_type as UniversalServiceCategory]?.displayName || formData.service_type,
          zone: zones[col - 1],
          weight_break: weightInLbs,
          rate_amount: rate
        });
      }
    }

    if (rates.length === 0) {
      throw new Error('No valid rate data found. Please check the file format.');
    }

    return rates;
  };

  const downloadSampleFile = () => {
    // Create sample data
    const sampleData = [
      ['Weight (lbs)', '2', '3', '4', '5', '6', '7', '8'], // Header row with zones
      [1, 4.38, 4.38, 4.38, 4.38, 4.38, 4.38, 4.38],
      [2, 6.95, 6.95, 6.95, 6.95, 6.95, 7.08, 7.20],
      [3, 6.95, 6.95, 6.95, 6.95, 6.95, 7.56, 7.93],
      [5, 6.95, 6.95, 6.95, 6.95, 7.18, 8.48, 9.00],
      [10, 6.95, 7.08, 6.95, 7.60, 7.86, 10.43, 11.53],
      [15, 8.09, 8.72, 8.66, 9.85, 11.36, 14.38, 15.91],
      [20, 8.71, 9.79, 9.53, 11.71, 13.64, 17.45, 19.57],
      [25, 10.28, 12.00, 12.84, 15.36, 19.03, 22.94, 26.18],
      [30, 11.56, 13.60, 15.05, 18.01, 22.49, 26.12, 30.78]
    ];

    // Create CSV content
    const csvContent = sampleData.map(row => row.join(',')).join('\n');
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rate-card-sample.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleSubmit = async () => {
    if (!formData.account_name.trim() || !formData.service_type) {
      toast.error('Please enter an account name and choose a service type');
      return;
    }

    if (!isEditMode && !selectedFile) {
      toast.error('Please select a file to upload');
      return;
    }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      if (isEditMode) {
        // Update existing rate card config
        const { error: updateError } = await supabase
          .from('carrier_configs')
          .update({
            carrier_type: formData.carrier_type,
            account_name: formData.account_name,
            account_group: formData.account_group || null,
            dimensional_divisor: formData.dimensional_divisor,
            fuel_surcharge_percent: formData.fuel_surcharge_percent,
            weight_unit: formData.weight_unit,
            is_active: formData.is_active
          })
          .eq('id', editConfig.id);

        if (updateError) throw updateError;

        toast.success('Rate card updated successfully!');
      } else {
        // Create new rate card
        // Parse the rate card file using standardized format
        const rates = await parseStandardizedRateCard(selectedFile!);

        if (rates.length === 0) {
          throw new Error('No valid rate data found in file');
        }

        // Upload file to storage
        const filePath = `${user.id}/${Date.now()}-${selectedFile!.name}`;
        const { error: uploadError } = await supabase.storage
          .from('rate-cards')
          .upload(filePath, selectedFile!);

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
            rate_card_filename: selectedFile!.name,
            rate_card_uploaded_at: new Date().toISOString(),
            dimensional_divisor: formData.dimensional_divisor,
            fuel_surcharge_percent: formData.fuel_surcharge_percent,
            weight_unit: formData.weight_unit,
            is_sandbox: false,
            is_active: formData.is_active,
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
      }

      onSuccess();
      onClose();
      resetForm();
    } catch (error: any) {
      console.error('Error with rate card:', error);
      toast.error(`Failed to ${isEditMode ? 'update' : 'upload'} rate card: ${error.message}`);
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
          <DialogTitle>{isEditMode ? 'Edit Rate Card' : 'Upload Rate Card'}</DialogTitle>
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

            <div className="space-y-2">
              <Label htmlFor="service_type">Service Type *</Label>
              <Select 
                value={formData.service_type} 
                onValueChange={(value: UniversalServiceCategory) => setFormData(prev => ({ ...prev, service_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select service type" />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(UNIVERSAL_SERVICES).map(service => (
                    <SelectItem key={service.category} value={service.category}>
                      {service.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="weight_unit">Weight Unit *</Label>
              <Select 
                value={formData.weight_unit} 
                onValueChange={(value: 'lbs' | 'oz') => setFormData(prev => ({ ...prev, weight_unit: value }))}
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

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
              />
              <Label htmlFor="is_active">Active</Label>
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
                />
              </div>
            </div>
          </div>

          {/* File Upload - Only show in add mode */}
          {!isEditMode && (
            <>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Upload Rate Card File</h3>
                  <Button variant="outline" size="sm" onClick={downloadSampleFile}>
                    <Download className="h-4 w-4 mr-1" />
                    Download Sample
                  </Button>
                </div>
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

              {/* Format Requirements */}
              <div className="bg-muted/50 p-4 rounded-lg">
                <h4 className="text-sm font-medium mb-2">Required Format:</h4>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• <strong>Row 1:</strong> Zone numbers starting in column B (B1=2, C1=3, D1=4, etc.)</li>
                  <li>• <strong>Column A:</strong> Weight values starting in A2 (1, 2, 3, 5, 10, etc.)</li>
                  <li>• <strong>Rate cells:</strong> Corresponding rates for each weight/zone combination</li>
                  <li>• <strong>Zones:</strong> Can range from 2-20 (columns B through T)</li>
                  <li>• <strong>Weights:</strong> Can go up to 200 lbs (rows 2-201)</li>
                </ul>
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={handleClose} disabled={uploading}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={uploading || (!isEditMode && !selectedFile) || !formData.service_type}>
              {uploading ? (isEditMode ? 'Updating...' : 'Uploading...') : (isEditMode ? 'Update Rate Card' : 'Upload Rate Card')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};