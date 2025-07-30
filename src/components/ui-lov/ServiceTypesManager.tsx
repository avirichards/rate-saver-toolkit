import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { Button } from '@/components/ui-lov/Button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Save, RotateCcw, Trash2, Edit2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { UniversalServiceCategory, UNIVERSAL_SERVICES } from '@/utils/universalServiceCategories';
import { CarrierType, getUniversalCategoryFromCarrierCode } from '@/utils/carrierServiceRegistry';

interface CarrierConfig {
  id: string;
  carrier_type: string;
  account_name: string;
  enabled_services: any; // JSON type from Supabase
  is_active: boolean;
  account_group?: string;
}

interface CarrierService {
  id: string;
  carrier_type: string;
  service_code: string;
  service_name: string;
  description?: string;
  is_active: boolean;
}

interface CustomService {
  id?: string;
  user_id?: string;
  carrier_type: string;
  service_code: string;
  service_name: string;
  universal_category: string;
  is_available: boolean;
  is_active: boolean;
}

interface ServiceMapping {
  service_code: string;
  service_name: string;
  universal_category: string;
  is_enabled: boolean;
  is_custom: boolean;
  is_system: boolean;
  carrier_type: string;
}

export const ServiceTypesManager = () => {
  const [carrierConfigs, setCarrierConfigs] = useState<CarrierConfig[]>([]);
  const [systemServices, setSystemServices] = useState<CarrierService[]>([]);
  const [customServices, setCustomServices] = useState<CustomService[]>([]);
  const [selectedCarrier, setSelectedCarrier] = useState<string>('');
  const [carrierTypeFilter, setCarrierTypeFilter] = useState<string>('');
  const [serviceMappings, setServiceMappings] = useState<ServiceMapping[]>([]);
  const [editedMappings, setEditedMappings] = useState<Record<string, Partial<ServiceMapping>>>({});
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [isManagingUniversal, setIsManagingUniversal] = useState(false);
  const [editingService, setEditingService] = useState<ServiceMapping | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const [newCustomService, setNewCustomService] = useState({
    service_code: '',
    service_name: '',
    universal_category: UniversalServiceCategory.GROUND
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedCarrier) {
      buildServiceMappings();
      // Auto-set carrier type filter based on selected carrier
      const selectedConfig = carrierConfigs.find(c => c.id === selectedCarrier);
      if (selectedConfig) {
        setCarrierTypeFilter(selectedConfig.carrier_type.toUpperCase());
      }
    }
  }, [selectedCarrier, systemServices, customServices, carrierConfigs]);

  const loadData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load carrier configs
      const { data: configs, error: configsError } = await supabase
        .from('carrier_configs')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (configsError) throw configsError;

      // Load system services
      const { data: services, error: servicesError } = await supabase
        .from('carrier_services')
        .select('*')
        .eq('is_active', true);

      if (servicesError) throw servicesError;

      // Load custom services
      const { data: custom, error: customError } = await supabase
        .from('custom_carrier_service_codes')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (customError) throw customError;

      setCarrierConfigs((configs || []).map(config => ({
        ...config,
        enabled_services: Array.isArray(config.enabled_services) 
          ? config.enabled_services 
          : typeof config.enabled_services === 'string' 
            ? JSON.parse(config.enabled_services || '[]')
            : []
      })));
      setSystemServices(services || []);
      setCustomServices(custom || []);

      // Auto-select first carrier if available
      if (configs && configs.length > 0 && !selectedCarrier) {
        setSelectedCarrier(configs[0].id);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load service types data');
    } finally {
      setLoading(false);
    }
  };

  const buildServiceMappings = () => {
    const selectedConfig = carrierConfigs.find(c => c.id === selectedCarrier);
    if (!selectedConfig) {
      setServiceMappings([]);
      return;
    }

    const carrierType = selectedConfig.carrier_type.toUpperCase() as CarrierType;
    const mappings: ServiceMapping[] = [];

    // Add system services for this carrier
    const carrierSystemServices = systemServices.filter(
      s => s.carrier_type.toUpperCase() === carrierType
    );

    carrierSystemServices.forEach(service => {
      // Find universal mapping from registry
      const universalCategory = getUniversalCategoryFromCarrierCode(carrierType, service.service_code) 
        || UniversalServiceCategory.GROUND;

      mappings.push({
        service_code: service.service_code,
        service_name: service.service_name,
        universal_category: universalCategory,
        is_enabled: (selectedConfig.enabled_services as string[]).includes(service.service_code),
        is_custom: false,
        is_system: true,
        carrier_type: carrierType
      });
    });

    // Add custom services for this carrier
    const carrierCustomServices = customServices.filter(
      s => s.carrier_type.toUpperCase() === carrierType
    );

    carrierCustomServices.forEach(service => {
      mappings.push({
        service_code: service.service_code,
        service_name: service.service_name,
        universal_category: service.universal_category,
        is_enabled: (selectedConfig.enabled_services as string[]).includes(service.service_code),
        is_custom: true,
        is_system: false,
        carrier_type: carrierType
      });
    });

    // Filter by carrier type if filter is applied
    const filteredMappings = carrierTypeFilter 
      ? mappings.filter(m => m.carrier_type === carrierTypeFilter)
      : mappings;

    setServiceMappings(filteredMappings.sort((a, b) => a.service_name.localeCompare(b.service_name)));
    setEditedMappings({});
    setHasUnsavedChanges(false);
  };

  const toggleServiceEnabled = async (serviceCode: string, enabled: boolean) => {
    const selectedConfig = carrierConfigs.find(c => c.id === selectedCarrier);
    if (!selectedConfig) return;

    try {
      const currentServices = selectedConfig.enabled_services as string[];
      const updatedServices = enabled
        ? [...currentServices, serviceCode]
        : currentServices.filter(code => code !== serviceCode);

      const { error } = await supabase
        .from('carrier_configs')
        .update({ enabled_services: updatedServices })
        .eq('id', selectedCarrier);

      if (error) throw error;

      // Update local state
      setCarrierConfigs(prev =>
        prev.map(config =>
          config.id === selectedCarrier
            ? { ...config, enabled_services: updatedServices }
            : config
        )
      );

      toast.success(`Service ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Error updating service:', error);
      toast.error('Failed to update service');
    }
  };

  const updateServiceMapping = (serviceCode: string, field: keyof ServiceMapping, value: string) => {
    setEditedMappings(prev => ({
      ...prev,
      [serviceCode]: {
        ...prev[serviceCode],
        [field]: value
      }
    }));
    setHasUnsavedChanges(true);
  };

  const saveAllChanges = async () => {
    if (Object.keys(editedMappings).length === 0) {
      toast.info('No changes to save');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const selectedConfig = carrierConfigs.find(c => c.id === selectedCarrier);
      if (!selectedConfig) return;

      for (const [serviceCode, changes] of Object.entries(editedMappings)) {
        const originalMapping = serviceMappings.find(m => m.service_code === serviceCode);
        if (!originalMapping) continue;

        if (originalMapping.is_custom) {
          // Update existing custom service
          const updateData: any = {};
          if (changes.service_name !== undefined) updateData.service_name = changes.service_name;
          if (changes.universal_category !== undefined) updateData.universal_category = changes.universal_category;

          const { error } = await supabase
            .from('custom_carrier_service_codes')
            .update(updateData)
            .eq('service_code', serviceCode)
            .eq('carrier_type', selectedConfig.carrier_type.toUpperCase())
            .eq('user_id', user.id);

          if (error) throw error;
        } else {
          // Create custom override for system service
          const { error } = await supabase
            .from('custom_carrier_service_codes')
            .insert({
              user_id: user.id,
              carrier_type: selectedConfig.carrier_type.toUpperCase(),
              service_code: serviceCode,
              service_name: changes.service_name || originalMapping.service_name,
              universal_category: changes.universal_category || originalMapping.universal_category,
              is_available: true,
              is_active: true
            });

          if (error) throw error;
        }
      }

      await loadData();
      toast.success('All changes saved successfully');
    } catch (error) {
      console.error('Error saving changes:', error);
      toast.error('Failed to save changes');
    }
  };

  const addCustomService = async () => {
    const selectedConfig = carrierConfigs.find(c => c.id === selectedCarrier);
    if (!selectedConfig) return;

    if (!newCustomService.service_code || !newCustomService.service_name) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('custom_carrier_service_codes')
        .insert({
          user_id: user.id,
          carrier_type: selectedConfig.carrier_type.toUpperCase(),
          service_code: newCustomService.service_code,
          service_name: newCustomService.service_name,
          universal_category: newCustomService.universal_category,
          is_available: true,
          is_active: true
        });

      if (error) throw error;

      setNewCustomService({
        service_code: '',
        service_name: '',
        universal_category: UniversalServiceCategory.GROUND
      });
      setIsAddingCustom(false);
      loadData();
      toast.success('Custom service added');
    } catch (error: any) {
      console.error('Error adding custom service:', error);
      if (error.message?.includes('duplicate')) {
        toast.error('A service with this code already exists');
      } else {
        toast.error('Failed to add custom service');
      }
    }
  };

  const deleteCustomService = async (serviceCode: string) => {
    if (!confirm('Are you sure you want to delete this custom service?')) return;

    try {
      const { error } = await supabase
        .from('custom_carrier_service_codes')
        .delete()
        .eq('service_code', serviceCode)
        .eq('carrier_type', carrierConfigs.find(c => c.id === selectedCarrier)?.carrier_type.toUpperCase());

      if (error) throw error;

      loadData();
      toast.success('Custom service deleted');
    } catch (error) {
      console.error('Error deleting custom service:', error);
      toast.error('Failed to delete custom service');
    }
  };

  const resetToDefaults = async () => {
    const selectedConfig = carrierConfigs.find(c => c.id === selectedCarrier);
    if (!selectedConfig) return;

    if (!confirm('Reset all services to system defaults? This will disable all custom services.')) return;

    try {
      const carrierType = selectedConfig.carrier_type.toUpperCase() as CarrierType;
      const defaultServices = systemServices
        .filter(s => s.carrier_type.toUpperCase() === carrierType)
        .map(s => s.service_code);

      const { error } = await supabase
        .from('carrier_configs')
        .update({ enabled_services: defaultServices })
        .eq('id', selectedCarrier);

      if (error) throw error;

      loadData();
      toast.success('Services reset to defaults');
    } catch (error) {
      console.error('Error resetting services:', error);
      toast.error('Failed to reset services');
    }
  };

  const enableAllServices = async () => {
    const allServiceCodes = serviceMappings.map(m => m.service_code);
    
    try {
      const { error } = await supabase
        .from('carrier_configs')
        .update({ enabled_services: allServiceCodes })
        .eq('id', selectedCarrier);

      if (error) throw error;

      loadData();
      toast.success('All services enabled');
    } catch (error) {
      console.error('Error enabling all services:', error);
      toast.error('Failed to enable all services');
    }
  };

  const disableAllServices = async () => {
    try {
      const { error } = await supabase
        .from('carrier_configs')
        .update({ enabled_services: [] })
        .eq('id', selectedCarrier);

      if (error) throw error;

      loadData();
      toast.success('All services disabled');
    } catch (error) {
      console.error('Error disabling all services:', error);
      toast.error('Failed to disable all services');
    }
  };

  const getCurrentValue = (serviceCode: string, field: keyof ServiceMapping) => {
    const edited = editedMappings[serviceCode];
    const original = serviceMappings.find(m => m.service_code === serviceCode);
    
    if (edited && edited[field] !== undefined) {
      return edited[field];
    }
    
    return original ? original[field] : '';
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="text-muted-foreground">Loading service types...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Service Types Management</CardTitle>
          <div className="text-sm text-muted-foreground">
            Manage carrier service types and their universal category mappings
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Carrier Selection and Filter */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Select Carrier Account</Label>
              <Select value={selectedCarrier} onValueChange={setSelectedCarrier}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a carrier account" />
                </SelectTrigger>
                <SelectContent>
                  {carrierConfigs.map(config => (
                    <SelectItem key={config.id} value={config.id}>
                      {config.account_name} ({config.carrier_type.toUpperCase()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Filter by Carrier Type</Label>
              <Select value={carrierTypeFilter} onValueChange={setCarrierTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All carrier types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Carrier Types</SelectItem>
                  {Array.from(new Set(carrierConfigs.map(c => c.carrier_type.toUpperCase()))).map(type => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedCarrier && (
            <>
              {/* Quick Actions */}
              <div className="flex flex-wrap gap-2 p-4 bg-muted/50 rounded-lg">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={enableAllServices}
                  iconLeft={<Save className="h-4 w-4" />}
                >
                  Enable All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={disableAllServices}
                >
                  Disable All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetToDefaults}
                  iconLeft={<RotateCcw className="h-4 w-4" />}
                >
                  Reset to Defaults
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={saveAllChanges}
                  disabled={!hasUnsavedChanges}
                  iconLeft={<Save className="h-4 w-4" />}
                >
                  Save Changes
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsManagingUniversal(true)}
                  iconLeft={<Edit2 className="h-4 w-4" />}
                >
                  Manage Universal Types
                </Button>
                <Dialog open={isAddingCustom} onOpenChange={setIsAddingCustom}>
                  <DialogTrigger asChild>
                    <Button
                      variant="primary"
                      size="sm"
                      iconLeft={<Plus className="h-4 w-4" />}
                    >
                      Add Custom Service
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Custom Service</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="service-code">Service Code</Label>
                        <Input
                          id="service-code"
                          value={newCustomService.service_code}
                          onChange={(e) => setNewCustomService(prev => ({
                            ...prev,
                            service_code: e.target.value.toUpperCase()
                          }))}
                          placeholder="e.g., CUSTOM_EXPRESS"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="service-name">Service Name</Label>
                        <Input
                          id="service-name"
                          value={newCustomService.service_name}
                          onChange={(e) => setNewCustomService(prev => ({
                            ...prev,
                            service_name: e.target.value
                          }))}
                          placeholder="e.g., Custom Express Service"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="universal-category">Universal Category</Label>
                        <Select
                          value={newCustomService.universal_category}
                          onValueChange={(value) => setNewCustomService(prev => ({
                            ...prev,
                            universal_category: value as UniversalServiceCategory
                          }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(UNIVERSAL_SERVICES).map(([key, info]) => (
                              <SelectItem key={key} value={key}>
                                {info.displayName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          onClick={() => setIsAddingCustom(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="primary"
                          onClick={addCustomService}
                        >
                          Add Service
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Services Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    Service Mappings ({serviceMappings.length} services)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Enabled</TableHead>
                        <TableHead>Carrier Type</TableHead>
                        <TableHead>Service Name</TableHead>
                        <TableHead>Service Code</TableHead>
                        <TableHead>Universal Category</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {serviceMappings.map(mapping => (
                        <TableRow key={mapping.service_code}>
                          <TableCell>
                            <Switch
                              checked={mapping.is_enabled}
                              onCheckedChange={(checked) =>
                                toggleServiceEnabled(mapping.service_code, checked)
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {mapping.carrier_type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Input
                              value={getCurrentValue(mapping.service_code, 'service_name') as string}
                              onChange={(e) =>
                                updateServiceMapping(mapping.service_code, 'service_name', e.target.value)
                              }
                              className="min-w-0"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={getCurrentValue(mapping.service_code, 'service_code') as string}
                              onChange={(e) =>
                                updateServiceMapping(mapping.service_code, 'service_code', e.target.value)
                              }
                              className="min-w-0 font-mono text-sm"
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={getCurrentValue(mapping.service_code, 'universal_category') as string}
                              onValueChange={(value) =>
                                updateServiceMapping(mapping.service_code, 'universal_category', value)
                              }
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(UNIVERSAL_SERVICES).map(([key, info]) => (
                                  <SelectItem key={key} value={key}>
                                    {info.displayName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {serviceMappings.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No services available for the selected carrier
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Universal Service Types Management Dialog */}
              <Dialog open={isManagingUniversal} onOpenChange={setIsManagingUniversal}>
                <DialogContent className="max-w-4xl">
                  <DialogHeader>
                    <DialogTitle>Manage Universal Service Types</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="text-sm text-muted-foreground">
                      These are the universal service categories that all carrier services map to. Changes here will affect the entire system.
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Category</TableHead>
                          <TableHead>Display Name</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Transit Days</TableHead>
                          <TableHead>International</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.entries(UNIVERSAL_SERVICES).map(([key, info]) => (
                          <TableRow key={key}>
                            <TableCell>
                              <code className="text-sm bg-muted px-2 py-1 rounded">
                                {key}
                              </code>
                            </TableCell>
                            <TableCell className="font-medium">
                              {info.displayName}
                            </TableCell>
                            <TableCell>
                              {info.description}
                            </TableCell>
                            <TableCell>
                              {info.typicalTransitDays}
                            </TableCell>
                            <TableCell>
                              <Badge variant={info.isInternational ? "default" : "outline"}>
                                {info.isInternational ? 'Yes' : 'No'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="text-sm text-muted-foreground">
                      Note: Universal service types are currently read-only. Contact support if you need to modify these categories.
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}

          {carrierConfigs.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No carrier accounts found. Please add a carrier account first.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};