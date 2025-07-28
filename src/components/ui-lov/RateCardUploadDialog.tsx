import React, { useState } from 'react';
import { Button } from '@/components/ui-lov/Button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CarrierGroupCombobox } from './CarrierGroupCombobox';
import { RateCardEntry, RateCardData } from './RateCardEntry';

interface RateCardUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const CARRIER_TYPES = [
  { value: 'ups', label: 'UPS', icon: '📦' },
  { value: 'fedex', label: 'FedEx', icon: '🚚' },
  { value: 'dhl', label: 'DHL', icon: '✈️' },
  { value: 'usps', label: 'USPS', icon: '📮' }
] as const;

export const RateCardUploadDialog = ({ open, onOpenChange, onSuccess }: RateCardUploadDialogProps) => {
  const [accountDetails, setAccountDetails] = useState({
    carrier_type: 'ups' as 'ups' | 'fedex' | 'dhl' | 'usps',
    account_name: '',
    account_group: '',
    dimensional_divisor: '166',
    fuel_surcharge_percent: '0'
  });
  const [rateCards, setRateCards] = useState<RateCardData[]>([]);
  const [uploading, setUploading] = useState(false);

  const addRateCard = () => {
    const newRateCard: RateCardData = {
      id: `rate-card-${Date.now()}`,
      service_type: '',
      weight_unit: 'lbs',
      csv_file: null,
      service_name: ''
    };
    setRateCards([...rateCards, newRateCard]);
  };

  const updateRateCard = (id: string, updates: Partial<RateCardData>) => {
    setRateCards(prev => prev.map(card => 
      card.id === id ? { ...card, ...updates } : card
    ));
  };

  const deleteRateCard = (id: string) => {
    setRateCards(prev => prev.filter(card => card.id !== id));
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
            service_code: 'GROUND', // Default service, will be updated when services are added
            service_name: 'Ground'
          });
        }
      }
    }
    
    return rates;
  };

  const saveRateCard = async () => {
    if (!accountDetails.account_name.trim()) {
      toast.error('Please enter an account name');
      return;
    }

    if (rateCards.length === 0) {
      toast.error('Please add at least one rate card');
      return;
    }

    // Validate rate cards
    for (const card of rateCards) {
      if (!card.service_type) {
        toast.error('Please select a service type for all rate cards');
        return;
      }
      if (!card.csv_file) {
        toast.error('Please upload a CSV file for all rate cards');
        return;
      }
    }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Check if account name already exists for this user
      const { data: existingConfig } = await supabase
        .from('carrier_configs')
        .select('id')
        .eq('user_id', user.id)
        .eq('account_name', accountDetails.account_name.trim())
        .maybeSingle();

      if (existingConfig) {
        toast.error('An account with this name already exists. Please choose a different account name.');
        setUploading(false);
        return;
      }

      // Create carrier config
      const carrierConfigData = {
        user_id: user.id,
        carrier_type: accountDetails.carrier_type,
        account_name: accountDetails.account_name,
        account_group: accountDetails.account_group || null,
        is_rate_card: true,
        is_active: true,
        is_sandbox: false,
        dimensional_divisor: parseFloat(accountDetails.dimensional_divisor),
        fuel_surcharge_percent: parseFloat(accountDetails.fuel_surcharge_percent),
        rate_card_filename: rateCards.map(c => c.csv_file?.name).join(', '),
        rate_card_uploaded_at: new Date().toISOString(),
        enabled_services: rateCards.map(c => c.service_type.toUpperCase())
      };

      const { data: configData, error: configError } = await supabase
        .from('carrier_configs')
        .insert(carrierConfigData)
        .select('id')
        .single();

      if (configError) throw configError;

      // Process each rate card
      for (const rateCard of rateCards) {
        if (!rateCard.csv_file) continue;
        
        const csvContent = await rateCard.csv_file.text();
        const rates = parseCSVContent(csvContent);

        // Save rate data with service-specific details
        const rateRecords = rates.map(rate => ({
          carrier_config_id: configData.id,
          ...rate,
          service_code: rateCard.service_type.toUpperCase(),
          service_name: rateCard.service_name,
          weight_unit: rateCard.weight_unit
        }));

        const { error: rateError } = await supabase
          .from('rate_card_rates')
          .insert(rateRecords);

        if (rateError) throw rateError;
      }

      toast.success('Rate cards uploaded successfully');
      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      console.error('Error uploading rate cards:', error);
      toast.error(error.message || 'Failed to upload rate cards');
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setAccountDetails({
      carrier_type: 'ups',
      account_name: '',
      account_group: '',
      dimensional_divisor: '166',
      fuel_surcharge_percent: '0'
    });
    setRateCards([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Rate Card</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          {/* Account Details Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Account Details</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="carrier_type">Carrier Type *</Label>
                <Select 
                  value={accountDetails.carrier_type} 
                  onValueChange={(value: any) => setAccountDetails({ ...accountDetails, carrier_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CARRIER_TYPES.map(carrier => (
                      <SelectItem key={carrier.value} value={carrier.value}>
                        <span className="flex items-center gap-2">
                          <span>{carrier.icon}</span>
                          <span>{carrier.label}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="account_name">Account Name *</Label>
                <Input
                  id="account_name"
                  value={accountDetails.account_name}
                  onChange={(e) => setAccountDetails({ ...accountDetails, account_name: e.target.value })}
                  placeholder="e.g., DHL 2025"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="account_group">Account Group</Label>
              <CarrierGroupCombobox
                value={accountDetails.account_group}
                onValueChange={(value) => setAccountDetails({ ...accountDetails, account_group: value })}
                placeholder="Select or create group"
              />
            </div>
          </div>

          {/* Account Services Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Account Services</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addRateCard}
                iconLeft={<Plus className="h-4 w-4" />}
              >
                Upload New Rate Card
              </Button>
            </div>
            
            {rateCards.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No rate cards added yet. Click "Upload New Rate Card" to get started.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {rateCards.map((rateCard, index) => (
                  <RateCardEntry
                    key={rateCard.id}
                    index={index}
                    rateCard={rateCard}
                    onUpdate={updateRateCard}
                    onDelete={deleteRateCard}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Rate Card Configuration Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Rate Card Configuration</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dimensional_divisor">Dimensional Divisor</Label>
                <Input
                  id="dimensional_divisor"
                  type="number"
                  value={accountDetails.dimensional_divisor}
                  onChange={(e) => setAccountDetails({ ...accountDetails, dimensional_divisor: e.target.value })}
                  placeholder="166"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fuel_surcharge">Fuel Surcharge (%)</Label>
                <Input
                  id="fuel_surcharge"
                  type="number"
                  step="0.01"
                  value={accountDetails.fuel_surcharge_percent}
                  onChange={(e) => setAccountDetails({ ...accountDetails, fuel_surcharge_percent: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          {/* Required Format Section */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Required Format</h3>
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">
                CSV files must follow this format:
              </p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• First column: Weight breaks (A2, A3, A4, etc.)</li>
                <li>• Remaining columns: Zone rates (B1, B2, B3, etc.)</li>
                <li>• Numeric values only for rates</li>
                <li>• Maximum zones: B1-B20</li>
                <li>• Maximum weight breaks: A2-A200</li>
              </ul>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              variant="primary" 
              onClick={saveRateCard}
              disabled={uploading}
              iconLeft={uploading ? undefined : <Upload className="h-4 w-4" />}
            >
              {uploading ? 'Uploading Rate Cards...' : 'Upload Rate Cards'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};