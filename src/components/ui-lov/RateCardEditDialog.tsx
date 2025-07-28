import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui-lov/Button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { Upload, Plus, Trash2, Download, Save, Eye } from 'lucide-react';
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
      // TODO: Load rate card data from database once rate_card_rates table exists
      // For now, just load the services without CSV data
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

  const saveRateCardAccount = async () => {
    if (!accountName.trim()) {
      toast.error('Please enter an account name');
      return;
    }

    setSaving(true);
    try {
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
                             <Label>Update Rate Card CSV</Label>
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
                               {card.data && (
                                 <Button
                                   type="button"
                                   variant="outline"
                                   size="sm"
                                   onClick={() => setViewingRateCard(card)}
                                   iconLeft={<Eye className="h-4 w-4" />}
                                 >
                                   View
                                 </Button>
                               )}
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
                  <table className="w-full border-collapse border border-border">
                    <tbody>
                      {viewingRateCard.data.map((row: any[], rowIndex: number) => (
                        <tr key={rowIndex} className={rowIndex === 0 ? 'bg-muted/20' : ''}>
                          {row.map((cell: any, cellIndex: number) => (
                            <td
                              key={cellIndex}
                              className={`border border-border p-2 text-sm ${
                                rowIndex === 0 || cellIndex === 0 ? 'font-medium bg-muted/10' : ''
                              }`}
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}

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
            iconLeft={<Save className="h-4 w-4" />}
          >
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};