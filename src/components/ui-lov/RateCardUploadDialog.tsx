import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui-lov/Button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { Upload, Plus, Trash2, Download, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CarrierGroupCombobox } from './CarrierGroupCombobox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

interface RateCard {
  id: string;
  serviceCode: string;
  serviceName: string;
  weightUnit: 'lbs' | 'oz';
  file: File | null;
  fileName: string;
  data: any[][] | null;
}

interface RateCardUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const CARRIER_TYPES = [
  { value: 'ups', label: 'UPS', icon: '📦' },
  { value: 'fedex', label: 'FedEx', icon: '🚚' },
  { value: 'dhl', label: 'DHL', icon: '✈️' },
  { value: 'usps', label: 'USPS', icon: '📮' }
] as const;

const SERVICE_TYPES = {
  ups: [
    { code: '03', name: 'UPS Ground' },
    { code: '12', name: 'UPS 3 Day Select' },
    { code: '02', name: 'UPS 2nd Day Air' },
    { code: '59', name: 'UPS 2nd Day Air A.M.' },
    { code: '01', name: 'UPS Next Day Air' },
    { code: '14', name: 'UPS Next Day Air Early' },
    { code: '13', name: 'UPS Next Day Air Saver' }
  ],
  fedex: [
    { code: 'FEDEX_GROUND', name: 'FedEx Ground' },
    { code: 'FEDEX_EXPRESS_SAVER', name: 'FedEx Express Saver' },
    { code: 'FEDEX_2_DAY', name: 'FedEx 2Day' },
    { code: 'FEDEX_2_DAY_AM', name: 'FedEx 2Day A.M.' },
    { code: 'STANDARD_OVERNIGHT', name: 'FedEx Standard Overnight' },
    { code: 'PRIORITY_OVERNIGHT', name: 'FedEx Priority Overnight' },
    { code: 'FIRST_OVERNIGHT', name: 'FedEx First Overnight' }
  ],
  dhl: [
    { code: 'N', name: 'DHL Next Afternoon' },
    { code: 'S', name: 'DHL Second Day Service' },
    { code: 'G', name: 'DHL Ground' }
  ],
  usps: [
    { code: 'GROUND_ADVANTAGE', name: 'USPS Ground Advantage' },
    { code: 'PRIORITY', name: 'USPS Priority Mail' },
    { code: 'PRIORITY_EXPRESS', name: 'USPS Priority Mail Express' }
  ]
};

