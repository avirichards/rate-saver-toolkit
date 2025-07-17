import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { Button } from '@/components/ui-lov/Button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit2, Trash2, TestTube, AlertTriangle, CheckCircle, Truck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CarrierGroupCombobox } from './CarrierGroupCombobox';

interface CarrierConfig {
  id: string;
  carrier_type: 'ups' | 'fedex' | 'dhl' | 'usps';
  account_name: string;
  account_group?: string;
  enabled_services: string[];
  is_active: boolean;
  is_sandbox: boolean;
  connection_status?: 'connected' | 'error' | 'unknown';
  last_test_at?: string;
  ups_client_id?: string;
  ups_client_secret?: string;
  ups_account_number?: string;
  fedex_account_number?: string;
  fedex_meter_number?: string;
  fedex_key?: string;
  fedex_password?: string;
  dhl_account_number?: string;
  dhl_site_id?: string;
  dhl_password?: string;
  usps_user_id?: string;
  usps_password?: string;
  created_at: string;
  updated_at: string;
}

interface CarrierService {
  id: string;
  carrier_type: string;
  service_code: string;
  service_name: string;
  description?: string;
  is_active: boolean;
}

const CARRIER_TYPES = [
  { value: 'ups', label: 'UPS', icon: '📦' },
  { value: 'fedex', label: 'FedEx', icon: '🚚' },
  { value: 'dhl', label: 'DHL', icon: '✈️' },
  { value: 'usps', label: 'USPS', icon: '📮' }
] as const;

