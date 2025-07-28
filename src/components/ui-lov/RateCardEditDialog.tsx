import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui-lov/Button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { Upload, Plus, Trash2, Download, Save, Eye, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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

interface RateCardEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: any;
  onSuccess?: () => void;
}

const CARRIER_TYPES = [
  { value: 'ups', label: 'UPS', icon: '📦' },
  { value: 'fedex', label: 'FedEx', icon: '🚚' },
  { value: 'dhl', label: 'DHL', icon: '✈️' },
  { value: 'usps', label: 'USPS', icon: '📮' },
  { value: 'amazon', label: 'Amazon', icon: '📋' }
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
  ],
  amazon: [
    { code: 'GROUND', name: 'Amazon Ground' }
  ]
};

export const RateCardEditDialog: React.FC<RateCardEditDialogProps> = ({
  open,
  onOpenChange,
  account,
  onSuccess
}) => {
  const [accountName, setAccountName] = useState('');
  const [accountGroup, setAccountGroup] = useState('');
  const [dimensionalDivisor, setDimensionalDivisor] = useState('166');
  const [fuelSurcharge, setFuelSurcharge] = useState('0');
  const [rateCards, setRateCards] = useState<RateCard[]>([]);
  const [saving, setSaving] = useState(false);
  const [viewingRateCard, setViewingRateCard] = useState<RateCard | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (account && open) {
      setAccountName(account.account_name || '');
      setAccountGroup(account.account_group || '');
      setDimensionalDivisor(account.dimensional_divisor?.toString() || '166');
      setFuelSurcharge(account.fuel_surcharge_percent?.toString() || '0');
      
      // Load existing rate cards from enabled services and database
      loadExistingRateCards();
    }
  }, [account, open]);

  const loadExistingRateCards = async () => {
    if (!account) return;

    try {
      // Load rate card data from database
      const { data: rateCardData } = await supabase
        .from('rate_card_rates')
        .select('*')
        .eq('carrier_config_id', account.id);

      // Group by service code
      const serviceGroups = rateCardData?.reduce((acc, rate) => {
        if (!acc[rate.service_code]) {
          acc[rate.service_code] = [];
        }
        acc[rate.service_code].push(rate);
        return acc;
      }, {} as Record<string, any[]>) || {};

      const existingCards: RateCard[] = (account.enabled_services || []).map((serviceCode: string) => {
        const service = SERVICE_TYPES[account.carrier_type as keyof typeof SERVICE_TYPES]?.find(s => s.code === serviceCode);
        const rates = serviceGroups[serviceCode] || [];
        
        // Convert rates back to CSV format if they exist
        let csvData = null;
        let fileName = '';
        if (rates.length > 0) {
          fileName = `${serviceCode}_rates.csv`;
          // Convert database rates to CSV format
          const zones = [...new Set(rates.map(r => r.zone))].sort();
          const weights = [...new Set(rates.map(r => r.weight_break))].sort((a, b) => a - b);
          
          csvData = [
            ['Weight', ...zones],
            ...weights.map(weight => [
              weight,
              ...zones.map(zone => {
                const rate = rates.find(r => r.weight_break === weight && r.zone === zone);
                return rate ? rate.rate_amount : '';
              })
            ])
          ];
        }

        return {
          id: serviceCode,
          serviceCode: serviceCode,
          serviceName: service?.name || serviceCode,
          weightUnit: account.weight_unit || 'lbs',
          file: null,
          fileName: fileName,
          data: csvData
        };
      });
      setRateCards(existingCards);
    } catch (error) {
      console.error('Error loading rate cards:', error);
      // Fallback to just loading services without data
      const existingCards: RateCard[] = (account.enabled_services || []).map((serviceCode: string) => {
        const service = SERVICE_TYPES[account.carrier_type as keyof typeof SERVICE_TYPES]?.find(s => s.code === serviceCode);
        return {
          id: serviceCode,
          serviceCode: serviceCode,
          serviceName: service?.name || serviceCode,
          weightUnit: account.weight_unit || 'lbs',
          file: null,
          fileName: '',
          data: null
        };
      });
      setRateCards(existingCards);
    }
  };

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
      
      updateRateCard(id, {
        file,
        fileName: file.name,
        data: jsonData
      });
      
      toast.success('Rate card updated successfully');
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Failed to upload rate card');
    }
  };

  const deleteAccount = async () => {
    if (!confirm(`Are you sure you want to delete the account "${accountName}"? This action cannot be undone.`)) {
      return;
    }

    setDeleting(true);
    try {
      // Delete the carrier config (this will cascade delete rate card rates due to foreign key)
      const { error: deleteError } = await supabase
        .from('carrier_configs')
        .delete()
        .eq('id', account.id);

      if (deleteError) throw deleteError;

      toast.success('Rate card account deleted successfully');
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Error deleting rate card account:', error);
      toast.error('Failed to delete rate card account: ' + error.message);
    } finally {
      setDeleting(false);
    }
  };

  const saveRateCardAccount = async () => {
    if (!accountName.trim()) {
      toast.error('Please enter an account name');
      return;
    }

    setSaving(true);
    try {
      // Save rate card data to database first
      for (const card of rateCards) {
        if (card.data && card.serviceCode) {
          // Delete existing rates for this service
          await supabase
            .from('rate_card_rates')
            .delete()
            .eq('carrier_config_id', account.id)
            .eq('service_code', card.serviceCode);

          // Insert new rates
          const rateCardRates = [];
          const zones = card.data[0].slice(1); // Get zone headers
          for (let rowIndex = 1; rowIndex < card.data.length; rowIndex++) {
            const row = card.data[rowIndex];
            const weightBreak = parseFloat(row[0]);
            if (isNaN(weightBreak)) continue;

            for (let colIndex = 1; colIndex < row.length && colIndex <= zones.length; colIndex++) {
              const rate = parseFloat(row[colIndex]);
              if (isNaN(rate)) continue;

              rateCardRates.push({
                carrier_config_id: account.id,
                service_code: card.serviceCode,
                service_name: card.serviceName,
                weight_break: weightBreak,
                weight_unit: card.weightUnit,
                zone: zones[colIndex - 1]?.toString(),
                rate_amount: rate
              });
            }
          }

          if (rateCardRates.length > 0) {
            const { error: ratesError } = await supabase
              .from('rate_card_rates')
              .insert(rateCardRates);

            if (ratesError) throw ratesError;
          }
        }
      }

      // Update the carrier config
      const { error: configError } = await supabase
        .from('carrier_configs')
        .update({
          account_name: accountName.trim(),
          account_group: accountGroup || null,
          dimensional_divisor: parseFloat(dimensionalDivisor),
          fuel_surcharge_percent: parseFloat(fuelSurcharge),
          enabled_services: rateCards.map(card => card.serviceCode).filter(code => code),
          updated_at: new Date().toISOString()
        })
        .eq('id', account.id);

      if (configError) throw configError;

      toast.success('Rate card account updated successfully');
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Error updating rate card account:', error);
      toast.error('Failed to update rate card account: ' + error.message);
    } finally {
      setSaving(false);
    }
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

  if (!account?.is_rate_card) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Rate Card Account</DialogTitle>
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
                  <Label>Carrier Type</Label>
                  <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/20">
                    <span>{CARRIER_TYPES.find(c => c.value === account.carrier_type)?.icon}</span>
                    <span>{CARRIER_TYPES.find(c => c.value === account.carrier_type)?.label}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="account-name">Account Name *</Label>
                  <Input
                    id="account-name"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
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
                  Add New Rate Card
                </Button>
              </div>
            </CardHeader>
            <CardContent>
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
                                const service = SERVICE_TYPES[account.carrier_type as keyof typeof SERVICE_TYPES]?.find(s => s.code === value);
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
                                {SERVICE_TYPES[account.carrier_type as keyof typeof SERVICE_TYPES]?.map(service => (
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
                             <Label>Rate Card CSV</Label>
                             {card.data && card.fileName ? (
                               <div className="flex items-center gap-2">
                                 <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/5 flex-1">
                                   <FileText className="h-4 w-4 text-muted-foreground" />
                                   <span className="text-sm">{card.fileName}</span>
                                 </div>
                                 <Button
                                   type="button"
                                   variant="outline"
                                   size="sm"
                                   onClick={() => setViewingRateCard(card)}
                                   iconLeft={<Eye className="h-4 w-4" />}
                                 >
                                   View
                                 </Button>
                               </div>
                             ) : (
                               <Input
                                 type="file"
                                 accept=".csv,.xlsx,.xls"
                                 onChange={(e) => {
                                   const file = e.target.files?.[0];
                                   if (file) handleFileUpload(card.id, file);
                                 }}
                               />
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

        {/* CSV Viewer Modal */}
        {viewingRateCard && (
          <Dialog open={!!viewingRateCard} onOpenChange={() => setViewingRateCard(null)}>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Rate Card Data - {viewingRateCard.serviceName}</DialogTitle>
              </DialogHeader>
              <div className="overflow-x-auto">
                {viewingRateCard.data && (
                  <div className="space-y-4">
                    <div className="text-sm text-muted-foreground">
                      Showing rates for {viewingRateCard.serviceName} ({viewingRateCard.weightUnit})
                    </div>
                    <table className="w-full border-collapse border border-border">
                      <thead>
                        <tr className="bg-muted/20">
                          <th className="border border-border p-2 text-sm font-medium text-left">
                            Weight ({viewingRateCard.weightUnit})
                          </th>
                          {viewingRateCard.data[0].slice(1).map((zone: any, index: number) => (
                            <th key={index} className="border border-border p-2 text-sm font-medium text-center">
                              Zone {zone}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {viewingRateCard.data.slice(1).map((row: any[], rowIndex: number) => (
                          <tr key={rowIndex} className="hover:bg-muted/10">
                            <td className="border border-border p-2 text-sm font-medium bg-muted/5">
                              {row[0]}
                            </td>
                            {row.slice(1).map((rate: any, cellIndex: number) => (
                              <td key={cellIndex} className="border border-border p-2 text-sm text-center">
                                ${parseFloat(rate).toFixed(2)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}

        <div className="flex justify-between gap-2 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={deleteAccount}
            loading={deleting}
            iconLeft={<Trash2 className="h-4 w-4" />}
            className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
          >
            Delete Account
          </Button>
          
          <div className="flex gap-2">
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
              iconLeft={<Save className="h-4 w-4" />}
            >
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};