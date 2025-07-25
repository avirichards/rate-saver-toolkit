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
  { value: 'usps', label: 'USPS' },
  { value: 'amazon', label: 'Amazon' }
] as const;

export const RateCardUploadDialog: React.FC<RateCardUploadDialogProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [showMapping, setShowMapping] = useState(false);
  const [columnMapping, setColumnMapping] = useState({
    service_code: '',
    service_name: '',
    zone: '',
    weight_break: '',
    rate_amount: ''
  });
  const [formData, setFormData] = useState({
    carrier_type: 'ups' as const,
    account_name: '',
    account_group: '',
    service_type: '',
    dimensional_divisor: 166,
    fuel_surcharge_percent: 0
  });

  const resetForm = () => {
    setSelectedFile(null);
    setCsvHeaders([]);
    setShowMapping(false);
    setColumnMapping({
      service_code: '',
      service_name: '',
      zone: '',
      weight_break: '',
      rate_amount: ''
    });
    setFormData({
      carrier_type: 'ups',
      account_name: '',
      account_group: '',
      service_type: '',
      dimensional_divisor: 166,
      fuel_surcharge_percent: 0
    });
  };

  const parseRateCardCSV = (csvContent: string) => {
    const lines = csvContent.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim());
    
    // Set headers for mapping
    setCsvHeaders(headers);
    
    // Auto-detect common column mappings
    const autoMapping = {
      service_code: '',
      service_name: '',
      zone: '',
      weight_break: '',
      rate_amount: ''
    };
    
    headers.forEach(header => {
      const lowerHeader = header.toLowerCase();
      if (lowerHeader.includes('service') && lowerHeader.includes('code')) {
        autoMapping.service_code = header;
      } else if (lowerHeader.includes('service') && (lowerHeader.includes('name') || lowerHeader.includes('type'))) {
        autoMapping.service_name = header;
      } else if (lowerHeader.includes('zone')) {
        autoMapping.zone = header;
      } else if (lowerHeader.includes('weight') || lowerHeader.includes('lb')) {
        autoMapping.weight_break = header;
      } else if (lowerHeader.includes('rate') || lowerHeader.includes('cost') || lowerHeader.includes('price')) {
        autoMapping.rate_amount = header;
      }
    });
    
    setColumnMapping(autoMapping);
    return headers;
  };

  const parseRateCardExcel = (file: File): Promise<string[]> => {
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

          const headers = jsonData[0].map((h: any) => String(h).trim());
          
          // Set headers for mapping and auto-detect
          setCsvHeaders(headers);
          
          const autoMapping = {
            service_code: '',
            service_name: '',
            zone: '',
            weight_break: '',
            rate_amount: ''
          };
          
          headers.forEach(header => {
            const lowerHeader = header.toLowerCase();
            if (lowerHeader.includes('service') && lowerHeader.includes('code')) {
              autoMapping.service_code = header;
            } else if (lowerHeader.includes('service') && (lowerHeader.includes('name') || lowerHeader.includes('type'))) {
              autoMapping.service_name = header;
            } else if (lowerHeader.includes('zone')) {
              autoMapping.zone = header;
            } else if (lowerHeader.includes('weight') || lowerHeader.includes('lb')) {
              autoMapping.weight_break = header;
            } else if (lowerHeader.includes('rate') || lowerHeader.includes('cost') || lowerHeader.includes('price')) {
              autoMapping.rate_amount = header;
            }
          });
          
          setColumnMapping(autoMapping);
          resolve(headers);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read Excel file'));
      reader.readAsArrayBuffer(file);
    });
  };

  const handleFileSelect = async (file: File) => {
    setSelectedFile(file);
    
    try {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      
      if (fileExtension === 'csv') {
        const csvContent = await file.text();
        parseRateCardCSV(csvContent);
        setShowMapping(true);
      } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        await parseRateCardExcel(file);
        setShowMapping(true);
      } else {
        throw new Error('Only CSV and Excel files are supported');
      }
    } catch (error: any) {
      toast.error(`Error reading file: ${error.message}`);
      setSelectedFile(null);
    }
  };

  const validateMapping = () => {
    const requiredMappings = ['zone', 'weight_break', 'rate_amount'];
    const missingMappings = requiredMappings.filter(field => !columnMapping[field as keyof typeof columnMapping]);
    
    if (missingMappings.length > 0) {
      toast.error(`Please map required columns: ${missingMappings.join(', ')}`);
      return false;
    }
    return true;
  };

  const parseFileWithMapping = async () => {
    if (!selectedFile) return [];

    const fileExtension = selectedFile.name.split('.').pop()?.toLowerCase();
    let rawData: any[][] = [];
    
    if (fileExtension === 'csv') {
      const csvContent = await selectedFile.text();
      const lines = csvContent.split('\n').filter(line => line.trim());
      rawData = lines.map(line => line.split(',').map(cell => cell.trim()));
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(new Uint8Array(data), { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    }

    const headers = rawData[0];
    const rates = [];

    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row || row.length === 0) continue;

      const rate: any = {};
      
      // Map columns based on user selection
      Object.entries(columnMapping).forEach(([field, headerName]) => {
        if (headerName) {
          const columnIndex = headers.indexOf(headerName);
          if (columnIndex !== -1) {
            rate[field] = row[columnIndex];
          }
        }
      });

      // Use provided service type if no service mapping
      if (!rate.service_code && formData.service_type) {
        rate.service_code = formData.service_type;
      }
      if (!rate.service_name && formData.service_type) {
        rate.service_name = formData.service_type;
      }

      const weightBreak = parseFloat(rate.weight_break);
      const rateAmount = parseFloat(rate.rate_amount);
      
      if (isNaN(weightBreak) || isNaN(rateAmount)) {
        console.warn(`Skipping invalid rate on row ${i + 1}`);
        continue;
      }

      rates.push({
        service_code: rate.service_code || formData.service_type || 'UNKNOWN',
        service_name: rate.service_name || formData.service_type || 'UNKNOWN',
        zone: rate.zone,
        weight_break: weightBreak,
        rate_amount: rateAmount
      });
    }

    return rates;
  };

  const uploadRateCard = async () => {
    if (!selectedFile || !formData.account_name.trim()) {
      toast.error('Please select a file and enter an account name');
      return;
    }

    if (!validateMapping()) {
      return;
    }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Parse the rate card file with user mappings
      const rates = await parseFileWithMapping();

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
          is_sandbox: false,
          is_active: true,
          enabled_services: [],
          column_mappings: columnMapping
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
            <div className="space-y-2">
              <Label htmlFor="service_type">Service Type</Label>
              <Input
                id="service_type"
                value={formData.service_type}
                onChange={(e) => setFormData(prev => ({ ...prev, service_type: e.target.value }))}
                placeholder="e.g., GROUND, OVERNIGHT, etc."
              />
              <p className="text-xs text-muted-foreground">
                Used when service code/name is not in the file
              </p>
            </div>
          </div>

          {/* Column Mapping */}
          {showMapping && csvHeaders.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Column Mapping</h3>
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label>Zone Column *</Label>
                  <Select 
                    value={columnMapping.zone} 
                    onValueChange={(value) => setColumnMapping(prev => ({ ...prev, zone: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select zone column" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border shadow-lg z-50">
                      {csvHeaders.map(header => (
                        <SelectItem key={header} value={header}>{header}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Weight Break Column (lbs) *</Label>
                  <Select 
                    value={columnMapping.weight_break} 
                    onValueChange={(value) => setColumnMapping(prev => ({ ...prev, weight_break: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select weight column" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border shadow-lg z-50">
                      {csvHeaders.map(header => (
                        <SelectItem key={header} value={header}>{header}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Rate Amount Column *</Label>
                  <Select 
                    value={columnMapping.rate_amount} 
                    onValueChange={(value) => setColumnMapping(prev => ({ ...prev, rate_amount: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select rate column" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border shadow-lg z-50">
                      {csvHeaders.map(header => (
                        <SelectItem key={header} value={header}>{header}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Service Code Column (optional)</Label>
                  <Select 
                    value={columnMapping.service_code} 
                    onValueChange={(value) => setColumnMapping(prev => ({ ...prev, service_code: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select service code column" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border shadow-lg z-50">
                      <SelectItem value="">None - Use service type above</SelectItem>
                      {csvHeaders.map(header => (
                        <SelectItem key={header} value={header}>{header}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Service Name Column (optional)</Label>
                  <Select 
                    value={columnMapping.service_name} 
                    onValueChange={(value) => setColumnMapping(prev => ({ ...prev, service_name: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select service name column" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border shadow-lg z-50">
                      <SelectItem value="">None - Use service type above</SelectItem>
                      {csvHeaders.map(header => (
                        <SelectItem key={header} value={header}>{header}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
            
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

          {/* File Upload */}
          {!showMapping && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Upload Rate Card File</h3>
              <FileUpload
                accept=".csv,.xlsx,.xls"
                maxFileSizeMB={10}
                onFileSelect={handleFileSelect}
                acceptedFileTypes={['csv', 'xlsx', 'xls']}
                className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6"
              />
              {selectedFile && (
                <p className="text-sm text-muted-foreground">
                  Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>
          )}

          {/* Help Text */}
          {!showMapping && (
            <div className="bg-muted/50 p-4 rounded-lg">
              <h4 className="text-sm font-medium mb-2">Rate Card Format Requirements:</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• CSV or Excel file with headers</li>
                <li>• Must contain columns for: zone, weight breaks (lbs), and rate amounts</li>
                <li>• Optional: service code and service name columns</li>
                <li>• You'll be able to map columns after uploading the file</li>
              </ul>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={handleClose} disabled={uploading}>
              Cancel
            </Button>
            {showMapping && !uploading && (
              <Button variant="outline" onClick={() => { setShowMapping(false); setSelectedFile(null); }}>
                Change File
              </Button>
            )}
            <Button onClick={uploadRateCard} disabled={uploading || !selectedFile || (showMapping && !validateMapping())}>
              {uploading ? 'Uploading...' : 'Upload Rate Card'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};