export const RateCardUploadDialog: React.FC<RateCardUploadDialogProps> = ({
  open,
  onOpenChange,
  onSuccess
}) => {
  const [carrierType, setCarrierType] = useState<'ups' | 'fedex' | 'dhl' | 'usps'>('ups');
  const [accountName, setAccountName] = useState('');
  const [accountGroup, setAccountGroup] = useState('');
  const [dimensionalDivisor, setDimensionalDivisor] = useState('166');
  const [fuelSurcharge, setFuelSurcharge] = useState('0');
  const [rateCards, setRateCards] = useState<RateCard[]>([]);
  const [saving, setSaving] = useState(false);

  const addNewRateCard = () => {
    const newRateCard: RateCard = {
      id: Math.random().toString(36).substr(2, 9),
      serviceCode: '',
      serviceName: '',
      weightUnit: 'lbs',
      file: null,
      fileName: '',
      data: null
    };
    setRateCards([...rateCards, newRateCard]);
  };

  const removeRateCard = (id: string) => {
    setRateCards(rateCards.filter(card => card.id !== id));
  };

  const updateRateCard = (id: string, updates: Partial<RateCard>) => {
    setRateCards(rateCards.map(card => 
      card.id === id ? { ...card, ...updates } : card
    ));
  };

  const handleFileUpload = async (id: string, file: File) => {
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
      
      // Validate CSV format
      if (!validateRateCardFormat(jsonData)) {
        toast.error('Invalid rate card format. Please check the format requirements.');
        return;
      }

      updateRateCard(id, {
        file,
        fileName: file.name,
        data: jsonData
      });
      
      toast.success('Rate card uploaded successfully');
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Failed to upload rate card');
    }
  };

  const validateRateCardFormat = (data: any[][]): boolean => {
    if (!data || data.length < 2) return false;
    
    // Check if first column contains weight breaks
    for (let i = 1; i < Math.min(data.length, 10); i++) {
      if (!data[i] || !data[i][0] || isNaN(Number(data[i][0]))) {
        return false;
      }
    }
    
    // Check if header row contains zone numbers
    const headerRow = data[0];
    if (!headerRow || headerRow.length < 2) return false;
    
    for (let i = 1; i < headerRow.length; i++) {
      if (!headerRow[i] || isNaN(Number(headerRow[i]))) {
        return false;
      }
    }
    
    return true;
  };

  const saveRateCardAccount = async () => {
    if (!accountName.trim()) {
      toast.error('Please enter an account name');
      return;
    }

    if (rateCards.length === 0) {
      toast.error('Please upload at least one rate card');
      return;
    }

    const incompleteCards = rateCards.filter(card => !card.serviceCode || !card.file);
    if (incompleteCards.length > 0) {
      toast.error('Please complete all rate card entries');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Check for duplicate account name
      const { data: existingAccount } = await supabase
        .from('carrier_configs')
        .select('id')
        .eq('user_id', user.id)
        .eq('account_name', accountName.trim())
        .single();

      if (existingAccount) {
        toast.error('An account with this name already exists. Please choose a different account name.');
        return;
      }

      // Create the main carrier config
      const { data: carrierConfig, error: configError } = await supabase
        .from('carrier_configs')
        .insert({
          user_id: user.id,
          carrier_type: carrierType,
          account_name: accountName.trim(),
          account_group: accountGroup || null,
          is_rate_card: true,
          dimensional_divisor: parseFloat(dimensionalDivisor),
          fuel_surcharge_percent: parseFloat(fuelSurcharge),
          weight_unit: 'lbs',
          is_active: true,
          is_sandbox: false,
          enabled_services: rateCards.map(card => card.serviceCode),
          rate_card_uploaded_at: new Date().toISOString()
        })
        .select()
        .single();

      if (configError) throw configError;

      // Save each rate card's data
      const rateCardRates = [];
      for (const card of rateCards) {
        if (card.data) {
          const zones = card.data[0].slice(1); // Get zone headers
          for (let rowIndex = 1; rowIndex < card.data.length; rowIndex++) {
            const row = card.data[rowIndex];
            const weightBreak = parseFloat(row[0]);
            if (isNaN(weightBreak)) continue;

            for (let colIndex = 1; colIndex < row.length && colIndex <= zones.length; colIndex++) {
              const rate = parseFloat(row[colIndex]);
              if (isNaN(rate)) continue;

              rateCardRates.push({
                carrier_config_id: carrierConfig.id,
                service_code: card.serviceCode,
                service_name: card.serviceName,
                weight_break: weightBreak,
                weight_unit: card.weightUnit,
                zone: zones[colIndex - 1]?.toString(),
                rate_amount: rate
              });
            }
          }
        }
      }

      // Note: We would save to rate_card_rates table here, but it's not in the types yet
      // This will be handled when the database migration is approved
      console.log('Rate card rates to save:', rateCardRates.length);

      toast.success('Rate card account created successfully');
      onOpenChange(false);
      resetForm();
      onSuccess?.();
    } catch (error: any) {
      console.error('Error saving rate card account:', error);
      toast.error('Failed to save rate card account: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setCarrierType('ups');
    setAccountName('');
    setAccountGroup('');
    setDimensionalDivisor('166');
    setFuelSurcharge('0');
    setRateCards([]);
  };

  const downloadSampleCSV = () => {
    const sampleData = [
      ['Weight', '2', '3', '4', '5', '6', '7', '8'],
      [1, 4.38, 4.38, 4.38, 4.38, 4.38, 4.38, 4.38],
      [2, 6.95, 6.95, 6.95, 6.95, 6.95, 7.08, 7.20],
      [3, 6.95, 6.95, 6.95, 6.95, 6.95, 7.56, 7.93],
      [4, 6.95, 6.95, 6.95, 6.95, 6.95, 8.11, 8.48],
      [5, 6.95, 6.95, 6.95, 6.95, 7.18, 8.48, 9.00]
    ];

    const ws = XLSX.utils.aoa_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rate Card');
    XLSX.writeFile(wb, 'sample-rate-card.xlsx');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Rate Card Account</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Account Details */}
          <Card>
            <CardHeader>
              <CardTitle>Account Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="carrier-type">Carrier Type *</Label>
                  <Select value={carrierType} onValueChange={(value: any) => setCarrierType(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CARRIER_TYPES.map(carrier => (
                        <SelectItem key={carrier.value} value={carrier.value}>
                          <div className="flex items-center gap-2">
                            <span>{carrier.icon}</span>
                            <span>{carrier.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="account-name">Account Name *</Label>
                  <Input
                    id="account-name"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="e.g., DHL 2025"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="account-group">Account Group</Label>
                <CarrierGroupCombobox
                  value={accountGroup}
                  onValueChange={setAccountGroup}
                  placeholder="Select or create group"
                />
              </div>
            </CardContent>
          </Card>

          {/* Account Services */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Account Services</CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addNewRateCard}
                  iconLeft={<Plus className="h-4 w-4" />}
                >
                  Upload New Rate Card
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {rateCards.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No rate cards added yet. Click "Upload New Rate Card" to get started.
                </div>
              ) : (
                <div className="space-y-4">
                  {rateCards.map((card) => (
                    <Card key={card.id} className="border-muted">
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <Label>Service Type *</Label>
                              <Select
                                value={card.serviceCode}
                                onValueChange={(value) => {
                                  const service = SERVICE_TYPES[carrierType].find(s => s.code === value);
                                  updateRateCard(card.id, {
                                    serviceCode: value,
                                    serviceName: service?.name || ''
                                  });
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select service" />
                                </SelectTrigger>
                                <SelectContent>
                                  {SERVICE_TYPES[carrierType].map(service => (
                                    <SelectItem key={service.code} value={service.code}>
                                      {service.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              <Label>Weight Unit</Label>
                              <Select
                                value={card.weightUnit}
                                onValueChange={(value: 'lbs' | 'oz') => updateRateCard(card.id, { weightUnit: value })}
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
                              <Label>Rate Card CSV *</Label>
                              <div className="flex gap-2">
                                <Input
                                  type="file"
                                  accept=".csv,.xlsx,.xls"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleFileUpload(card.id, file);
                                  }}
                                  className="flex-1"
                                />
                              </div>
                              {card.fileName && (
                                <Badge variant="outline" className="text-xs">
                                  {card.fileName}
                                </Badge>
                              )}
                            </div>
                          </div>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeRateCard(card.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Rate Card Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Rate Card Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dimensional-divisor">Dimensional Divisor</Label>
                  <Input
                    id="dimensional-divisor"
                    type="number"
                    value={dimensionalDivisor}
                    onChange={(e) => setDimensionalDivisor(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fuel-surcharge">Fuel Surcharge (%)</Label>
                  <Input
                    id="fuel-surcharge"
                    type="number"
                    value={fuelSurcharge}
                    onChange={(e) => setFuelSurcharge(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Required Format */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Required Format</CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={downloadSampleCSV}
                  iconLeft={<Download className="h-4 w-4" />}
                >
                  Download Sample CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-muted/20 p-4 rounded-lg space-y-2 text-sm">
                <p className="font-medium text-muted-foreground">CSV files must follow this format:</p>
                <ul className="space-y-1 text-muted-foreground ml-4">
                  <li>• First column: Weight breaks (A2, A3, A4, etc.)</li>
                  <li>• Remaining columns: Zone rates (B1, B2, B3, etc.)</li>
                  <li>• Numeric values only for rates</li>
                  <li>• Maximum zones: B1-B20</li>
                  <li>• Maximum weight breaks: A2-A200</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={saveRateCardAccount}
            loading={saving}
            iconLeft={<Upload className="h-4 w-4" />}
          >
            Upload Rate Cards
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};