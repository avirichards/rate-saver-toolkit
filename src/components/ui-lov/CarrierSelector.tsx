import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { Button } from '@/components/ui-lov/Button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Truck, Settings, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/apiClient';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

interface CarrierConfig {
  id: string;
  carrier_type: 'ups' | 'fedex' | 'dhl' | 'usps';
  account_name: string;
  is_active: boolean;
  is_sandbox: boolean;
  is_rate_card?: boolean;
}

interface CarrierSelectorProps {
  selectedCarriers: string[];
  onCarrierChange: (selectedCarriers: string[]) => void;
  showAllOption?: boolean;
  hasZoneMapping?: boolean;
}

const CARRIER_INFO = {
  ups: { label: 'UPS', icon: '📦', color: 'bg-amber-100 text-amber-800' },
  fedex: { label: 'FedEx', icon: '🚚', color: 'bg-purple-100 text-purple-800' },
  dhl: { label: 'DHL', icon: '✈️', color: 'bg-red-100 text-red-800' },
  usps: { label: 'USPS', icon: '📮', color: 'bg-blue-100 text-blue-800' }
};

export const CarrierSelector: React.FC<CarrierSelectorProps> = ({ 
  selectedCarriers, 
  onCarrierChange, 
  showAllOption = true,
  hasZoneMapping = true
}) => {
  const [carrierConfigs, setCarrierConfigs] = useState<CarrierConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCarrierConfigs();
  }, []);

  const loadCarrierConfigs = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('carrier_configs')
        .select('id, carrier_type, account_name, is_active, is_sandbox, is_rate_card')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCarrierConfigs((data || []) as CarrierConfig[]);
    } catch (error) {
      console.error('Error loading carrier configs:', error);
      toast.error('Failed to load carrier accounts');
    } finally {
      setLoading(false);
    }
  };

  const handleCarrierToggle = (carrierId: string, checked: boolean) => {
    let newSelected = [...selectedCarriers];
    
    if (checked && !newSelected.includes(carrierId)) {
      newSelected.push(carrierId);
    } else if (!checked && newSelected.includes(carrierId)) {
      newSelected = newSelected.filter(id => id !== carrierId);
    }
    
    // Allow users to uncheck all carriers if they want
    onCarrierChange(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onCarrierChange(carrierConfigs.map(config => config.id));
    } else {
      // Allow unchecking all carriers - user can select individual ones after
      onCarrierChange([]);
    }
  };

  const isAllSelected = carrierConfigs.length > 0 && 
    carrierConfigs.every(config => selectedCarriers.includes(config.id));

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="text-muted-foreground">Loading carrier accounts...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (carrierConfigs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Select Carriers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Carrier Accounts</h3>
            <p className="text-muted-foreground mb-4">
              You need to configure at least one carrier account before running an analysis.
            </p>
            <Link to="/settings?tab=carriers">
              <Button variant="primary" iconLeft={<Settings className="h-4 w-4" />}>
                Configure Carriers
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="h-5 w-5" />
          Select Carriers for Analysis
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Choose which carrier accounts to use for rate shopping. More carriers typically mean better rate comparison.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {showAllOption && carrierConfigs.length > 1 && (
          <div 
            className="flex items-center space-x-2 p-3 border rounded-lg bg-muted/50 cursor-pointer hover:bg-muted/70 transition-colors"
            onClick={(e) => {
              // Only handle click if it's not on the checkbox itself
              if (e.target !== e.currentTarget.querySelector('button')) {
                handleSelectAll(!isAllSelected);
              }
            }}
          >
            <Checkbox
              id="select-all"
              checked={isAllSelected}
              onCheckedChange={handleSelectAll}
              onClick={(e) => e.stopPropagation()}
            />
            <Label htmlFor="select-all" className="font-medium cursor-pointer flex-1">
              Use All Carriers ({carrierConfigs.length})
            </Label>
            <Badge variant="outline" className="ml-auto">
              Best Rates
            </Badge>
          </div>
        )}

        <div className="space-y-3">
          {carrierConfigs.map((config) => {
            const carrierInfo = CARRIER_INFO[config.carrier_type] || { label: config.carrier_type.toUpperCase(), icon: '📋', color: 'bg-gray-100 text-gray-800' };
            const isSelected = selectedCarriers.includes(config.id);
            const isRateCard = config.is_rate_card;
            const willFallbackToAPI = isRateCard && !hasZoneMapping;
            
            const carrierElement = (
              <div 
                key={config.id} 
                className={`flex items-center space-x-3 p-3 border rounded-lg transition-colors hover:bg-muted/50 cursor-pointer`}
                onClick={(e) => {
                  // Only handle click if it's not on the checkbox itself
                  if (e.target !== e.currentTarget.querySelector('button')) {
                    handleCarrierToggle(config.id, !isSelected);
                  }
                }}
              >
                <Checkbox
                  id={config.id}
                  checked={isSelected}
                  onCheckedChange={(checked) => {
                    handleCarrierToggle(config.id, !!checked);
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
                
                <div className="flex items-center gap-3 flex-1 pointer-events-none">
                  <div className="text-2xl">{carrierInfo.icon}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {config.account_name}
                      </span>
                      <Badge variant="outline" className={carrierInfo.color}>
                        {carrierInfo.label}
                      </Badge>
                      {config.is_sandbox && (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                          Sandbox
                        </Badge>
                      )}
                      {isRateCard && (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          Rate Card
                        </Badge>
                      )}
                      {willFallbackToAPI && (
                        <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                          Will use API
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {carrierInfo.label} Account • Active
                      {willFallbackToAPI && " • No zone mapping - will use live API rates"}
                    </div>
                  </div>
                </div>
              </div>
            );

            return carrierElement;
          })}
        </div>

        {selectedCarriers.length > 0 && (
          <div className="pt-3 border-t">
            <p className="text-sm text-muted-foreground">
              <strong>{selectedCarriers.length}</strong> carrier account{selectedCarriers.length > 1 ? 's' : ''} selected for analysis
            </p>
          </div>
        )}

        <div className="flex justify-end">
          <Link to="/settings?tab=carriers">
            <Button variant="outline" iconLeft={<Settings className="h-4 w-4" />}>
              Manage Carriers
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};