export const CarrierAccountManager = () => {
  const [configs, setConfigs] = useState<CarrierConfig[]>([]);
  const [availableServices, setAvailableServices] = useState<CarrierService[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [editingAccount, setEditingAccount] = useState<CarrierConfig | null>(null);
  const [testingAccount, setTestingAccount] = useState<string | null>(null);

  const [newAccount, setNewAccount] = useState<{
    carrier_type: 'ups' | 'fedex' | 'dhl' | 'usps';
    account_name: string;
    account_group: string;
    enabled_services: string[];
    is_sandbox: boolean;
    ups_client_id: string;
    ups_client_secret: string;
    ups_account_number: string;
    fedex_account_number: string;
    fedex_meter_number: string;
    fedex_key: string;
    fedex_password: string;
    dhl_account_number: string;
    dhl_site_id: string;
    dhl_password: string;
    usps_user_id: string;
    usps_password: string;
  }>({
    carrier_type: 'ups',
    account_name: '',
    account_group: '',
    enabled_services: [],
    is_sandbox: true,
    ups_client_id: '',
    ups_client_secret: '',
    ups_account_number: '',
    // FedEx fields
    fedex_account_number: '',
    fedex_meter_number: '',
    fedex_key: '',
    fedex_password: '',
    // DHL fields
    dhl_account_number: '',
    dhl_site_id: '',
    dhl_password: '',
    // USPS fields
    usps_user_id: '',
    usps_password: ''
  });

  useEffect(() => {
    loadCarrierConfigs();
    loadAvailableServices();
  }, []);

  // Update enabled services when carrier type changes
  useEffect(() => {
    const servicesForCarrier = availableServices.filter(s => s.carrier_type === newAccount.carrier_type);
    setNewAccount(prev => ({
      ...prev,
      enabled_services: servicesForCarrier.map(s => s.service_code)
    }));
  }, [newAccount.carrier_type, availableServices]);

  const loadCarrierConfigs = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('carrier_configs')
        .select('*')
        .eq('user_id', user.id)
        .order('account_group', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setConfigs((data || []) as CarrierConfig[]);
    } catch (error) {
      console.error('Error loading carrier configs:', error);
      toast.error('Failed to load carrier accounts');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableServices = async () => {
    try {
      const { data, error } = await supabase
        .from('carrier_services')
        .select('*')
        .eq('is_active', true)
        .order('carrier_type', { ascending: true })
        .order('service_name', { ascending: true });

      if (error) throw error;
      setAvailableServices((data || []) as CarrierService[]);
    } catch (error) {
      console.error('Error loading available services:', error);
      toast.error('Failed to load carrier services');
    }
  };

  const validateAccountData = (account: {
    carrier_type: 'ups' | 'fedex' | 'dhl' | 'usps';
    account_name: string;
    [key: string]: any;
  }) => {
    if (!account.account_name.trim()) {
      toast.error('Please enter an account name');
      return false;
    }

    switch (account.carrier_type) {
      case 'ups':
        if (!account.ups_client_id || !account.ups_client_secret) {
          toast.error('UPS requires Client ID and Client Secret');
          return false;
        }
        break;
      case 'fedex':
        if (!account.fedex_account_number || !account.fedex_key) {
          toast.error('FedEx requires Account Number and API Key');
          return false;
        }
        break;
      case 'dhl':
        if (!account.dhl_account_number || !account.dhl_site_id) {
          toast.error('DHL requires Account Number and Site ID');
          return false;
        }
        break;
      case 'usps':
        if (!account.usps_user_id) {
          toast.error('USPS requires User ID');
          return false;
        }
        break;
    }
    return true;
  };

  const saveAccount = async () => {
    if (!validateAccountData(newAccount)) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const accountData = {
        user_id: user.id,
        carrier_type: newAccount.carrier_type,
        account_name: newAccount.account_name,
        account_group: newAccount.account_group || null,
        enabled_services: newAccount.enabled_services,
        is_sandbox: newAccount.is_sandbox,
        ups_client_id: newAccount.carrier_type === 'ups' ? newAccount.ups_client_id : null,
        ups_client_secret: newAccount.carrier_type === 'ups' ? newAccount.ups_client_secret : null,
        ups_account_number: newAccount.carrier_type === 'ups' ? newAccount.ups_account_number : null,
        fedex_account_number: newAccount.carrier_type === 'fedex' ? newAccount.fedex_account_number : null,
        fedex_meter_number: newAccount.carrier_type === 'fedex' ? newAccount.fedex_meter_number : null,
        fedex_key: newAccount.carrier_type === 'fedex' ? newAccount.fedex_key : null,
        fedex_password: newAccount.carrier_type === 'fedex' ? newAccount.fedex_password : null,
        dhl_account_number: newAccount.carrier_type === 'dhl' ? newAccount.dhl_account_number : null,
        dhl_site_id: newAccount.carrier_type === 'dhl' ? newAccount.dhl_site_id : null,
        dhl_password: newAccount.carrier_type === 'dhl' ? newAccount.dhl_password : null,
        usps_user_id: newAccount.carrier_type === 'usps' ? newAccount.usps_user_id : null,
        usps_password: newAccount.carrier_type === 'usps' ? newAccount.usps_password : null
      };

      const { error } = await supabase
        .from('carrier_configs')
        .insert(accountData);

      if (error) throw error;

      toast.success('Carrier account added successfully');
      setIsAddingAccount(false);
      resetNewAccount();
      loadCarrierConfigs();
    } catch (error: any) {
      console.error('Error saving account:', error);
      if (error.message?.includes('duplicate key')) {
        toast.error('An account with this name already exists');
      } else {
        toast.error('Failed to save carrier account');
      }
    }
  };

  const updateAccount = async (account: CarrierConfig) => {
    try {
      const { error } = await supabase
        .from('carrier_configs')
        .update({
          account_name: account.account_name,
          account_group: account.account_group || null,
          enabled_services: account.enabled_services,
          is_active: account.is_active,
          is_sandbox: account.is_sandbox,
          ups_client_id: account.ups_client_id,
          ups_client_secret: account.ups_client_secret,
          ups_account_number: account.ups_account_number,
          fedex_account_number: account.fedex_account_number,
          fedex_meter_number: account.fedex_meter_number,
          fedex_key: account.fedex_key,
          fedex_password: account.fedex_password,
          dhl_account_number: account.dhl_account_number,
          dhl_site_id: account.dhl_site_id,
          dhl_password: account.dhl_password,
          usps_user_id: account.usps_user_id,
          usps_password: account.usps_password
        })
        .eq('id', account.id);

      if (error) throw error;

      toast.success('Account updated successfully');
      setEditingAccount(null);
      loadCarrierConfigs();
    } catch (error) {
      console.error('Error updating account:', error);
      toast.error('Failed to update account');
    }
  };

  const deleteAccount = async (id: string) => {
    if (!confirm('Are you sure you want to delete this carrier account?')) return;

    try {
      const { error } = await supabase
        .from('carrier_configs')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Account deleted successfully');
      loadCarrierConfigs();
    } catch (error) {
      console.error('Error deleting account:', error);
      toast.error('Failed to delete account');
    }
  };

  const testConnection = async (config: CarrierConfig) => {
    setTestingAccount(config.id);
    try {
      if (config.carrier_type === 'ups') {
        // Test UPS connection using the specific config ID
        const { data, error } = await supabase.functions.invoke('ups-auth', {
          body: { action: 'get_token', config_id: config.id }
        });

        if (error || !data.access_token) {
          // Update config to mark as error
          await supabase
            .from('carrier_configs')
            .update({ 
              connection_status: 'error',
              last_test_at: new Date().toISOString() 
            })
            .eq('id', config.id);
            
          loadCarrierConfigs();
          throw new Error(error?.message || 'Failed to authenticate with UPS');
        }
        
        // Update config to mark as connected
        await supabase
          .from('carrier_configs')
          .update({ 
            connection_status: 'connected',
            last_test_at: new Date().toISOString() 
          })
          .eq('id', config.id);
          
        toast.success(`${config.account_name} connection successful!`);
        loadCarrierConfigs();
      } else {
        // For other carriers, we'll implement testing later
        toast.info(`${config.carrier_type.toUpperCase()} connection testing will be available soon`);
      }
    } catch (error: any) {
      console.error('Error testing connection:', error);
      toast.error(`${config.account_name} connection failed: ${error.message}`);
      
      // Update config to mark as error if not already done
      await supabase
        .from('carrier_configs')
        .update({ 
          connection_status: 'error',
          last_test_at: new Date().toISOString() 
        })
        .eq('id', config.id);
        
      loadCarrierConfigs();
    } finally {
      setTestingAccount(null);
    }
  };

  const resetNewAccount = () => {
    const upsServices = availableServices.filter(s => s.carrier_type === 'ups').map(s => s.service_code);
    setNewAccount({
      carrier_type: 'ups',
      account_name: '',
      account_group: '',
      enabled_services: upsServices,
      is_sandbox: true,
      ups_client_id: '',
      ups_client_secret: '',
      ups_account_number: '',
      fedex_account_number: '',
      fedex_meter_number: '',
      fedex_key: '',
      fedex_password: '',
      dhl_account_number: '',
      dhl_site_id: '',
      dhl_password: '',
      usps_user_id: '',
      usps_password: ''
    });
  };

  const getCarrierLabel = (carrierType: string) => {
    return CARRIER_TYPES.find(c => c.value === carrierType)?.label || carrierType.toUpperCase();
  };

  const getCarrierIcon = (carrierType: string) => {
    return CARRIER_TYPES.find(c => c.value === carrierType)?.icon || '📦';
  };


  const getGroupedConfigs = () => {
    const grouped = configs.reduce((acc, config) => {
      const group = config.account_group || 'Ungrouped';
      if (!acc[group]) acc[group] = [];
      acc[group].push(config);
      return acc;
    }, {} as Record<string, CarrierConfig[]>);
    
    return grouped;
  };

  const renderServiceToggles = (account: any, setAccount: (account: any) => void) => {
    const carrierServices = availableServices.filter(s => s.carrier_type === account.carrier_type);
    
    if (carrierServices.length === 0) return null;

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Enabled Services</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAccount({
                ...account,
                enabled_services: carrierServices.map(s => s.service_code)
              })}
            >
              Select All
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAccount({
                ...account,
                enabled_services: []
              })}
            >
              Clear All
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto p-3 border rounded-lg bg-muted/20">
          {carrierServices.map(service => (
            <div key={service.service_code} className="flex items-center justify-between space-x-2">
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={account.enabled_services.includes(service.service_code)}
                    onCheckedChange={(checked) => {
                      const updatedServices = checked
                        ? [...account.enabled_services, service.service_code]
                        : account.enabled_services.filter(code => code !== service.service_code);
                      setAccount({
                        ...account,
                        enabled_services: updatedServices
                      });
                    }}
                  />
                  <div>
                    <Label className="text-sm font-medium">{service.service_name}</Label>
                    {service.description && (
                      <p className="text-xs text-muted-foreground">{service.description}</p>
                    )}
                  </div>
                </div>
              </div>
              <Badge variant="outline" className="text-xs">
                {service.service_code}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderCarrierFields = (
    account: { carrier_type: 'ups' | 'fedex' | 'dhl' | 'usps'; [key: string]: any }, 
    setAccount: (account: any) => void, 
    isEdit = false
  ) => {
    switch (account.carrier_type) {
      case 'ups':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="ups_client_id">UPS Client ID *</Label>
              <Input
                id="ups_client_id"
                value={account.ups_client_id}
                onChange={(e) => setAccount({ ...account, ups_client_id: e.target.value })}
                placeholder="Enter UPS API Client ID"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ups_client_secret">UPS Client Secret *</Label>
              <Input
                id="ups_client_secret"
                type="password"
                value={account.ups_client_secret}
                onChange={(e) => setAccount({ ...account, ups_client_secret: e.target.value })}
                placeholder="Enter UPS API Client Secret"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ups_account_number">UPS Account Number</Label>
              <Input
                id="ups_account_number"
                value={account.ups_account_number}
                onChange={(e) => setAccount({ ...account, ups_account_number: e.target.value })}
                placeholder="Enter UPS Account Number (optional)"
              />
            </div>
          </>
        );
      case 'fedex':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="fedex_account_number">FedEx Account Number *</Label>
              <Input
                id="fedex_account_number"
                value={account.fedex_account_number}
                onChange={(e) => setAccount({ ...account, fedex_account_number: e.target.value })}
                placeholder="Enter FedEx Account Number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fedex_meter_number">FedEx Meter Number</Label>
              <Input
                id="fedex_meter_number"
                value={account.fedex_meter_number}
                onChange={(e) => setAccount({ ...account, fedex_meter_number: e.target.value })}
                placeholder="Enter FedEx Meter Number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fedex_key">FedEx API Key *</Label>
              <Input
                id="fedex_key"
                type="password"
                value={account.fedex_key}
                onChange={(e) => setAccount({ ...account, fedex_key: e.target.value })}
                placeholder="Enter FedEx API Key"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fedex_password">FedEx Password</Label>
              <Input
                id="fedex_password"
                type="password"
                value={account.fedex_password}
                onChange={(e) => setAccount({ ...account, fedex_password: e.target.value })}
                placeholder="Enter FedEx Password"
              />
            </div>
          </>
        );
      case 'dhl':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="dhl_account_number">DHL Account Number *</Label>
              <Input
                id="dhl_account_number"
                value={account.dhl_account_number}
                onChange={(e) => setAccount({ ...account, dhl_account_number: e.target.value })}
                placeholder="Enter DHL Account Number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dhl_site_id">DHL Site ID *</Label>
              <Input
                id="dhl_site_id"
                value={account.dhl_site_id}
                onChange={(e) => setAccount({ ...account, dhl_site_id: e.target.value })}
                placeholder="Enter DHL Site ID"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dhl_password">DHL Password</Label>
              <Input
                id="dhl_password"
                type="password"
                value={account.dhl_password}
                onChange={(e) => setAccount({ ...account, dhl_password: e.target.value })}
                placeholder="Enter DHL Password"
              />
            </div>
          </>
        );
      case 'usps':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="usps_user_id">USPS User ID *</Label>
              <Input
                id="usps_user_id"
                value={account.usps_user_id}
                onChange={(e) => setAccount({ ...account, usps_user_id: e.target.value })}
                placeholder="Enter USPS User ID"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="usps_password">USPS Password</Label>
              <Input
                id="usps_password"
                type="password"
                value={account.usps_password}
                onChange={(e) => setAccount({ ...account, usps_password: e.target.value })}
                placeholder="Enter USPS Password"
              />
            </div>
          </>
        );
      default:
        return null;
    }
  };

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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Carrier Accounts
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Manage multiple carrier accounts for rate shopping and analysis
            </p>
          </div>
          <Dialog open={isAddingAccount} onOpenChange={setIsAddingAccount}>
            <DialogTrigger asChild>
              <Button variant="primary" iconLeft={<Plus className="h-4 w-4" />}>
                Add Account
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add Carrier Account</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="carrier_type">Carrier Type *</Label>
                  <Select 
                    value={newAccount.carrier_type} 
                    onValueChange={(value: any) => setNewAccount({ ...newAccount, carrier_type: value })}
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
                    value={newAccount.account_name}
                    onChange={(e) => setNewAccount({ ...newAccount, account_name: e.target.value })}
                    placeholder="e.g., UPS West Coast Account"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="account_group">Account Group</Label>
                  <CarrierGroupCombobox
                    value={newAccount.account_group}
                    onValueChange={(value) => setNewAccount({ ...newAccount, account_group: value })}
                    placeholder="Select or create group"
                  />
                </div>

                {renderCarrierFields(newAccount, setNewAccount)}
                
                {renderServiceToggles(newAccount, setNewAccount)}

                <div className="flex items-center justify-between py-2">
                  <div>
                    <div className="font-medium">Sandbox Mode</div>
                    <div className="text-sm text-muted-foreground">Use testing environment</div>
                  </div>
                  <Switch 
                    checked={newAccount.is_sandbox}
                    onCheckedChange={(checked) => setNewAccount({ ...newAccount, is_sandbox: checked })}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsAddingAccount(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" onClick={saveAccount}>
                    Add Account
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {configs.length === 0 ? (
          <div className="text-center py-8">
            <Truck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Carrier Accounts</h3>
            <p className="text-muted-foreground mb-4">
              Add your first carrier account to start getting rate quotes
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(getGroupedConfigs()).map(([groupName, groupConfigs]) => (
              <div key={groupName} className="space-y-3">
                {groupName !== 'Ungrouped' && (
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
                      {groupName}
                    </h3>
                    <div className="flex-1 h-px bg-border"></div>
                    <Badge variant="outline" className="text-xs">
                      {groupConfigs.length} account{groupConfigs.length > 1 ? 's' : ''}
                    </Badge>
                  </div>
                )}
                <div className="space-y-3">
                  {groupConfigs.map((config) => (
                    <div key={config.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <span className="text-2xl">{getCarrierIcon(config.carrier_type)}</span>
                          <div>
                            <h3 className="font-medium">{config.account_name}</h3>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span>{getCarrierLabel(config.carrier_type)}</span>
                              <span>•</span>
                              <span>{config.is_sandbox ? 'Sandbox' : 'Production'}</span>
                              <span>•</span>
                              <span>{config.enabled_services?.length || 0} services</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {config.is_active ? (
                            <Badge variant="default">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => testConnection(config)}
                            disabled={testingAccount === config.id}
                            iconLeft={<TestTube className="h-4 w-4" />}
                          >
                            {testingAccount === config.id ? 'Testing...' : 'Test'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingAccount({ ...config })}
                            iconLeft={<Edit2 className="h-4 w-4" />}
                          >
                            Edit
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Edit Account Dialog */}
        <Dialog open={!!editingAccount} onOpenChange={() => setEditingAccount(null)}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Carrier Account</DialogTitle>
            </DialogHeader>
            {editingAccount && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_account_name">Account Name *</Label>
                  <Input
                    id="edit_account_name"
                    value={editingAccount.account_name}
                    onChange={(e) => setEditingAccount({ ...editingAccount, account_name: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit_account_group">Account Group</Label>
                  <CarrierGroupCombobox
                    value={editingAccount.account_group || ''}
                    onValueChange={(value) => setEditingAccount({ ...editingAccount, account_group: value })}
                    placeholder="Select or create group"
                  />
                </div>

                {renderCarrierFields(editingAccount as any, setEditingAccount as any, true)}
                
                {renderServiceToggles(editingAccount as any, setEditingAccount as any)}

                <div className="flex items-center justify-between py-2">
                  <div>
                    <div className="font-medium">Active</div>
                    <div className="text-sm text-muted-foreground">Enable this account for analysis</div>
                  </div>
                  <Switch 
                    checked={editingAccount.is_active}
                    onCheckedChange={(checked) => setEditingAccount({ ...editingAccount, is_active: checked })}
                  />
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <div className="font-medium">Sandbox Mode</div>
                    <div className="text-sm text-muted-foreground">Use testing environment</div>
                  </div>
                  <Switch 
                    checked={editingAccount.is_sandbox}
                    onCheckedChange={(checked) => setEditingAccount({ ...editingAccount, is_sandbox: checked })}
                  />
                </div>

                <div className="flex justify-between pt-4">
                  <Button variant="secondary" onClick={() => deleteAccount(editingAccount.id)}>
                    Delete Account
                  </Button>
                  <div className="space-x-2">
                    <Button variant="outline" onClick={() => setEditingAccount(null)}>
                      Cancel
                    </Button>
                    <Button onClick={() => updateAccount(editingAccount)}>
                      Update Account
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};