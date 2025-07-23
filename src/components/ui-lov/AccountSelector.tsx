import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

interface CarrierConfig {
  id: string;
  carrier_type: 'ups' | 'fedex' | 'dhl' | 'usps';
  account_name: string;
  is_active: boolean;
  is_sandbox: boolean;
  connection_status?: string;
}

interface AccountSelectorProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const CARRIER_INFO = {
  ups: { label: 'UPS', icon: '📦', color: 'bg-amber-100 text-amber-800' },
  fedex: { label: 'FedEx', icon: '🚚', color: 'bg-purple-100 text-purple-800' },
  dhl: { label: 'DHL', icon: '✈️', color: 'bg-red-100 text-red-800' },
  usps: { label: 'USPS', icon: '📮', color: 'bg-blue-100 text-blue-800' }
};

export const AccountSelector: React.FC<AccountSelectorProps> = ({
  value,
  onValueChange,
  placeholder = "Select Account",
  className = ""
}) => {
  const [carrierConfigs, setCarrierConfigs] = useState<CarrierConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCarrierConfigs();
  }, []);

  const loadCarrierConfigs = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('carrier_configs')
        .select('id, carrier_type, account_name, is_active, is_sandbox, connection_status')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('account_name');

      if (error) throw error;
      setCarrierConfigs((data || []) as CarrierConfig[]);
    } catch (error) {
      console.error('Error loading carrier configs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSelectedAccountInfo = () => {
    if (!value) return null;
    return carrierConfigs.find(config => config.id === value);
  };

  const selectedAccount = getSelectedAccountInfo();

  return (
    <Select value={value || ''} onValueChange={onValueChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder}>
          {selectedAccount && (
            <div className="flex items-center gap-2">
              <span className="text-xs">
                {CARRIER_INFO[selectedAccount.carrier_type]?.icon}
              </span>
              <span className="truncate text-xs">
                {selectedAccount.account_name}
              </span>
              <Badge 
                variant={selectedAccount.connection_status === 'connected' ? 'default' : 'secondary'} 
                className="text-xs scale-75"
              >
                {selectedAccount.is_sandbox ? 'Test' : 'Live'}
              </Badge>
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="z-50 bg-background">
        {loading ? (
          <SelectItem value="loading" disabled>Loading accounts...</SelectItem>
        ) : carrierConfigs.length === 0 ? (
          <SelectItem value="none" disabled>No accounts configured</SelectItem>
        ) : (
          carrierConfigs.map((config) => (
            <SelectItem key={config.id} value={config.id}>
              <div className="flex items-center gap-2 w-full">
                <span className="text-sm">
                  {CARRIER_INFO[config.carrier_type]?.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {config.account_name}
                    </span>
                    <Badge 
                      variant={config.connection_status === 'connected' ? 'default' : 'secondary'} 
                      className="text-xs scale-75"
                    >
                      {config.is_sandbox ? 'Test' : 'Live'}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {CARRIER_INFO[config.carrier_type]?.label}
                  </div>
                </div>
              </div>
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
};